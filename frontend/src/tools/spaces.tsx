import { useEffect, useState } from "react";
import type { ToolPanelProps, ToolUI } from "./registry";

interface Space {
  id: string;
  name: string;
  notes: string;
  files: { file_id: string; filename: string }[];
}

interface Citation {
  file: string;
  page: number;
  quote: string;
  verified: boolean;
}

interface Answer {
  found: boolean;
  answer: string;
  citations: Citation[];
  all_verified: boolean;
}

function Panel({ selectedFileIds, api }: ToolPanelProps) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const space = spaces.find((s) => s.id === spaceId);

  const call = async (fileIds: string[], params: Record<string, unknown>) => {
    setBusy(true);
    setStatus("");
    try {
      const res = await api.runTool("spaces", fileIds, params);
      if (!res.ok) setStatus(res.message);
      return res.ok ? res : null;
    } catch (e) {
      setStatus((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const merge = (updated: Space) =>
    setSpaces((all) => [...all.filter((s) => s.id !== updated.id), updated]);

  useEffect(() => {
    call([], { action: "list" }).then((res) => { if (res) setSpaces(res.data.spaces); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setNotes(space?.notes ?? ""); setAnswer(null); }, [spaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    const res = await call(selectedFileIds, { action: "create", name });
    if (res) {
      merge(res.data.space);
      setSpaceId(res.data.space.id);
      setName("");
    }
  };

  const addSelected = async () => {
    const res = await call(selectedFileIds, { action: "add_files", space_id: spaceId });
    if (res) merge(res.data.space);
  };

  const saveNotes = async () => {
    const res = await call([], { action: "save_notes", space_id: spaceId, notes });
    if (res) {
      merge(res.data.space);
      setStatus("Notes saved.");
    }
  };

  const ask = async () => {
    setAnswer(null);
    const res = await call([], { action: "ask", space_id: spaceId, question });
    if (res) setAnswer(res.data as Answer);
  };

  return (
    <div className="stack">
      <form className="row" onSubmit={(e) => { e.preventDefault(); create(); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New Space name" style={{ flex: 1 }} />
        <button disabled={busy || !name.trim() || selectedFileIds.length === 0}>Create from selected</button>
      </form>

      {spaces.length > 0 && (
        <label>
          Space
          <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
            <option value="">Choose a Space…</option>
            {spaces.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.files.length})</option>)}
          </select>
        </label>
      )}

      {space && (
        <>
          <div className="small muted">{space.files.map((f) => f.filename).join(", ") || "No files left."}</div>
          <button disabled={busy || selectedFileIds.length === 0} onClick={addSelected}>Add selected files</button>
          <label>
            Shared notes
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button disabled={busy || notes === space.notes} onClick={saveNotes}>Save notes</button>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); ask(); }}>
            <label>
              Ask across all these files
              <input value={question} onChange={(e) => setQuestion(e.target.value)} />
            </label>
            <button className="primary" disabled={busy || !question.trim()}>{busy ? "Reading…" : "Ask"}</button>
          </form>
        </>
      )}

      {status && <div className="small">{status}</div>}

      {answer && (
        <div className="card">
          <div className="result-msg">{answer.answer}</div>
          {answer.found && !answer.all_verified && (
            <p className="small" style={{ color: "var(--warn)" }}>⚠ Not every citation could be found. Check this answer yourself.</p>
          )}
          {answer.citations.length > 0 && (
            <ul className="small" style={{ paddingLeft: 18, marginBottom: 0 }}>
              {answer.citations.map((c, i) => (
                <li key={i}>{c.verified ? "✓" : "⚠"} {c.file}, page {c.page}: <em>"{c.quote}"</em></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const tool: ToolUI = { id: "spaces", Panel };
export default tool;
