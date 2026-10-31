import { useState } from "react";
import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";

const tool: ToolUI = {
  id: "compress",
  Panel: (props) => {
    const { run, busy } = useRun(props);
    const [level, setLevel] = useState("medium");
    const id = props.selectedFileIds[props.selectedFileIds.length - 1];
    return (
      <div className="stack">
        <div className="tabs">
          {["low", "medium", "high"].map((l) => (
            <button key={l} className={level === l ? "active" : ""} onClick={() => setLevel(l)}>{l[0].toUpperCase() + l.slice(1)}</button>
          ))}
        </div>
        <p className="muted small">Low keeps images sharp; high shrinks them most. The result never comes back bigger than the original.</p>
        <button className="primary" disabled={busy || !id} onClick={() => run("compress", [id], { level })}>
          {busy ? "Compressing…" : "Compress"}
        </button>
      </div>
    );
  },
};
export default tool;
