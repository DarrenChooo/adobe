import { Fragment, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, fileUrl, type RunResult } from "../api";
import PagePlacer, { boxAt, type PlacedBox } from "../components/PagePlacer";
import PdfPreview from "../components/PdfPreview";
import SignaturePad from "../components/SignaturePad";
import { useRun } from "../components/useRun";
import { useApp } from "../shell/app-context";
import type { ToolPaneProps, ToolUI } from "./registry";
import "./esign.css";

type Kind = "signature" | "date" | "name" | "initials";
interface Box extends PlacedBox { kind: Kind }
interface Req {
  id: string; title: string; message: string; file_id: string; status: string; signer_email: string; signer_name: string;
  link: string; created_at: string; viewed_at: string | null; signed_at: string | null;
  signed_file_id: string | null; batch_id: string | null; fields: Box[]; url?: string | null;
}
interface Branding { company: string; color: string; logo: string | null; public_url?: string }

const SIZES: Record<Kind, [number, number]> = { signature: [0.3, 0.07], initials: [0.12, 0.05], date: [0.2, 0.03], name: [0.3, 0.03] };
const LABEL: Record<Kind, string> = { signature: "Signature", initials: "Initials", date: "Date", name: "Full name" };
// The custom URL from Branding when the server set one, else this page's own address.
const absolute = (r: { link: string; url?: string | null }) => r.url || `${window.location.origin}${r.link}`;
const when = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? `Today, ${time}` : `${d.toLocaleDateString()}, ${time}`;
};

/* ---------- Pane: send the open document for signing ---------- */
function SendPane(props: ToolPaneProps) {
  const { run, busy } = useRun(props);
  const { Stage } = props;
  const id = props.file.file_id;
  const navigate = useNavigate();
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
    props.api.runTool("esign", [], { action: "template_list" }).then((r) => r.ok && setTemplates(r.data.templates)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setBoxes([]); setMade([]); }, [id]);

  const send = async () => {
    const base = { fields: boxes.map(({ kind, page, x, y, w, h }) => ({ kind, page, x, y, w, h })), title: title || undefined, message, save_template: saveAs || undefined };
    const res: RunResult = bulk
      ? await run("esign", [id], { action: "bulk", csv, ...base })
      : await run("esign", [id], { action: "create", signer_email: email, signer_name: name, ...base });
    if (res.ok) setMade(res.data.requests);
  };

  return (
    <>
      <Stage>
        <PagePlacer
          fileId={id}
          boxes={boxes}
          onPlace={(page, x, y) => setBoxes((s) => [...s, { ...boxAt(page, x, y, ...SIZES[kind]), kind, label: LABEL[kind] }])}
          onRemove={(i) => setBoxes((s) => s.filter((_, j) => j !== i))}
          onMove={(i, x, y) => setBoxes((s) => s.map((b, j) => (j === i ? { ...b, x, y } : b)))}
          onResize={(i, w, h) => setBoxes((s) => s.map((b, j) => (j === i ? { ...b, w, h } : b)))}
        />
      </Stage>

      <div className="step">
        <h4>1. Place boxes on the page</h4>
        <p className="text">Pick a box type, then click the page where the signer fills it in.</p>
        <div className="seg">
          {(Object.keys(LABEL) as Kind[]).map((k) => (
            <button key={k} type="button" className={kind === k ? "on" : ""} style={{ padding: "6px 4px", whiteSpace: "nowrap" }} onClick={() => setKind(k)}>{k === "name" ? "Name" : LABEL[k]}</button>
          ))}
        </div>
        {templates.length > 0 && (
          <label className="field">Or start from a template
            <select defaultValue="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) setBoxes(t.fields.map((f) => ({ ...f, label: LABEL[f.kind] }))); }}>
              <option value="" disabled>Choose a template...</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        )}
        <p className="hint">{boxes.length ? `${boxes.length} box${boxes.length === 1 ? "" : "es"} placed. Use × to remove one.` : "No boxes yet."}</p>
        <label className="field">Save these boxes as a template <span className="hint">Optional name</span>
          <input value={saveAs} onChange={(e) => setSaveAs(e.target.value)} placeholder="e.g. Tenancy agreement" />
        </label>
      </div>

      <div className="step">
        <h4>2. Who signs</h4>
        <div className="seg">
          <button type="button" className={!bulk ? "on" : ""} onClick={() => setBulk(false)}>One signer</button>
          <button type="button" className={bulk ? "on" : ""} onClick={() => setBulk(true)}>Many (CSV)</button>
        </div>
        {bulk ? (
          <>
            <label className="field">Signers <span className="hint">CSV with columns email,name. One link per row.</span>
              <textarea value={csv} onChange={(e) => setCsv(e.target.value)} />
            </label>
            <label className="field">Or load a CSV file
              <input type="file" accept=".csv,text/csv" style={{ height: "auto", padding: 6 }} onChange={(e) => e.target.files?.[0]?.text().then(setCsv)} />
            </label>
          </>
        ) : (
          <>
            <label className="field">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="signer@example.com" /></label>
            <label className="field">Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          </>
        )}
        <label className="field">Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to the file name" /></label>
        <label className="field">Message to the signer<input value={message} onChange={(e) => setMessage(e.target.value)} /></label>
        <button className="btn primary block" disabled={busy || !boxes.length || (!bulk && !email)} onClick={send}>
          {busy ? "Creating..." : bulk ? "Create signing links" : "Create signing link"}
        </button>
        {!boxes.length ? <p className="hint">Place at least one box first.</p> : null}
      </div>

      {made.length > 0 && (
        <div className="step">
          <h4>Send these links</h4>
          <p className="hint">No email is sent. Copy each link to the signer.</p>
          {made.map((r) => <LinkRow key={r.id} r={r} />)}
          <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => navigate("/agreements")}>See all agreements</button>
        </div>
      )}
    </>
  );
}

function LinkRow({ r }: { r: Req }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card stack esign-link" style={{ padding: "10px 12px", gap: 6 }}>
      <span className="small"><b>{r.signer_name || r.signer_email}</b></span>
      <a className="mono" href={r.link} target="_blank" rel="noreferrer">{absolute(r)}</a>
      <button type="button" className="btn small" style={{ alignSelf: "flex-start" }}
        onClick={() => { navigator.clipboard?.writeText(absolute(r)).catch(() => {}); setCopied(true); }}>
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

/* ---------- /agreements: every request and its status ---------- */
function AgreementsPage() {
  const ctx = useApp();
  const navigate = useNavigate();
  const [editBrand, setEditBrand] = useState(false);
  return (
    <div className="setup">
      <div className="setup-head" style={{ justifyContent: "space-between" }}>
        <h1>Agreements</h1>
        <button className="btn primary" onClick={() => navigate("/pick/esign")}>Request e-signatures</button>
      </div>
      <p className="lead">Every document you've sent for signing, and where each one is up to. This page updates on its own while people sign.</p>
      <Requests />
      <div className="sect" style={{ marginTop: 16 }}>
        <h3>Branding on signing pages</h3>
        <p className="text" style={{ marginBottom: editBrand ? 14 : 0 }}>
          Your company name, colour and logo appear at the top of every signing link.{" "}
          {!editBrand && <button className="link-btn" style={{ fontSize: 14 }} onClick={() => setEditBrand(true)}>Edit branding</button>}
        </p>
        {editBrand && <BrandingForm {...ctx} />}
      </div>
    </div>
  );
}

function Requests() {
  const [reqs, setReqs] = useState<Req[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [audit, setAudit] = useState<{ at: string; event: string; actor: string }[]>([]);
  const load = () => api.runTool("esign", [], { action: "list" }).then((r) => r.ok && setReqs(r.data.requests)).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 4000); // the table updates while the signer works in another tab
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (open) api.runTool("esign", [], { action: "status", request_id: open }).then((r) => r.ok && setAudit(r.data.audit)).catch(() => {});
  }, [open, reqs]);

  if (!reqs) return <p className="hint">Loading...</p>;
  if (!reqs.length) return <div className="table-card"><div className="empty-state">Nothing sent for signing yet. Press Request e-signatures to start.</div></div>;
  return (
    <div className="table-card">
      <table>
        <thead><tr><th>Document</th><th>Signer</th><th>Status</th><th>Sent</th><th /></tr></thead>
        <tbody>
          {reqs.map((r) => (
            <Fragment key={r.id}>
              <tr>
                <td>
                  <div className="file-cell"><span className="pdf-ico">PDF</span>{r.title}</div>
                  {r.batch_id && <span className="hint">Batch {r.batch_id}</span>}
                </td>
                <td>{r.signer_name || r.signer_email}<br /><span className="hint">{r.signer_email}</span></td>
                <td><span className={`status ${r.status}`}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span></td>
                <td className="small">{when(r.created_at)}</td>
                <td>
                  <div className="row" style={{ gap: 12 }}>
                    <button className="link-btn" onClick={() => { navigator.clipboard?.writeText(absolute(r)).catch(() => {}); setCopied(r.id); }}>
                      {copied === r.id ? "Copied" : "Copy link"}
                    </button>
                    <button className="link-btn" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Hide history" : "History"}</button>
                    {r.signed_file_id && <a className="link-btn" style={{ textDecoration: "none" }} href={fileUrl(r.signed_file_id, true)}>Download signed</a>}
                  </div>
                </td>
              </tr>
              {open === r.id && (
                <tr>
                  <td colSpan={5} style={{ background: "var(--app)" }}>
                    <ul className="list small">
                      {audit.map((a, i) => <li key={i}><span className="mono">{when(a.at)}</span> {a.event} <span className="hint">by {a.actor}</span></li>)}
                    </ul>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BrandingForm(props: Pick<ToolPaneProps, "api" | "onResult">) {
  const { run, busy } = useRun(props);
  const [b, setB] = useState<Branding>({ company: "", color: "#d6342c", logo: null, public_url: "" });
  useEffect(() => {
    api.runTool("esign", [], { action: "branding_get" }).then((r) => r.ok && setB(r.data.branding)).catch(() => {});
  }, []);
  return (
    <div className="stack">
      <div className="form2">
        <label className="field">Company name<input value={b.company} onChange={(e) => setB({ ...b, company: e.target.value })} /></label>
        <label className="field">Custom signing address <span className="hint">Optional. Where you host Fill Me, e.g. https://sign.example.com</span>
          <input value={b.public_url ?? ""} placeholder={window.location.origin} onChange={(e) => setB({ ...b, public_url: e.target.value })} />
        </label>
        <label className="field">Colour<input type="color" value={b.color} style={{ padding: 2, width: 80 }} onChange={(e) => setB({ ...b, color: e.target.value })} /></label>
        <label className="field">Logo
          <input type="file" accept="image/*" style={{ height: "auto", padding: 6 }} onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => setB((s) => ({ ...s, logo: r.result as string }));
            r.readAsDataURL(f);
          }} />
        </label>
      </div>
      <BrandBar b={b} title="Preview of the top of the signing page" />
      <div><button className="btn primary" disabled={busy} onClick={() => run("esign", [], { action: "branding_set", ...b })}>Save branding</button></div>
    </div>
  );
}

function BrandBar({ b, title }: { b: Branding; title: string }) {
  return (
    <div className="esign-brand" style={{ background: b.color || "#d6342c" }}>
      {b.logo && <img src={b.logo} alt="" />}
      <div><strong>{b.company || "Fill Me"}</strong><div className="small">{title}</div></div>
    </div>
  );
}

/* ---------- /sign/:requestId: the page the signer opens ---------- */
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

  if (err) return <div className="public"><div className="msg err">{err}</div></div>;
  if (!req || !brand) return <div className="public"><p className="hint">Loading...</p></div>;
  const done = req.status === "signed";
  const boxes = req.fields.map((f) => ({
    ...f,
    image: f.kind === "signature" || f.kind === "initials" ? sig : undefined,
    label: f.kind === "date" ? new Date().toLocaleDateString() : f.kind === "name" ? name || "Your name" : LABEL[f.kind],
  }));

  return (
    <div className="public stack">
      <BrandBar b={brand} title={`${req.title} · for ${req.signer_email}`} />
      {req.message && <div className="card text">{req.message}</div>}
      {done ? (
        <div className="msg ok stack">
          <b>Signed{req.signed_at ? ` on ${new Date(req.signed_at).toLocaleString()}` : ""}.</b>
          {req.signed_file_id && <div><a className="btn primary" href={fileUrl(req.signed_file_id, true)}>Download signed copy</a></div>}
        </div>
      ) : req.status === "cancelled" ? (
        <div className="msg err">The sender cancelled this request.</div>
      ) : (
        <div className="card stack">
          <h3 style={{ fontSize: 16 }}>Sign here</h3>
          <label className="field">Your full name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div style={{ maxWidth: 420 }}><SignaturePad onChange={setSig} /></div>
          <p className="hint">By signing you agree this electronic signature is your own. This is not a certified digital signature.</p>
          <div>
            <button className="btn primary" disabled={busy || !sig || !name.trim()} onClick={async () => {
              setBusy(true);
              try {
                const r = await api.runTool("esign", [], { action: "sign", request_id: req.id, signature: sig, name });
                if (!r.ok) return setErr(r.message);
                setReq(r.data.request);
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}>{busy ? "Signing..." : "Sign document"}</button>
          </div>
        </div>
      )}
      <div className="esign-doc">
        <PdfPreview fileId={done && req.signed_file_id ? req.signed_file_id : req.file_id} width={700}
          overlay={done ? undefined : (page) => boxes.filter((b) => b.page === page).map((b, i) => (
            <div key={i} className="pro-place" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}>
              {b.image ? <img src={b.image} alt="" /> : b.label}
            </div>
          ))} />
      </div>
    </div>
  );
}

const tool: ToolUI = {
  id: "esign",
  Pane: SendPane,
  routes: [
    { path: "/agreements", frame: "home", element: <AgreementsPage /> },
    { path: "/sign/:requestId", frame: "none", element: <SignPage /> },
  ],
};
export default tool;
