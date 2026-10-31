import { useState } from "react";
import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";

const tool: ToolUI = {
  id: "split",
  Panel: (props) => {
    const { run, busy } = useRun(props);
    const [mode, setMode] = useState<"ranges" | "every">("ranges");
    const [ranges, setRanges] = useState("1-2,3-");
    const [every, setEvery] = useState(1);
    const id = props.selectedFileIds[props.selectedFileIds.length - 1];
    const f = props.files.find((x) => x.file_id === id);
    return (
      <div className="stack">
        <p className="muted">{f ? `Splitting ${f.filename} (${f.pages} pages).` : "Select one PDF."}</p>
        <div className="tabs">
          <button className={mode === "ranges" ? "active" : ""} onClick={() => setMode("ranges")}>By ranges</button>
          <button className={mode === "every" ? "active" : ""} onClick={() => setMode("every")}>Every N pages</button>
        </div>
        {mode === "ranges" ? (
          <label>Ranges <small className="muted">e.g. 1-3,5,7- (one file per range)</small>
            <input value={ranges} onChange={(e) => setRanges(e.target.value)} />
          </label>
        ) : (
          <label>Pages per file<input type="number" min={1} value={every} onChange={(e) => setEvery(Number(e.target.value))} /></label>
        )}
        <button className="primary" disabled={busy || !f} onClick={() => run("split", [id], { mode, ranges, every })}>
          {busy ? "Splitting…" : "Split"}
        </button>
      </div>
    );
  },
};
export default tool;
