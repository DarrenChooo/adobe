import { useState } from "react";
import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";

const tool: ToolUI = {
  id: "split",
  Pane: (props) => {
    const { run, busy } = useRun(props);
    const [mode, setMode] = useState<"ranges" | "every">("ranges");
    const [ranges, setRanges] = useState("1-2,3-");
    const [every, setEvery] = useState(1);
    const [err, setErr] = useState("");
    const pages = props.file.pages;
    const parts = mode === "ranges"
      ? ranges.split(",").filter((r) => r.trim()).length
      : every >= 1 ? Math.ceil(pages / every) : 0;
    const go = async () => {
      setErr("");
      const res = await run("split", [props.file.file_id], { mode, ranges, every });
      if (!res.ok) setErr(res.message);
    };
    return (
      <>
        <div className="step">
          <h4>How to split</h4>
          <div className="seg">
            <button className={mode === "ranges" ? "on" : ""} onClick={() => setMode("ranges")}>By page ranges</button>
            <button className={mode === "every" ? "on" : ""} onClick={() => setMode("every")}>Every N pages</button>
          </div>
        </div>
        <div className="step">
          {mode === "ranges" ? (
            <>
              <label className="field">Page ranges
                <input value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3,5,7-" />
              </label>
              <p className="hint">One new PDF per range, separated by commas. Example: <code>1-3,5,7-</code> makes three files: pages 1 to 3, page 5, and page 7 to the end.</p>
            </>
          ) : (
            <>
              <label className="field">Pages in each file
                <input type="number" min={1} max={pages || undefined} value={every} onChange={(e) => setEvery(Number(e.target.value))} />
              </label>
              <p className="hint">Example: with 2, a 6-page PDF becomes three 2-page files.</p>
            </>
          )}
        </div>
        <div className="step">
          <p className="hint">This document has {pages} {pages === 1 ? "page" : "pages"}.</p>
          {err && <div className="msg err">{err}</div>}
          <button className="btn primary block" disabled={busy || parts < 1} onClick={go}>
            {busy ? "Splitting…" : parts < 1 ? (mode === "ranges" ? "Enter at least one range" : "Enter 1 or more pages") : `Split into ${parts} ${parts === 1 ? "file" : "files"}`}
          </button>
        </div>
      </>
    );
  },
};
export default tool;
