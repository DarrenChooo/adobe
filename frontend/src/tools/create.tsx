import { useRef, useState, type ReactNode } from "react";
import type { FileInfo } from "../api";
import { useRun } from "../components/useRun";
import { ToolTile, entry } from "../shell/catalog";
import type { ToolContext, ToolUI } from "./registry";

const IMG = /\.(jpe?g|png|gif|bmp|tiff?|webp)$/i;
const TXT = /\.(txt|md|markdown)$/i;
const OFFICE = /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i;

/** A drop area with a hidden file picker. */
function Drop({ accept, onFiles, busy, children }: { accept: string; onFiles: (f: File[]) => void; busy: boolean; children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`drop${over ? " over" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files)); }}
    >
      <span>{busy ? "Uploading…" : children}</span>
      <input ref={input} type="file" multiple accept={accept} hidden
        onChange={(e) => { if (e.target.files?.length) onFiles(Array.from(e.target.files)); e.target.value = ""; }} />
    </div>
  );
}

function CreatePage(props: ToolContext) {
  const { run, busy } = useRun(props);
  // From images, text or Markdown
  const [items, setItems] = useState<FileInfo[]>([]);
  const [text, setText] = useState("");
  const [pageSize, setPageSize] = useState("A4");
  const [fit, setFit] = useState("page");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  // Office file to PDF
  const [office, setOffice] = useState<FileInfo | null>(null);
  const [officeUp, setOfficeUp] = useState(false);
  const [officeErr, setOfficeErr] = useState("");
  const [officeBusy, setOfficeBusy] = useState(false);

  const addFiles = async (list: File[]) => {
    const ok = list.filter((f) => IMG.test(f.name) || TXT.test(f.name));
    setErr(ok.length < list.length ? "Some files were skipped. Use images, .txt or .md files here; Office files go in the section below." : "");
    if (!ok.length) return;
    setUploading(true);
    try {
      const infos = await props.upload(ok);
      setItems((s) => [...s, ...infos]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const addOffice = async (list: File[]) => {
    const f = list.find((x) => OFFICE.test(x.name));
    setOfficeErr(f ? "" : "Choose a Word, Excel or PowerPoint file (.docx, .xlsx, .pptx).");
    if (!f) return;
    setOfficeUp(true);
    try {
      const [info] = await props.upload([f]);
      setOffice(info);
    } catch (e) {
      setOfficeErr((e as Error).message);
    } finally {
      setOfficeUp(false);
    }
  };

  const images = items.filter((f) => IMG.test(f.filename)).length;
  const texts = items.length - images;
  const ready = items.length > 0 || text.trim() !== "";

  const create = async () => {
    setErr("");
    const res = await run("create", items.map((f) => f.file_id), { text: text.trim() || undefined, page_size: pageSize, fit });
    if (!res.ok) setErr(res.message);
  };

  const convertOffice = async () => {
    if (!office) return;
    setOfficeErr("");
    setOfficeBusy(true);
    try {
      const res = await props.api.runTool("convert", [office.file_id], { target: "office" });
      props.onResult(res);
      if (!res.ok) setOfficeErr(res.message);
    } catch (e) {
      setOfficeErr((e as Error).message);
    } finally {
      setOfficeBusy(false);
    }
  };

  return (
    <div className="setup">
      <div className="setup-head"><ToolTile id="create" /><h1>{entry("create")?.name ?? "Create a PDF"}</h1></div>
      <p className="lead">Make a PDF from pictures, typed text or Markdown, or turn a Word, Excel or PowerPoint file into a PDF.</p>

      <div className="sect">
        <h3>From images, text or Markdown</h3>
        <div className="stack">
          <Drop accept="image/*,.txt,.md,.markdown" onFiles={addFiles} busy={uploading}>
            <b>Drop images, .txt or .md files here</b> or click to choose
          </Drop>
          {items.length > 0 && (
            <ul className="list">
              {items.map((f, i) => (
                <li key={f.file_id}>
                  <span className="chip">{i + 1}</span>
                  <span style={{ flex: 1 }}>{f.filename}</span>
                  <button className="link-btn" onClick={() => setItems((s) => s.filter((x) => x.file_id !== f.file_id))}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          <p className="hint">Images become one PDF with a page each, in this order. Each .txt or .md file becomes its own PDF.</p>
          <label className="field">Or type text or Markdown
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder={"# Title\n\nSome **bold** text.\n\n- a list item"} />
          </label>
          <div className="form2">
            <label className="field">Page size
              <select value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
              </select>
            </label>
            <label className="field">How images sit on the page
              <select value={fit} onChange={(e) => setFit(e.target.value)}>
                <option value="page">Fit inside the page</option>
                <option value="image">Make the page the size of the image</option>
              </select>
            </label>
          </div>
          {err && <div className="msg err">{err}</div>}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="hint">
              {items.length ? `${images} ${images === 1 ? "image" : "images"} · ${texts} text ${texts === 1 ? "file" : "files"}` : "Nothing added yet"}
              {text.trim() ? " · typed text" : ""}
            </span>
            <button className="btn primary" disabled={busy || !ready} onClick={create}>
              {busy ? "Creating…" : ready ? "Create PDF" : "Add a file or type some text"}
            </button>
          </div>
        </div>
      </div>

      <div className="sect">
        <h3>Office file to PDF</h3>
        <div className="stack">
          <Drop accept=".docx,.doc,.xlsx,.xls,.pptx,.ppt,.odt,.ods,.odp,.rtf" onFiles={addOffice} busy={officeUp}>
            {office ? <><b>{office.filename}</b> · click to choose a different file</> : <><b>Drop a Word, Excel or PowerPoint file</b> or click to choose</>}
          </Drop>
          <p className="hint">Uses LibreOffice on the server to keep the layout. If it isn't installed, you'll see a message here.</p>
          {officeErr && <div className="msg err">{officeErr}</div>}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn primary" disabled={officeBusy || !office} onClick={convertOffice}>
              {officeBusy ? "Converting…" : office ? "Convert to PDF" : "Choose a file first"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const tool: ToolUI = { id: "create", Page: CreatePage };
export default tool;
