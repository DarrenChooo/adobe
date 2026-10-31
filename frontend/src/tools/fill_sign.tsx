import { useEffect, useState } from "react";
import PagePlacer, { boxAt, type PlacedBox } from "../components/PagePlacer";
import SignaturePad from "../components/SignaturePad";
import { useRun } from "../components/useRun";
import type { ToolPaneProps, ToolUI } from "./registry";

type Anchor = { page: number; x: number; y: number; w: number; h: number } | null;
interface Stamp extends PlacedBox { kind: "image" | "text"; text?: string }

// Signatures you've saved with before, newest first. Kept in this browser only.
const SIGS_KEY = "fillme.signatures";
function loadSigs(): string[] {
  try { return JSON.parse(localStorage.getItem(SIGS_KEY) ?? "[]"); } catch { return []; }
}
function rememberSig(sig: string) {
  try { localStorage.setItem(SIGS_KEY, JSON.stringify([sig, ...loadSigs().filter((s) => s !== sig)].slice(0, 5))); } catch {}
}
const today = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

interface Field {
  name: string;
  tooltip: string | null;
  type: string;
  value: string | null;
  options: string[] | null;
  on_value: string | null;
  page: number;
}

function FillSignPane(props: ToolPaneProps) {
  const { api, Stage } = props;
  const { run, busy } = useRun(props);
  const id = props.file.file_id;
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [saved, setSaved] = useState<string[]>(loadSigs);
  const [sig, setSig] = useState<string | null>(() => loadSigs()[0] ?? null);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [anchors, setAnchors] = useState<{ signature: Anchor; date: Anchor }>({ signature: null, date: null });
  const [dateText, setDateText] = useState(today);
  const [flatten, setFlatten] = useState(false);
  const [loadMsg, setLoadMsg] = useState("Reading the form...");
  const [loadOk, setLoadOk] = useState(true);

  useEffect(() => {
    setFields([]); setValues({}); setStamps([]); setLoadMsg("Reading the form..."); setLoadOk(true);
    api.runTool("fill_sign", [id], { action: "list" }).then((r) => {
      setLoadMsg(r.message);
      setLoadOk(r.ok);
      if (!r.ok) return;
      const fs: Field[] = r.data.fields;
      setFields(fs);
      setValues(Object.fromEntries(fs.map((f) => [f.name, f.type === "checkbox" ? !!f.value && f.value !== "/Off" : f.value ?? ""])));
      const a = r.data.anchors ?? { signature: null, date: null };
      setAnchors(a);
      // Autofill: drop your last signature and today's date onto the form's Signature/Date lines.
      const last = loadSigs()[0];
      const auto: Stamp[] = [];
      if (last && a.signature) auto.push({ ...a.signature, kind: "image", image: last });
      if (last && a.date) auto.push({ ...a.date, kind: "text", text: today(), editable: true });
      setStamps(auto);
    }).catch((e: Error) => { setLoadMsg(e.message); setLoadOk(false); });
  }, [api, id]);

  const addDate = () =>
    setStamps((s) => [...s, { ...(anchors.date ?? { page: 1, x: 0.6, y: 0.85, w: 0.16, h: 0.025 }), kind: "text", text: dateText, editable: true }]);
  const useSig = (s: string) => {
    setSig(s);
    // Swap the picked signature into any signature already on the page.
    setStamps((st) => st.map((x) => (x.kind === "image" ? { ...x, image: s } : x)));
  };

  const changed = Object.fromEntries(
    Object.entries(values).filter(([k, v]) => {
      const f = fields.find((x) => x.name === k)!;
      return f.type === "checkbox" ? v !== (!!f.value && f.value !== "/Off") : v !== (f.value ?? "");
    }),
  );
  const nChanged = Object.keys(changed).length;
  const shown = fields.filter((f) => !["signature", "button", "radio"].includes(f.type));

  return (
    <>
      <Stage>
        <PagePlacer
          fileId={id}
          boxes={stamps}
          onPlace={(page, x, y) => sig && setStamps((s) => [...s, { ...boxAt(page, x, y, 0.3, 0.07), kind: "image", image: sig }])}
          onRemove={(i) => setStamps((s) => s.filter((_, j) => j !== i))}
          onMove={(i, x, y) => setStamps((s) => s.map((b, j) => (j === i ? { ...b, x, y } : b)))}
          onResize={(i, w, h) => setStamps((s) => s.map((b, j) => (j === i ? { ...b, w, h } : b)))}
          onEdit={(i, t) => setStamps((s) => s.map((b, j) => (j === i ? { ...b, text: t } : b)))}
        />
      </Stage>

      <div className="step">
        <h4>1. Fill in the fields</h4>
        {!loadOk ? <div className="msg err">{loadMsg}</div> : shown.length ? null : <p className="hint">{loadMsg}</p>}
        {shown.map((f) => f.type === "checkbox" ? (
          <label key={f.name} className="check">
            <input type="checkbox" checked={!!values[f.name]} onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.checked }))} />
            {f.tooltip || f.name}
          </label>
        ) : (
          <label key={f.name} className="field">
            <span>{f.tooltip || f.name} <span className="hint">· page {f.page}</span></span>
            {f.options ? (
              <select value={values[f.name] as string} onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}>
                <option value="" />
                {f.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input value={values[f.name] as string} onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))} />
            )}
          </label>
        ))}
        {shown.length > 0 && (
          <label className="check">
            <input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} />
            Lock the answers so they can't be changed
          </label>
        )}
      </div>

      <div className="step">
        <h4>2. Sign</h4>
        {saved.length > 0 && (
          <div className="stack">
            <span className="hint">Your saved signatures (click one to use it)</span>
            <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
              {saved.map((s) => (
                <button key={s} type="button" onClick={() => useSig(s)} title="Use this signature"
                  style={{ padding: 4, background: "#fff", borderRadius: 6, border: s === sig ? "2px solid var(--blue)" : "1px solid #ccc", cursor: "pointer" }}>
                  <img src={s} alt="Saved signature" style={{ height: 36, display: "block" }} />
                </button>
              ))}
            </div>
          </div>
        )}
        <SignaturePad onChange={(s) => s && setSig(s)} />
        <div className={`msg ${sig ? "info" : ""}`} style={sig ? undefined : { padding: 0 }}>
          {sig ? "Click the page to place your signature. Drag it to move." : <span className="hint">Draw or type a signature, then click the page to place it.</span>}
        </div>

        <div className="row" style={{ gap: 6, alignItems: "center" }}>
          <input className="inp" value={dateText} onChange={(e) => setDateText(e.target.value)} aria-label="Date to add" style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={addDate}>Add date</button>
        </div>
        {stamps.length ? (
          <p className="hint">
            {stamps.filter((s) => s.kind === "image").length} signature(s), {stamps.filter((s) => s.kind === "text").length} date(s) on the page
            {anchors.signature || anchors.date ? ", placed on the form's Signature/Date lines" : ""}. Drag to move, × to remove.
          </p>
        ) : null}
      </div>

      <div className="step">
        <button
          className="btn primary block"
          disabled={busy || (!nChanged && !stamps.length)}
          onClick={() => {
            // Remember what you signed with, placed or not, so it comes back next time.
            if (sig) rememberSig(sig);
            stamps.forEach((s) => s.kind === "image" && s.image && rememberSig(s.image));
            setSaved(loadSigs());
            run("fill_sign", [id], {
              action: "fill",
              values: changed,
              flatten,
              stamps: stamps.map(({ page, x, y, w, h, kind, image, text }) =>
                kind === "image" ? { page, x, y, w, h, kind, image } : { page, x, y, w, h, kind, text, font_size: 11 }),
            });
          }}
        >
          {busy ? "Saving..." : "Save"}
        </button>
        <p className="hint">
          {nChanged} field{nChanged === 1 ? "" : "s"} changed, {stamps.length} item{stamps.length === 1 ? "" : "s"} on the page.
        </p>
      </div>
    </>
  );
}

const tool: ToolUI = { id: "fill_sign", Pane: FillSignPane };
export default tool;
