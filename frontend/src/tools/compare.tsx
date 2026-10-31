import { useState } from "react";
import type { ToolUI } from "./registry";
import type { ApiLike, RunResult } from "./pro/types";
import "./pro/pro.css";

type Change = { type: string; page_a: number | null; page_b: number | null; before: string[]; after: string[] };

function ComparePanel({ selectedFileIds, api, onResult }: { selectedFileIds: string[]; api: ApiLike; onResult: (r: RunResult) => void }) {
  const [swapped, setSwapped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);

  if (selectedFileIds.length !== 2) return <p className="pro-help">Select exactly two PDFs: the old version and the new version.</p>;
  const [oldId, newId] = swapped ? [selectedFileIds[1], selectedFileIds[0]] : selectedFileIds;

  const run = async () => {
    setBusy(true); setMsg(null);
    const res = await api.runTool("compare", [oldId, newId], {});
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: res.message });
    setChanges(res.data.text_changes as Change[]);
    setMsg({ kind: "good", text: res.message + " The report shows old on the left, new on the right, changes boxed in red." });
    onResult(res);
  };

  return (
    <div className="pro-panel">
      <div className="pro-row">
        <span className="pro-chip">Old: file {swapped ? 2 : 1}</span>
        <span className="pro-chip">New: file {swapped ? 1 : 2}</span>
        <button className="pro-btn ghost" onClick={() => setSwapped((s) => !s)}>Swap</button>
        <button className="pro-btn" onClick={run} disabled={busy}>{busy ? "Comparing..." : "Compare"}</button>
      </div>
      {msg ? <div className={`pro-msg ${msg.kind}`}>{msg.text}</div> : null}
      {changes.map((c, i) => (
        <div key={i}>
          <div className="pro-row">
            <span className="pro-chip">{c.type}</span>
            <span className="pro-help">page {c.page_a ?? "-"} (old) / {c.page_b ?? "-"} (new)</span>
          </div>
          <div className="pro-diff">
            <div>{c.before.map((l, j) => <div key={j} className="before">{l}</div>)}</div>
            <div>{c.after.map((l, j) => <div key={j} className="after">{l}</div>)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const tool: ToolUI = { id: "compare", Panel: ComparePanel, routes: [] };
export default tool;
