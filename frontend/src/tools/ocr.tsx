import { useState } from "react";
import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";

const tool: ToolUI = {
  id: "ocr",
  Pane: (props) => {
    const { run, busy } = useRun(props);
    const [dpi, setDpi] = useState(300);
    const [force, setForce] = useState(false);
    const [err, setErr] = useState("");
    const go = async () => {
      setErr("");
      const res = await run("ocr", [props.file.file_id], { dpi, force });
      if (!res.ok) setErr(res.message);
    };
    return (
      <>
        <div className="step">
          <p className="text">Reads the words off scanned pages and adds hidden text behind them, so you can search and copy.</p>
        </div>
        <div className="step">
          <label className="field">Quality
            <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
              <option value={200}>Faster (200 dpi)</option>
              <option value={300}>Better (300 dpi)</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> Redo pages that already have text
          </label>
          <p className="hint">Leave this off unless the existing text is wrong. Expect a few seconds per page.</p>
        </div>
        <div className="step">
          {err && <div className="msg err">{err}</div>}
          <button className="btn primary block" disabled={busy} onClick={go}>{busy ? "Reading pages…" : "Make searchable"}</button>
        </div>
      </>
    );
  },
};
export default tool;
