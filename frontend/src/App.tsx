import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { api, type FileInfo, type RunResult, type ToolInfo } from "./api";
import FileDropzone from "./components/FileDropzone";
import PdfPreview from "./components/PdfPreview";
import ResultPanel from "./components/ResultPanel";
import SchemaForm from "./components/SchemaForm";
import Coverage from "./Coverage";
import { toolRoutes, toolUIs } from "./tools/registry";

const TIER_ORDER = ["standard", "pro", "studio", "ours"] as const;
const TIER_LABEL: Record<string, string> = { standard: "Standard", pro: "Pro", studio: "Studio (AI)", ours: "Fill Me extras" };
const FILES_KEY = "fillme.files";

function loadFiles(): FileInfo[] {
  try {
    return JSON.parse(localStorage.getItem(FILES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function fmtSize(n: number) {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;
}

function Workspace({ tools }: { tools: ToolInfo[] }) {
  const [files, setFiles] = useState<FileInfo[]>(loadFiles);
  const [selected, setSelected] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [toolId, setToolId] = useState<string>("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(FILES_KEY, JSON.stringify(files));
    } catch {}
  }, [files]);

  // Drop files the server no longer has (e.g. storage/ was wiped).
  useEffect(() => {
    files.forEach((f) =>
      api.fileInfo(f.file_id).catch(() => setFiles((s) => s.filter((x) => x.file_id !== f.file_id))),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickable = useMemo(() => {
    const byId = new Map(tools.map((t) => [t.id, t]));
    // Tools with a UI but no server spec still show, so front-end work isn't blocked.
    for (const id of Object.keys(toolUIs)) {
      if (!byId.has(id))
        byId.set(id, { id, name: id, tier: "ours", adobe_feature: "", description: "(server tool missing)", params_schema: {}, min_files: 0, max_files: null, status: "not-yet" });
    }
    return [...byId.values()];
  }, [tools]);

  const tool = pickable.find((t) => t.id === toolId);
  const ui = toolUIs[toolId];

  const addFiles = useCallback((infos: FileInfo[]) => {
    setFiles((s) => [...infos, ...s.filter((f) => !infos.some((i) => i.file_id === f.file_id))]);
  }, []);

  const onUpload = async (list: File[]) => {
    setUploading(true);
    setError(null);
    try {
      const infos = await Promise.all(list.map((f) => api.upload(f)));
      addFiles(infos);
      setSelected((s) => [...s, ...infos.map((i) => i.file_id)]);
      setPreviewId(infos[0].file_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onResult = useCallback(
    async (res: RunResult) => {
      setResult(res);
      if (!res.ok || !res.outputs.length) return;
      const infos = await Promise.all(res.outputs.map((o) => api.fileInfo(o.file_id)));
      addFiles(infos);
      const firstPdf = res.outputs.find((o) => o.mime === "application/pdf");
      if (firstPdf) setPreviewId(firstPdf.file_id);
    },
    [addFiles],
  );

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="workspace">
      <aside className="files-col">
        <FileDropzone onFiles={onUpload} label={uploading ? "Uploading…" : undefined} />
        {error && <div className="result fail">{error}</div>}
        <div className="files-head">
          <strong>Files</strong>
          {files.length > 0 && (
            <span>
              <button className="link" onClick={() => setSelected(files.map((f) => f.file_id))}>All</button>
              <button className="link" onClick={() => setSelected([])}>None</button>
              <button className="link" onClick={() => { setFiles([]); setSelected([]); setPreviewId(null); }}>Clear</button>
            </span>
          )}
        </div>
        <ul className="file-list">
          {files.map((f) => {
            const order = selected.indexOf(f.file_id);
            return (
              <li key={f.file_id} className={previewId === f.file_id ? "active" : ""}>
                <label className="check">
                  <input type="checkbox" checked={order >= 0} onChange={() => toggle(f.file_id)} />
                  {order >= 0 && <span className="order">{order + 1}</span>}
                </label>
                <button className="file-name" onClick={() => setPreviewId(f.file_id)} title={f.filename}>
                  {f.filename}
                  <small>{f.pages ? `${f.pages} p · ` : ""}{fmtSize(f.size)}</small>
                </button>
                <a className="dl" href={api.fileUrl(f.file_id, true)} download={f.filename} title="Download">↓</a>
              </li>
            );
          })}
          {!files.length && <li className="muted">No files yet.</li>}
        </ul>
      </aside>

      <section className="tool-col">
        <label className="tool-pick">
          <span>Tool</span>
          <select value={toolId} onChange={(e) => { setToolId(e.target.value); setResult(null); }}>
            <option value="">Choose a tool…</option>
            {TIER_ORDER.map((tier) => {
              const ts = pickable.filter((t) => t.tier === tier);
              return ts.length ? (
                <optgroup key={tier} label={TIER_LABEL[tier]}>
                  {ts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </optgroup>
              ) : null;
            })}
          </select>
        </label>
        {tool && (
          <div className="panel">
            <h2>{tool.name}</h2>
            <p className="muted">{tool.description}</p>
            {selected.length > 0 && (
              <p className="muted small">Selected: {selected.map((id) => files.find((f) => f.file_id === id)?.filename ?? id).join(", ")}</p>
            )}
            {ui ? (
              <ui.Panel key={tool.id} tool={tool} selectedFileIds={selected} files={files} api={api} onResult={onResult} />
            ) : (
              <SchemaForm key={tool.id} tool={tool} selectedFileIds={selected} files={files} api={api} onResult={onResult} />
            )}
          </div>
        )}
        <ResultPanel result={result} onPreview={setPreviewId} />
      </section>

      <section className="preview-col">
        <PdfPreview fileId={previewId} width={460} />
      </section>
    </div>
  );
}

export default function App() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [serverDown, setServerDown] = useState(false);
  useEffect(() => {
    api.listTools().then(setTools).catch(() => setServerDown(true));
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">Fill Me</Link>
        <nav>
          <NavLink to="/" end>Workspace</NavLink>
          <NavLink to="/coverage">Coverage</NavLink>
        </nav>
      </header>
      {serverDown && <div className="banner">Can't reach the server. Is <code>uvicorn app.main:app --reload</code> running on port 8000?</div>}
      <main>
        <Routes>
          <Route path="/" element={<Workspace tools={tools} />} />
          <Route path="/coverage" element={<Coverage tools={tools} />} />
          {toolRoutes.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
          <Route path="*" element={<div className="empty">Page not found. <Link to="/">Go home</Link></div>} />
        </Routes>
      </main>
    </div>
  );
}
