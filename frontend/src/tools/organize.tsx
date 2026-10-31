import { useEffect, useState } from "react";
import { Document, Thumbnail } from "react-pdf";
import { fileUrl } from "../api";
import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";

interface Item { page: number; rotate: number; deleted: boolean }

const tool: ToolUI = {
  id: "organize",
  Panel: (props) => {
    const { run, busy } = useRun(props);
    const id = props.selectedFileIds[props.selectedFileIds.length - 1];
    const f = props.files.find((x) => x.file_id === id);
    const [items, setItems] = useState<Item[]>([]);
    const [drag, setDrag] = useState<number | null>(null);

    useEffect(() => {
      setItems(f ? Array.from({ length: f.pages }, (_, i) => ({ page: i + 1, rotate: 0, deleted: false })) : []);
    }, [id, f?.pages]);

    const move = (from: number, to: number) =>
      setItems((s) => {
        const c = [...s];
        const [x] = c.splice(from, 1);
        c.splice(to, 0, x);
        return c;
      });
    const patch = (i: number, p: Partial<Item>) => setItems((s) => s.map((it, j) => (j === i ? { ...it, ...p } : it)));
    const kept = items.filter((i) => !i.deleted);

    if (!f) return <p className="muted">Select one PDF.</p>;
    return (
      <div className="stack">
        <p className="muted small">Drag to reorder. ⟳ rotates, ✕ deletes. To extract pages, delete the rest.</p>
        <Document file={fileUrl(id)} loading={<div className="empty">Loading pages…</div>}>
          <div className="thumbs">
            {items.map((it, i) => (
              <div
                key={`${it.page}`}
                className={`thumb${it.deleted ? " deleted" : ""}${drag === i ? " dragging" : ""}`}
                draggable
                onDragStart={() => setDrag(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (drag !== null && drag !== i) move(drag, i); setDrag(null); }}
                onDragEnd={() => setDrag(null)}
              >
                <div className="canvas-box" style={{ transform: `rotate(${it.rotate}deg)` }}>
                  <Thumbnail pageNumber={it.page} height={130} />
                </div>
                <div className="tools">
                  <button title="Move left" disabled={i === 0} onClick={() => move(i, i - 1)}>‹</button>
                  <button title="Rotate" onClick={() => patch(i, { rotate: (it.rotate + 90) % 360 })}>⟳</button>
                  <button title={it.deleted ? "Restore" : "Delete"} onClick={() => patch(i, { deleted: !it.deleted })}>{it.deleted ? "↺" : "✕"}</button>
                  <button title="Move right" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>›</button>
                </div>
                <small className="muted">p.{it.page}{it.rotate ? ` · ${it.rotate}°` : ""}</small>
              </div>
            ))}
          </div>
        </Document>
        <button
          className="primary"
          disabled={busy || kept.length === 0}
          onClick={() => run("organize", [id], { pages: kept.map(({ page, rotate }) => ({ page, rotate })) })}
        >
          {busy ? "Saving…" : `Save ${kept.length} page(s)`}
        </button>
      </div>
    );
  },
};
export default tool;
