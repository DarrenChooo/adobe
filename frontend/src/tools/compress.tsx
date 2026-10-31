import { useState } from "react";
import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";

const LEVELS = [
  { id: "low", label: "Low", hint: "Smallest change. Images stay sharp; good for documents you will print." },
  { id: "medium", label: "Medium", hint: "A good balance. Images are lightly shrunk; fine for email and screens." },
  { id: "high", label: "High", hint: "Smallest file. Images are shrunk the most; text stays crisp." },
];

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const tool: ToolUI = {
  id: "compress",
  Pane: (props) => {
    const { run, busy } = useRun(props);
    const [level, setLevel] = useState("medium");
    const [err, setErr] = useState("");
    const chosen = LEVELS.find((l) => l.id === level)!;
    const go = async () => {
      setErr("");
      const res = await run("compress", [props.file.file_id], { level });
      if (!res.ok) setErr(res.message);
    };
    return (
      <>
        <div className="step">
          <h4>How much to compress</h4>
          <div className="seg">
            {LEVELS.map((l) => (
              <button key={l.id} className={level === l.id ? "on" : ""} onClick={() => setLevel(l.id)}>{l.label}</button>
            ))}
          </div>
          <p className="hint">{chosen.hint}</p>
        </div>
        <div className="step">
          <p className="hint">This file is {kb(props.file.size)}. You get a new copy; the result is never bigger than the original.</p>
          {err && <div className="msg err">{err}</div>}
          <button className="btn primary block" disabled={busy} onClick={go}>{busy ? "Compressing…" : "Compress"}</button>
        </div>
      </>
    );
  },
};
export default tool;
