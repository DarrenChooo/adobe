import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Document, Thumbnail } from "react-pdf";
import { fileUrl } from "../api";
import { useRun } from "../components/useRun";
import { ToolTile, entry } from "../shell/catalog";
import type { ToolUI } from "./registry";

const isPdf = (name: string) => /\.pdf$/i.test(name);

const tool: ToolUI = {
  id: "merge",
  Page: (props) => {
    const { run, busy } = useRun(props);
    const [ids, setIds] = useState<string[]>([]);
    const [filename, setFilename] = useState("combined.pdf");
    const [bookmarks, setBookmarks] = useState(true);
    const [drag, setDrag] = useState<number | null>(null);
    const [over, setOver] = useState(false);
    const [err, setErr] = useState("");
    const [adding, setAdding] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    const byId = (id: string) => props.files.find((f) => f.file_id === id);
    const chosen = ids.map(byId).filter((f) => !!f);
    const pages = chosen.reduce((n, f) => n + (f?.pages ?? 0), 0);
    const others = props.files.filter((f) => f.pages > 0 && isPdf(f.filename) && !ids.includes(f.file_id));

    const add = async (list: File[]) => {
      const pdfs = list.filter((f) => isPdf(f.name) || f.type === "application/pdf");
      setErr(pdfs.length < list.length ? "Only PDF files can be combined here. Make other files into PDFs first with Create a PDF." : "");
      if (!pdfs.length) return;
      setAdding(true);
      try {
        const infos = await props.upload(pdfs);
        setIds((s) => [...s, ...infos.map((i) => i.file_id)]);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setAdding(false);
      }
    };
    const move = (from: number, to: number) =>
      setIds((s) => {
        if (to < 0 || to >= s.length) return s;
        const c = [...s];
        const [x] = c.splice(from, 1);
        c.splice(to, 0, x);
        return c;
      });

    const go = async () => {
      setErr("");
      const res = await run("merge", ids, { filename, bookmarks });
      if (!res.ok) setErr(res.message);
    };

    return (
      <div className="setup">
        <div className="setup-head"><ToolTile id="merge" /><h1>{entry("merge")?.name ?? "Combine files"}</h1></div>
        <p className="lead">Add the PDFs you want to merge, then drag them into order. The numbers show the order they'll be combined in.</p>

        <input ref={input} type="file" multiple accept=".pdf,application/pdf" hidden
          onChange={(e) => { if (e.target.files?.length) add(Array.from(e.target.files)); e.target.value = ""; }} />

        {ids.length === 0 ? (
          <div
            className={`drop${over ? " over" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); add(Array.from(e.dataTransfer.files)); }}
          >
            <span>{adding ? "Uploading…" : <><b>Drop PDFs here</b> or click to choose files</>}</span>
          </div>
        ) : (
          <div className="file-cards">
            {chosen.map((f, i) => f && (
              <div
                key={f.file_id}
                className="file-card"
                draggable
                style={{ opacity: drag === i ? 0.4 : 1, cursor: "grab" }}
                onDragStart={() => setDrag(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (drag !== null && drag !== i) move(drag, i); setDrag(null); }}
                onDragEnd={() => setDrag(null)}
              >
                <span className="order">{i + 1}</span>
                <div className="thumb-box">
                  <Document file={fileUrl(f.file_id)} loading="" error={<span className="hint">No preview</span>}>
                    <Thumbnail pageNumber={1} height={140} />
                  </Document>
                </div>
                <div className="name">{f.filename}</div>
                <div className="hint">{f.pages} {f.pages === 1 ? "page" : "pages"}</div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="row" style={{ gap: 4 }}>
                    <button className="btn small" title="Move earlier" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, i - 1)}>‹</button>
                    <button className="btn small" title="Move later" aria-label="Move later" disabled={i === ids.length - 1} onClick={() => move(i, i + 1)}>›</button>
                  </span>
                  <button className="link-btn" onClick={() => setIds((s) => s.filter((x) => x !== f.file_id))}>Remove</button>
                </div>
              </div>
            ))}
            <div
              className="file-card add"
              role="button"
              tabIndex={0}
              onClick={() => input.current?.click()}
              onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); add(Array.from(e.dataTransfer.files)); }}
            >
              {adding ? "Uploading…" : "+ Add files"}
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div className="stack" style={{ marginTop: 20 }}>
            <p className="hint">Or add a file you already have open:</p>
            <div className="chips">
              {others.slice(0, 12).map((f) => (
                <button key={f.file_id} className="btn small" onClick={() => setIds((s) => [...s, f.file_id])}>
                  + {f.filename}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="sect" style={{ marginTop: 24, maxWidth: 520 }}>
          <div className="stack">
            <label className="field">File name for the combined PDF
              <input value={filename} onChange={(e) => setFilename(e.target.value)} />
            </label>
            <label className="check">
              <input type="checkbox" checked={bookmarks} onChange={(e) => setBookmarks(e.target.checked)} /> Bookmark each file, so you can jump to where it starts
            </label>
          </div>
        </div>

        {err && <div className="msg err" style={{ marginTop: 14 }}>{err}</div>}

        <div className="setup-bar">
          <span>{ids.length} {ids.length === 1 ? "file" : "files"} · {pages} {pages === 1 ? "page" : "pages"}</span>
          <span className="row">
            <button className="btn" onClick={() => navigate(-1)}>Cancel</button>
            <button className="btn primary" disabled={busy || ids.length < 2} onClick={go}>
              {busy ? "Combining…" : ids.length < 2 ? "Add at least 2 files" : "Combine"}
            </button>
          </span>
        </div>
      </div>
    );
  },
};
export default tool;
