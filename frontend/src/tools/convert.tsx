import { useState } from "react";
import type { ToolPanelProps, ToolUI } from "./registry";
import "./pro/pro.css";

const TARGETS = [
  { id: "docx", label: "PDF to Word", needs: "one PDF" },
  { id: "xlsx", label: "PDF tables to Excel", needs: "one PDF" },
  { id: "png", label: "PDF to images (one per page)", needs: "one PDF" },
  { id: "txt", label: "PDF to plain text", needs: "one PDF" },
  { id: "pdf", label: "Images to one PDF", needs: "one or more images" },
  { id: "office", label: "Word/Excel/PowerPoint to PDF", needs: "one Office file (needs LibreOffice)" },
];

function ConvertPanel({ selectedFileIds, api, onResult }: ToolPanelProps) {
  const [target, setTarget] = useState("docx");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const chosen = TARGETS.find((t) => t.id === target)!;

  const run = async () => {
    setBusy(true); setMsg(null);
    const res = await api.runTool("convert", selectedFileIds, { target });
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: res.message });
    setMsg({ kind: "good", text: res.message });
    onResult(res);
  };

  return (
    <div className="pro-panel">
      <div className="pro-form">
        {TARGETS.map((t) => (
          <label key={t.id} className="check">
            <input type="radio" name="pro-convert" checked={target === t.id} onChange={() => setTarget(t.id)} /> {t.label}
          </label>
        ))}
      </div>
      <p className="pro-help">Needs {chosen.needs}. {selectedFileIds.length} selected.</p>
      <div className="pro-row">
        <button className="pro-btn" onClick={run} disabled={busy || selectedFileIds.length === 0}>{busy ? "Converting..." : "Convert"}</button>
      </div>
      {msg ? <div className={`pro-msg ${msg.kind}`}>{msg.text}</div> : null}
    </div>
  );
}

const tool: ToolUI = { id: "convert", Panel: ConvertPanel, routes: [] };
export default tool;
