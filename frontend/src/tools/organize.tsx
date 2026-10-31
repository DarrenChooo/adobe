import { useEffect, useState } from "react";
import { Document, Thumbnail } from "react-pdf";
import { fileUrl } from "../api";
import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";
import "./organize.css";

interface Item { page: number; rotate: number; deleted: boolean }

const fresh = (n: number): Item[] => Array.from({ length: n }, (_, i) => ({ page: i + 1, rotate: 0, deleted: false }));

const tool: ToolUI = {
  id: "organize",
  Pane: (props) => {
    const { Stage, file } = props;
    const { run, busy } = useRun(props);
    const [items, setItems] = useState<Item[]>(() => fresh(file.pages));
    const [drag, setDrag] = useState<number | null>(null);
    const [over, setOver] = useState<number | null>(null);
    const [err, setErr] = useState("");

    useEffect(() => setItems(fresh(file.pages)), [file.file_id, file.pages]);

    const move = (from: number, to: number) =>
      setItems((s) => {
        const c = [...s];
        const [x] = c.splice(from, 1);
        c.splice(to, 0, x);
        return c;
      });
    const patch = (i: number, p: Partial<Item>) => setItems((s) => s.map((it, j) => (j === i ? { ...it, ...p } : it)));
    const kept = items.filter((i) => !i.deleted);
    const deleted = items.length - kept.length;
    const rotated = kept.filter((i) => i.rotate).length;
    const moved = items.some((it, i) => it.page !== i + 1);
    const changed = deleted > 0 || rotated > 0 || moved;

    const save = async () => {
      setErr("");
      const res = await run("organize", [file.file_id], { pages: kept.map(({ page, rotate }) => ({ page, rotate })) });
      if (!res.ok) setErr(res.message);
    };

    return (
      <>
        <div className="step">
          <p className="hint">Drag pages in the middle to reorder them. Use the buttons under each page to rotate or delete it. To pull out a few pages, delete the rest.</p>
        </div>
        <div className="step">
          <h4>Changes</h4>
          <div className="chips">
            <span className="chip">{kept.length} of {items.length} pages kept</span>
            {deleted > 0 && <span className="chip red">{deleted} deleted</span>}
            {rotated > 0 && <span className="chip blue">{rotated} rotated</span>}
            {moved && <span className="chip amber">Order changed</span>}
          </div>
          {changed && (
            <button className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => setItems(fresh(file.pages))}>Undo all changes</button>
          )}
        </div>
        <div className="step">
          {err && <div className="msg err">{err}</div>}
          <button className="btn primary block" disabled={busy || kept.length === 0} onClick={save}>
            {busy ? "Saving…" : kept.length === 0 ? "Keep at least 1 page" : `Save ${kept.length} ${kept.length === 1 ? "page" : "pages"}`}
          </button>
          <p className="hint">Saves a new copy. Your original stays as it is.</p>
        </div>

        <Stage>
          <Document className="organize-doc" file={fileUrl(file.file_id)} loading={<p className="hint">Loading pages…</p>}>
            <div className="stage-grid">
              {items.map((it, i) => (
                <div
                  key={it.page}
                  className={`organize-card${it.deleted ? " deleted" : ""}${drag === i ? " dragging" : ""}${over === i && drag !== i ? " over" : ""}`}
                  draggable
                  onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(e) => { e.preventDefault(); setOver(i); }}
                  onDragLeave={() => setOver((o) => (o === i ? null : o))}
                  onDrop={(e) => { e.preventDefault(); if (drag !== null && drag !== i) move(drag, i); setDrag(null); setOver(null); }}
                  onDragEnd={() => { setDrag(null); setOver(null); }}
                >
                  <div className="organize-thumb">
                    <div style={{ transform: `rotate(${it.rotate}deg)${it.rotate % 180 ? " scale(0.72)" : ""}` }}>
                      <Thumbnail pageNumber={it.page} height={160} />
                    </div>
                  </div>
                  <div className="organize-label">
                    Page {it.page}{it.rotate ? ` · ${it.rotate}°` : ""}{it.deleted ? " · deleted" : ""}
                  </div>
                  <div className="organize-tools">
                    <button title="Move earlier" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, i - 1)}>‹</button>
                    <button title="Rotate right" aria-label="Rotate right" disabled={it.deleted} onClick={() => patch(i, { rotate: (it.rotate + 90) % 360 })}>⟳</button>
                    <button title={it.deleted ? "Restore" : "Delete"} aria-label={it.deleted ? "Restore" : "Delete"} onClick={() => patch(i, { deleted: !it.deleted })}>
                      {it.deleted ? "↺" : "✕"}
                    </button>
                    <button title="Move later" aria-label="Move later" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>›</button>
                  </div>
                </div>
              ))}
            </div>
          </Document>
        </Stage>
      </>
    );
  },
};
export default tool;
