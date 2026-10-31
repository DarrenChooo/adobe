import { Fragment, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, fileUrl, type RunResult } from "../api";
import PagePlacer, { boxAt, type PlacedBox } from "../components/PagePlacer";
import PdfPreview from "../components/PdfPreview";
import SignaturePad from "../components/SignaturePad";
import { useRun } from "../components/useRun";
import type { ToolPanelProps, ToolUI } from "./registry";

type Kind = "signature" | "date" | "name" | "initials";
interface Box extends PlacedBox { kind: Kind }
interface Req {
  id: string; title: string; message: string; file_id: string; status: string; signer_email: string; signer_name: string;
  link: string; created_at: string; viewed_at: string | null; signed_at: string | null;
  signed_file_id: string | null; batch_id: string | null; fields: Box[];
}
interface Branding { company: string; color: string; logo: string | null }

const SIZES: Record<Kind, [number, number]> = { signature: [0.3, 0.07], initials: [0.12, 0.05], date: [0.2, 0.03], name: [0.3, 0.03] };
const LABEL: Record<Kind, string> = { signature: "Signature", initials: "Initials", date: "Date", name: "Full name" };
const absolute = (link: string) => `${window.location.origin}${link}`;

function Send(props: ToolPanelProps & { onSent: () => void }) {
  const { run, busy } = useRun(props);
  const id = props.selectedFileIds.find((x) => props.files.find((f) => f.file_id === x)?.pages);
  const [kind, setKind] = useState<Kind>("signature");
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [bulk, setBulk] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [csv, setCsv] = useState("email,name\n");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [saveAs, setSaveAs] = useState("");
  const [templates, setTemplates] = useState<{ id: string; name: string; fields: Box[] }[]>([]);
  const [made, setMade] = useState<Req[]>([]);

  useEffect(() => {
    props.api.runTool("esign", [], { action: "template_list" }).then((r) => r.ok && setTemplates(r.data.templates));
  }, []);

  if (!id) return <p className="muted">Select the PDF to send for signing.</p>;
  const send = async () => {
    const base = { fields: boxes.map(({ kind, page, x, y, w, h }) => ({ kind, page, x, y, w, h })), title: title || undefined, message, save_template: saveAs || undefined };
    const res: RunResult = bulk
      ? await run("esign", [id], { action: "bulk", csv, ...base })
      : await run("esign", [id], { action: "create", signer_email: email, signer_name: name, ...base });
    if (res.ok) {
      setMade(res.data.requests);
      props.onSent();
    }
  };

  return (
    <div className="stack">
      <h3>1. Place boxes</h3>
      <div className="row">
        <div className="tabs">
          {(Object.keys(LABEL) as Kind[]).map((k) => <button key={k} className={kind === k ? "active" : ""} onClick={() => setKind(k)}>{LABEL[k]}</button>)}
        </div>
        {templates.length > 0 && (
          <select defaultValue="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) setBoxes(t.fields.map((f) => ({ ...f, label: LABEL[f.kind] }))); }}>
            <option value="" disabled>Use a template…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>
      <PagePlacer
        fileId={id}
        width={400}
        boxes={boxes}
        onPlace={(page, x, y) => setBoxes((s) => [...s, { ...boxAt(page, x, y, ...SIZES[kind]), kind, label: LABEL[kind] }])}
        onRemove={(i) => setBoxes((s) => s.filter((_, j) => j !== i))}
      />
      <label>Save these boxes as a template <small className="muted">(optional name)</small><input value={saveAs} onChange={(e) => setSaveAs(e.target.value)} /></label>

      <h3>2. Who signs</h3>
      <div className="tabs">
        <button className={!bulk ? "active" : ""} onClick={() => setBulk(false)}>One signer</button>
        <button className={bulk ? "active" : ""} onClick={() => setBulk(true)}>Bulk (CSV)</button>
      </div>
      {bulk ? (
        <>
          <label>Signers CSV <small className="muted">columns: email,name. One link per row.</small>
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} />
          </label>
          <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0]?.text().then(setCsv)} />
        </>
      ) : (
        <div className="row">
          <label style={{ flex: 1 }}>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="signer@example.com" /></label>
          <label style={{ flex: 1 }}>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        </div>
      )}
      <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to the file name" /></label>
      <label>Message to signer<input value={message} onChange={(e) => setMessage(e.target.value)} /></label>
      <button className="primary" disabled={busy || !boxes.length || (!bulk && !email)} onClick={send}>
        {busy ? "Creating…" : !boxes.length ? "Place at least one box" : "Create signing link(s)"}
      </button>
      {made.length > 0 && (
        <div className="card stack">
          <strong>Send these links (no email is sent):</strong>
          {made.map((r) => <LinkRow key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}

function LinkRow({ r }: { r: Req }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="row small">
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{r.signer_email}: <a href={r.link} target="_blank" rel="noreferrer">{absolute(r.link)}</a></span>
      <button onClick={() => { navigator.clipboard?.writeText(absolute(r.link)); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button>
    </div>
  );
}

function Requests({ refresh }: { refresh: number }) {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [audit, setAudit] = useState<{ at: string; event: string; actor: string }[]>([]);
  const load = () => api.runTool("esign", [], { action: "list" }).then((r) => r.ok && setReqs(r.data.requests));
  useEffect(() => {
    load();
    const t = setInterval(load, 4000); // status page updates while the signer works in another tab
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    if (open) api.runTool("esign", [], { action: "status", request_id: open }).then((r) => r.ok && setAudit(r.data.audit));
  }, [open, reqs]);

  if (!reqs.length) return <p className="muted">No signing requests yet.</p>;
  return (
    <table className="small">
      <thead><tr><th>Document</th><th>Signer</th><th>Status</th><th /></tr></thead>
      <tbody>
        {reqs.map((r) => (
          <Fragment key={r.id}>
            <tr>
              <td>{r.title}{r.batch_id && <small className="muted"> · batch {r.batch_id}</small>}</td>
              <td>{r.signer_name || r.signer_email}<br /><small className="muted">{r.signer_email}</small></td>
              <td><span className={`badge ${r.status}`}>{r.status}</span></td>
              <td className="row">
                <button className="link" onClick={() => navigator.clipboard?.writeText(absolute(r.link))}>Copy link</button>
                <button className="link" onClick={() => setOpen(open === r.id ? null : r.id)}>Audit</button>
                {r.signed_file_id && <a className="link" href={fileUrl(r.signed_file_id, true)}>Signed PDF</a>}
              </td>
            </tr>
            {open === r.id && (
              <tr>
                <td colSpan={4}>
                  {audit.map((a, i) => <div key={i}><code>{a.at}</code> {a.event} · {a.actor}</div>)}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

function BrandingForm(props: ToolPanelProps) {
  const { run, busy } = useRun(props);
  const [b, setB] = useState<Branding>({ company: "", color: "#d6342c", logo: null });
  useEffect(() => {
    api.runTool("esign", [], { action: "branding_get" }).then((r) => r.ok && setB(r.data.branding));
  }, []);
  return (
    <div className="stack">
      <label>Company name<input value={b.company} onChange={(e) => setB({ ...b, company: e.target.value })} /></label>
      <label>Colour<input type="color" value={b.color} onChange={(e) => setB({ ...b, color: e.target.value })} /></label>
      <label>Logo
        <input type="file" accept="image/*" onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const r = new FileReader();
          r.onload = () => setB((s) => ({ ...s, logo: r.result as string }));
          r.readAsDataURL(f);
        }} />
      </label>
      <BrandBar b={b} title="Preview of the signing page header" />
      <button className="primary" disabled={busy} onClick={() => run("esign", [], { action: "branding_set", ...b })}>Save branding</button>
    </div>
  );
}

function BrandBar({ b, title }: { b: Branding; title: string }) {
  return (
    <div className="sign-brand" style={{ background: b.color || "#d6342c" }}>
      {b.logo && <img src={b.logo} alt="" />}
      <div><strong>{b.company || "Fill Me"}</strong><div className="small">{title}</div></div>
    </div>
  );
}

function SignPage() {
  const { requestId } = useParams();
  const [req, setReq] = useState<Req | null>(null);
  const [brand, setBrand] = useState<Branding | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.runTool("esign", [], { action: "open", request_id: requestId, user_agent: navigator.userAgent }).then((r) => {
      if (!r.ok) return setErr(r.message);
      setReq(r.data.request);
      setBrand(r.data.branding);
      setName(r.data.request.signer_name || "");
    }).catch((e) => setErr(e.message));
  }, [requestId]);

  if (err) return <div className="sign-page"><div className="result fail">{err}</div></div>;
  if (!req || !brand) return <div className="empty">Loading…</div>;
  const done = req.status === "signed";
  const boxes = req.fields.map((f) => ({
    ...f,
    image: f.kind === "signature" || f.kind === "initials" ? sig : undefined,
    label: f.kind === "date" ? new Date().toLocaleDateString() : f.kind === "name" ? name || "Your name" : LABEL[f.kind],
  }));

  return (
    <div className="sign-page stack">
      <BrandBar b={brand} title={`${req.title} · for ${req.signer_email}`} />
      {req.message && <div className="card">{req.message}</div>}
      {done ? (
        <div className="result ok stack">
          <div className="result-msg">✓ Signed{req.signed_at ? ` on ${new Date(req.signed_at).toLocaleString()}` : ""}.</div>
          {req.signed_file_id && <a className="button" href={fileUrl(req.signed_file_id, true)}>Download signed copy</a>}
        </div>
      ) : req.status === "cancelled" ? (
        <div className="result fail">The sender cancelled this request.</div>
      ) : (
        <div className="card stack">
          <strong>Sign here</strong>
          <label>Your full name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <SignaturePad onChange={setSig} />
          <small className="muted">By signing you agree this electronic signature is your own. This is not a certified digital signature.</small>
          <button className="primary" disabled={busy || !sig || !name.trim()} onClick={async () => {
            setBusy(true);
            const r = await api.runTool("esign", [], { action: "sign", request_id: req.id, signature: sig, name });
            setBusy(false);
            if (!r.ok) return setErr(r.message);
            setReq(r.data.request);
          }}>{busy ? "Signing…" : "Sign document"}</button>
        </div>
      )}
      <PdfPreview fileId={done && req.signed_file_id ? req.signed_file_id : req.file_id} width={700}
        overlay={done ? undefined : (page) => boxes.filter((b) => b.page === page).map((b, i) => (
          <div key={i} className="place-box" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}>
            {b.image ? <img src={b.image} alt="" /> : b.label}
          </div>
        ))} />
    </div>
  );
}

function Panel(props: ToolPanelProps) {
  const [tab, setTab] = useState<"send" | "requests" | "branding">("send");
  const [refresh, setRefresh] = useState(0);
  return (
    <div className="stack">
      <div className="tabs">
        <button className={tab === "send" ? "active" : ""} onClick={() => setTab("send")}>Send</button>
        <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>Status</button>
        <button className={tab === "branding" ? "active" : ""} onClick={() => setTab("branding")}>Branding</button>
      </div>
      {tab === "send" && <Send {...props} onSent={() => setRefresh((n) => n + 1)} />}
      {tab === "requests" && <Requests refresh={refresh} />}
      {tab === "branding" && <BrandingForm {...props} />}
    </div>
  );
}

const tool: ToolUI = {
  id: "esign",
  Panel,
  routes: [{ path: "/sign/:requestId", element: <SignPage /> }],
};
export default tool;
