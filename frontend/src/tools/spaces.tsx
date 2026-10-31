import { useEffect, useRef, useState } from "react";
import { useApp } from "../shell/app-context";
import type { FileInfo } from "../api";
import type { ToolUI } from "./registry";
import "./spaces.css";

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

const isPdf = (name: string) => /\.pdf$/i.test(name);

/** Checkboxes for the user's PDFs plus an upload button. Uploaded files come back ticked. */
function FilePicker({ files, exclude, picked, setPicked, upload }: {
  files: FileInfo[]; exclude: string[]; picked: string[]; setPicked: (ids: string[]) => void;
  upload: (list: File[]) => Promise<FileInfo[]>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const choices = files.filter((f) => isPdf(f.filename) && !exclude.includes(f.file_id));
  return (
    <div className="stack" style={{ gap: 8 }}>
      {choices.length > 0 ? (
        <div className="spaces-pick">
          {choices.map((f) => (
            <label key={f.file_id} className="check" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={picked.includes(f.file_id)}
                onChange={(e) => setPicked(e.target.checked ? [...picked, f.file_id] : picked.filter((x) => x !== f.file_id))} />
              {f.filename}
            </label>
          ))}
        </div>
      ) : <p className="hint">No other PDFs open yet. Upload some.</p>}
      <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={async (e) => {
        const list = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (!list.length) return;
        setError("");
        try {
          const infos = await upload(list);
          setPicked([...picked, ...infos.map((i) => i.file_id)]);
        } catch (err) {
          setError((err as Error).message);
        }
      }} />
      <div><button type="button" className="link-btn" onClick={() => input.current?.click()}>Upload PDFs from your computer</button></div>
      {error && <div className="msg err">{error}</div>}
    </div>
  );
}

function SpacesPage() {
  const { api, files, upload, openFile } = useApp();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const space = spaces.find((s) => s.id === spaceId);

  const call = async (what: string, fileIds: string[], params: Record<string, unknown>) => {
    setBusy(what);
    setStatus(null);
    try {
      const res = await api.runTool("spaces", fileIds, params);
      if (!res.ok) setStatus({ ok: false, text: res.message });
      return res.ok ? res : null;
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message });
      return null;
    } finally {
      setBusy("");
    }
  };

  const merge = (updated: Space) =>
    setSpaces((all) => (all.some((s) => s.id === updated.id) ? all.map((s) => (s.id === updated.id ? updated : s)) : [...all, updated]));

  useEffect(() => {
    call("list", [], { action: "list" }).then((res) => {
      if (!res) return;
      setSpaces(res.data.spaces);
      if (res.data.spaces.length) setSpaceId(res.data.spaces[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setNotes(space?.notes ?? ""); setAnswer(null); setAdding(false); setToAdd([]); }, [spaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    const res = await call("create", picked, { action: "create", name });
    if (res) {
      merge(res.data.space);
      setSpaceId(res.data.space.id);
      setName("");
      setPicked([]);
      setCreating(false);
    }
  };

  const addFiles = async () => {
    const res = await call("add", toAdd, { action: "add_files", space_id: spaceId });
    if (res) {
      merge(res.data.space);
      setAdding(false);
      setToAdd([]);
    }
  };

  const saveNotes = async () => {
    const res = await call("notes", [], { action: "save_notes", space_id: spaceId, notes });
    if (res) {
      merge(res.data.space);
      setStatus({ ok: true, text: "Notes saved." });
    }
  };

  const ask = async () => {
    setAnswer(null);
    const res = await call("ask", [], { action: "ask", space_id: spaceId, question });
    if (res) setAnswer(res.data as Answer);
  };

  return (
    <div className="setup" style={{ maxWidth: "none" }}>
      <div className="spaces-head">
        <div className="setup-head"><h1>PDF Spaces</h1></div>
        <button className="btn primary" onClick={() => setCreating((c) => !c)}>{creating ? "Close" : "New Space"}</button>
      </div>
      <p className="lead">A Space keeps related PDFs together with your notes, and lets you ask one question across all of them.</p>

      {creating && (
        <form className="sect spaces-new stack" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <h3 style={{ margin: 0 }}>New Space</h3>
          <label className="field">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Flat move, Nov 2026" autoFocus />
          </label>
          <div className="field">Files to put in it</div>
          <FilePicker files={files} exclude={[]} picked={picked} setPicked={setPicked} upload={upload} />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn primary" disabled={!!busy || !name.trim() || picked.length === 0}>
              {busy === "create" ? "Creating…" : `Create Space${picked.length ? ` with ${picked.length} file${picked.length === 1 ? "" : "s"}` : ""}`}
            </button>
          </div>
        </form>
      )}

      {status && <div className={`msg ${status.ok ? "ok" : "err"}`} style={{ maxWidth: 1100, marginBottom: 14 }}>{status.text}</div>}

      {spaces.length === 0 && !creating && busy !== "list" && (
        <div className="sect" style={{ maxWidth: 1100 }}>
          <p className="hint">No Spaces yet. Press "New Space" to group some PDFs.</p>
        </div>
      )}

      {spaces.length > 0 && (
        <div className="spaces-grid">
          <div className="spaces-list">
            {spaces.map((s) => (
              <button key={s.id} className={`spaces-item${s.id === spaceId ? " on" : ""}`} onClick={() => setSpaceId(s.id)}>
                <b>{s.name}</b>
                <span>{s.files.length} file{s.files.length === 1 ? "" : "s"}</span>
              </button>
            ))}
          </div>

          {space ? (
            <div className="spaces-main">
              <section className="sect">
                <h3>Files</h3>
                {space.files.length ? space.files.map((f) => (
                  <button key={f.file_id} className="spaces-file" onClick={() => openFile(f.file_id)} title="Open this file">
                    <span className="pdf-ico">PDF</span>{f.filename}
                  </button>
                )) : <p className="hint">No files left in this Space.</p>}
                {adding ? (
                  <div className="stack" style={{ marginTop: 10 }}>
                    <FilePicker files={files} exclude={space.files.map((f) => f.file_id)} picked={toAdd} setPicked={setToAdd} upload={upload} />
                    <div className="row">
                      <button className="btn small primary" disabled={!!busy || !toAdd.length} onClick={addFiles}>
                        {busy === "add" ? "Adding…" : `Add ${toAdd.length || ""} file${toAdd.length === 1 ? "" : "s"}`}
                      </button>
                      <button className="btn small" onClick={() => { setAdding(false); setToAdd([]); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 6 }}><button className="link-btn" onClick={() => setAdding(true)}>+ Add files</button></div>
                )}
              </section>

              <section className="sect">
                <h3>Notes</h3>
                <textarea className="inp" rows={3} style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
                  value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember about these files" />
                <div style={{ marginTop: 8 }}>
                  <button className="btn small" disabled={!!busy || notes === space.notes} onClick={saveNotes}>{busy === "notes" ? "Saving…" : "Save notes"}</button>
                </div>
              </section>

              <section className="sect">
                <h3>Ask across all {space.files.length} file{space.files.length === 1 ? "" : "s"}</h3>
                <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); ask(); }}>
                  <input className="inp" style={{ flex: 1 }} value={question} onChange={(e) => setQuestion(e.target.value)}
                    placeholder="When is the deposit due, and how much is it?" aria-label="Your question" />
                  <button className="btn primary" disabled={!!busy || !question.trim() || !space.files.length}>{busy === "ask" ? "Reading…" : "Ask"}</button>
                </form>
                {answer && (
                  <div className="spaces-answer" style={{ marginTop: 12 }}>
                    {answer.answer}
                    {answer.citations.map((c, i) => (
                      <span key={i} className="chip" title={c.quote ? `"${c.quote}"` : undefined}>{c.file}, p.{c.page}</span>
                    ))}
                    {answer.citations.length > 0 && (
                      <div className="spaces-checks">
                        {answer.citations.map((c, i) => (
                          <span key={i} className={c.verified ? "ok" : "bad"}>
                            {c.verified ? `✓ Quote found in ${c.file}, page ${c.page}` : `⚠ Not found in ${c.file}, page ${c.page}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="hint" style={{ marginTop: 10 }}>The text of these PDFs is sent to the AI model.</p>
              </section>
            </div>
          ) : (
            <div className="sect"><p className="hint">Choose a Space on the left.</p></div>
          )}
        </div>
      )}
    </div>
  );
}

const tool: ToolUI = { id: "spaces", routes: [{ path: "/spaces", frame: "home", element: <SpacesPage /> }] };
export default tool;
