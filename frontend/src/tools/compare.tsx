import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PdfPreview from "../components/PdfPreview";
import { ToolTile } from "../shell/catalog";
import type { RunResult } from "../api";
import type { ToolContext, ToolUI } from "./registry";
import "./compare.css";

type Change = { type: string; page_a: number | null; page_b: number | null; before: string[]; after: string[] };

const isPdf = (name: string) => /\.pdf$/i.test(name);

function Slot({ title, fileId, ctx, onPick }: { title: string; fileId: string; ctx: ToolContext; onPick: (id: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const chosen = ctx.files.find((f) => f.file_id === fileId);
  const pdfs = ctx.files.filter((f) => isPdf(f.filename));

  const uploadOne = async (list: FileList | null) => {
    if (!list?.length) return;
    if (!isPdf(list[0].name)) return setError("That isn't a PDF. Drop or upload a .pdf file.");
    setError("");
    try {
      const [info] = await ctx.upload([list[0]]);
      if (info) onPick(info.file_id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div
      className="compare-slot"
      style={over ? { outline: "3px dashed var(--blue)", outlineOffset: -6 } : undefined}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); uploadOne(e.dataTransfer.files); }}
    >
      <h3>{title}</h3>
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { uploadOne(e.target.files); e.target.value = ""; }} />
      {chosen ? (
        <>
          <div className="compare-thumb"><PdfPreview fileId={chosen.file_id} page={1} width={120} /></div>
          <div className="compare-name">{chosen.filename}</div>
          <button className="btn block" onClick={() => onPick("")}>Change file</button>
        </>
      ) : (
        <>
          <div className="compare-thumb">
            <button className="btn" onClick={() => input.current?.click()}>Upload a PDF</button>
            <span className="hint" style={{ display: "block", marginTop: 6 }}>or drop it here</span>
          </div>
          {pdfs.length > 0 && (
            <label className="field">
              Or choose one you've opened
              <select value="" onChange={(e) => onPick(e.target.value)}>
                <option value="">Choose a file…</option>
                {pdfs.map((f) => <option key={f.file_id} value={f.file_id}>{f.filename}</option>)}
              </select>
            </label>
          )}
        </>
      )}
      {error && <div className="msg err">{error}</div>}
    </div>
  );
}

function ComparePage(ctx: ToolContext) {
  const navigate = useNavigate();
  const [oldId, setOldId] = useState("");
  const [newId, setNewId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [report, setReport] = useState<RunResult | null>(null);

  const pick = (which: "old" | "new") => (id: string) => {
    (which === "old" ? setOldId : setNewId)(id);
    setMsg(null);
    setChanges(null);
    setReport(null);
  };

  const run = async () => {
    setBusy(true);
    setMsg(null);
    setChanges(null);
    setReport(null);
    try {
      const res = await ctx.api.runTool("compare", [oldId, newId], {});
      if (!res.ok) {
        setMsg({ ok: false, text: res.message });
        return;
      }
      const list = (res.data.text_changes as Change[]) ?? [];
      setChanges(list);
      setReport(res);
      // Opening the report leaves this page, so show the changes first when there are any.
      if (!list.length) ctx.onResult(res);
      else setMsg({ ok: true, text: `${res.message} The report shows old on the left and new on the right, with changes boxed in red.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const ready = oldId && newId && oldId !== newId;

  return (
    <div className="setup">
      <div className="setup-head"><ToolTile id="compare" /><h1>Compare files</h1></div>
      <p className="lead">Pick the older version on the left and the newer one on the right.</p>
      <div className="compare-slots">
        <Slot title="Old file" fileId={oldId} ctx={ctx} onPick={pick("old")} />
        <button className="compare-swap" title="Swap old and new" aria-label="Swap old and new" disabled={!oldId && !newId}
          onClick={() => { setOldId(newId); setNewId(oldId); setChanges(null); setMsg(null); setReport(null); }}>⇄</button>
        <Slot title="New file" fileId={newId} ctx={ctx} onPick={pick("new")} />
      </div>

      <div className="setup-bar compare-bar">
        <span className="hint">
          {oldId && newId && oldId === newId ? "Pick two different files." : ready ? "Changes will be boxed in red in a side-by-side report." : "Pick both files to compare."}
        </span>
        <div className="row">
          <button className="btn" onClick={() => navigate(-1)}>Cancel</button>
          <button className="btn primary" disabled={!ready || busy} onClick={run}>{busy ? "Comparing…" : "Compare"}</button>
        </div>
      </div>

      {msg && (
        <div className={`msg ${msg.ok ? "ok" : "err"} compare-bar compare-result`}>
          <span>{msg.text}</span>
          {report && <button className="btn primary small" onClick={() => ctx.onResult(report)}>Open the report</button>}
        </div>
      )}

      {changes && changes.length > 0 && (
        <div className="compare-changes">
          <h3 style={{ margin: 0, fontSize: 15 }}>Text changes</h3>
          {changes.map((c, i) => (
            <div key={i} className="compare-change">
              <div className="compare-change-head">
                <span className="chip">{c.type}</span>
                <span className="hint">Page {c.page_a ?? "-"} in the old file, page {c.page_b ?? "-"} in the new file</span>
              </div>
              <div className="compare-diff">
                <div>{c.before.length ? c.before.map((l, j) => <span key={j} className="compare-before">{l}</span>) : <span className="compare-none">Nothing before</span>}</div>
                <div>{c.after.length ? c.after.map((l, j) => <span key={j} className="compare-after">{l}</span>) : <span className="compare-none">Removed</span>}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const tool: ToolUI = { id: "compare", Page: ComparePage };
export default tool;
