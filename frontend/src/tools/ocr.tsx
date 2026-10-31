import { useState } from "react";
import type { ToolUI } from "./registry";
import type { ApiLike, RunResult } from "./pro/types";
import "./pro/pro.css";

function OcrPanel({ selectedFileIds, api, onResult }: { selectedFileIds: string[]; api: ApiLike; onResult: (r: RunResult) => void }) {
  const [dpi, setDpi] = useState(300);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);

  if (selectedFileIds.length !== 1) return <p className="pro-help">Select one scanned PDF.</p>;

  const run = async () => {
    setBusy(true); setMsg(null);
    const res = await api.runTool("ocr", selectedFileIds, { dpi, force });
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: res.message });
    setMsg({ kind: "good", text: `${res.message} Took ${res.data.seconds} s. You can now search and copy text.` });
    onResult(res);
  };

  return (
    <div className="pro-panel">
      <p className="pro-help">Reads the words off scanned pages and adds invisible text behind them, so the PDF becomes searchable.</p>
      <div className="pro-row">
        <label>
          Quality{" "}
          <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
            <option value={200}>Faster (200 dpi)</option>
            <option value={300}>Better (300 dpi)</option>
          </select>
        </label>
        <label className="pro-row">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> Redo pages that already have text
        </label>
      </div>
      <div className="pro-row">
        <button className="pro-btn" onClick={run} disabled={busy}>{busy ? "Reading pages..." : "Make searchable"}</button>
      </div>
      {msg ? <div className={`pro-msg ${msg.kind}`}>{msg.text}</div> : null}
    </div>
  );
}

const tool: ToolUI = { id: "ocr", Panel: OcrPanel, routes: [] };
export default tool;
