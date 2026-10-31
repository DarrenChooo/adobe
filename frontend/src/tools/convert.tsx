import { useState } from "react";
import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";

const TARGETS = [
  { id: "docx", label: "Word", hint: "An editable .docx with the text, images and layout." },
  { id: "xlsx", label: "Excel", hint: "The tables found in the PDF, one sheet each (.xlsx)." },
  { id: "png", label: "Images", hint: "One PNG picture per page." },
  { id: "txt", label: "Plain text", hint: "Just the words, as a .txt file." },
];

const tool: ToolUI = {
  id: "convert",
  Pane: (props) => {
    const { run, busy } = useRun(props);
    const [target, setTarget] = useState("docx");
    const [err, setErr] = useState("");
    const chosen = TARGETS.find((t) => t.id === target)!;
    const go = async () => {
      setErr("");
      const res = await run("convert", [props.file.file_id], { target });
      if (!res.ok) setErr(res.message);
    };
    return (
      <>
        <div className="step">
          <h4>Export to</h4>
          {TARGETS.map((t) => (
            <label key={t.id} className="check">
              <input type="radio" name="convert-target" checked={target === t.id} onChange={() => setTarget(t.id)} /> {t.label}
            </label>
          ))}
          <p className="hint">{chosen.hint} It's offered as a download when ready.</p>
        </div>
        <div className="step">
          {err && <div className="msg err">{err}</div>}
          <button className="btn primary block" disabled={busy} onClick={go}>{busy ? "Exporting…" : `Export to ${chosen.label}`}</button>
        </div>
      </>
    );
  },
};
export default tool;
