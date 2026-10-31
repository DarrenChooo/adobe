// Home, All tools, Recent files, the "choose a file" step for a tool, and setup-page tools.
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { fileUrl, type FileInfo } from "../api";
import FileDropzone from "../components/FileDropzone";
import { toolUIs } from "../tools/registry";
import { CATALOG, CATEGORIES, entry, TierBadge, ToolTile } from "./catalog";
import { startTool } from "./chrome";
import { fmtSize, useFrame } from "./state";

const RECOMMENDED = ["fill_sign", "esign", "annotate", "merge", "redact", "convert"];

function useOpenUploads(toolId?: string) {
  const { ctx } = useFrame();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onFiles = async (list: File[]) => {
    setBusy(true);
    setError(null);
    try {
      const infos = await ctx.upload(list);
      const first = infos.find((i) => i.pages > 0) ?? infos[0];
      if (first) ctx.openFile(first.file_id, toolId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { onFiles, busy, error };
}

function FileTable({ files, onOpen, empty }: { files: FileInfo[]; onOpen: (f: FileInfo) => void; empty: string }) {
  if (!files.length) return <div className="table-card empty-state">{empty}</div>;
  return (
    <div className="table-card">
      <table>
        <thead><tr><th>Name</th><th>Pages</th><th>Size</th><th /></tr></thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.file_id} className="click" onClick={() => onOpen(f)}>
              <td><span className="file-cell"><span className="pdf-ico">{f.pages ? "PDF" : "FILE"}</span>{f.filename}</span></td>
              <td>{f.pages || "-"}</td>
              <td>{fmtSize(f.size)}</td>
              <td style={{ textAlign: "right" }}>
                <a className="link-btn" href={fileUrl(f.file_id, true)} download={f.filename} onClick={(e) => e.stopPropagation()}>Download</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { files, ctx } = useFrame();
  const { onFiles, busy, error } = useOpenUploads();
  const auto = entry("autofill")!;
  return (
    <>
      <h1>Welcome to Fill Me</h1>
      <h2>Recommended tools <Link to="/tools">See all tools</Link></h2>
      <div className="rec">
        <button className="tool-card feature" onClick={() => startTool(auto, navigate)}>
          <ToolTile id="autofill" />
          <span className="txt">
            <b>{auto.name} <TierBadge tier={auto.tier} /></b>
            <small>{auto.desc}. The AI only sees what each box asks for, never your details.</small>
          </span>
        </button>
        {RECOMMENDED.map((id) => {
          const t = entry(id)!;
          return (
            <button key={id} className="tool-card" onClick={() => startTool(t, navigate)}>
              <ToolTile id={id} />
              <b>{t.name}</b>
              <small>{t.desc}</small>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 20 }}>
        <FileDropzone onFiles={onFiles} label={busy ? "Opening…" : undefined} />
        {error && <div className="msg err" style={{ marginTop: 8 }}>{error}</div>}
      </div>
      <h2>Recent</h2>
      <FileTable files={files.slice(0, 8)} onOpen={(f) => ctx.openFile(f.file_id)} empty="No files yet. Drop a PDF above to open it." />
    </>
  );
}

export function AllToolsPage() {
  const navigate = useNavigate();
  return (
    <>
      <h1>All tools</h1>
      <p className="lead" style={{ marginTop: -8 }}>
        Every paid Acrobat feature, plus Smart Autofill, free. <Link to="/coverage">See how each one maps to Acrobat</Link>
      </p>
      {CATEGORIES.map((c) => (
        <section key={c}>
          <h2>{c}</h2>
          <div className="cat-grid">
            {CATALOG.filter((t) => t.cat === c).map((t) => (
              <button key={t.id} className="tool-row" onClick={() => startTool(t, navigate)}>
                <ToolTile id={t.id} />
                <span className="t"><b>{t.name}</b><small>{t.desc}</small><TierBadge tier={t.tier} /></span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export function RecentPage() {
  const { files, ctx, clearFiles } = useFrame();
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
        <h1 style={{ margin: 0 }}>Recent files</h1>
        {files.length > 0 && <button className="btn" onClick={clearFiles}>Clear the list</button>}
      </div>
      <FileTable files={files} onOpen={(f) => ctx.openFile(f.file_id)} empty="Files you open or create show up here." />
    </>
  );
}

/** Step 1 of a tool started from Home: choose the file to work on. */
export function PickFilePage() {
  const { toolId = "" } = useParams();
  const t = entry(toolId);
  const { files, ctx } = useFrame();
  const { onFiles, busy, error } = useOpenUploads(toolId);
  if (!t) return <Navigate to="/tools" replace />;
  if (t.start === "page") return <Navigate to={`/tool/${t.id}`} replace />;
  const pdfs = files.filter((f) => f.pages > 0);
  return (
    <div className="setup" style={{ maxWidth: 820 }}>
      <div className="setup-head"><ToolTile id={t.id} /><h1>{t.name}</h1></div>
      <p className="lead">{t.desc}. Choose a PDF to start.</p>
      <FileDropzone onFiles={onFiles} accept="application/pdf,.pdf" label={busy ? "Opening…" : "Drop a PDF here, or click to choose one"} />
      {error && <div className="msg err" style={{ marginTop: 8 }}>{error}</div>}
      <h2 style={{ fontSize: 15, margin: "24px 0 10px" }}>Or pick a recent file</h2>
      <FileTable files={pdfs} onOpen={(f) => ctx.openFile(f.file_id, t.start === "ai" ? undefined : t.id)} empty="No PDFs opened yet." />
    </div>
  );
}

/** Tools that start from their own setup page (Combine, Compare, Create). */
export function ToolPage() {
  const { toolId = "" } = useParams();
  const { ctx, tools } = useFrame();
  const ui = toolUIs[toolId];
  if (!ui?.Page) return <Navigate to={`/pick/${toolId}`} replace />;
  const Page = ui.Page;
  return <Page {...ctx} tool={tools.find((x) => x.id === toolId)} />;
}
