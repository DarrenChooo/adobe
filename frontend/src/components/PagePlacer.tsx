import { useRef, useState } from "react";
import PdfPreview from "./PdfPreview";
import "../tools/pro/pro.css";

export interface PlacedBox {
  page: number;
  /** Fractions of the page, top-left origin (what the server's stamp helpers expect). */
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  image?: string | null;
  color?: string;
  /** With onEdit: the box holds a text field you type into right on the page. */
  editable?: boolean;
  text?: string;
  placeholder?: string;
}

interface Props {
  fileId: string | null;
  boxes: PlacedBox[];
  /** Called with the click point; the caller decides the box size. */
  onPlace: (page: number, x: number, y: number) => void;
  onRemove: (index: number) => void;
  /** When given, boxes can be dragged; called with the box's new top-left (fractions). */
  onMove?: (index: number, x: number, y: number) => void;
  /** When given, each box gets a corner handle; called with its new width/height (fractions). */
  onResize?: (index: number, w: number, h: number) => void;
  /** Called as you type into an editable box. */
  onEdit?: (index: number, text: string) => void;
  /** Focus this box's text field (e.g. the one just placed). */
  focusIndex?: number;
  /** When given, press-drag-release on the page draws a box (e.g. a highlight over text). */
  onDraw?: (page: number, x: number, y: number, w: number, h: number) => void;
  /** Colour of the box shown while drawing. */
  drawColor?: string;
  width?: number;
}

type Pt = [number, number];

/** A PDF you click on (or drag across) to add boxes: signatures, notes, highlights. Put it inside <Stage>. */
export default function PagePlacer({
  fileId, boxes, onPlace, onRemove, onMove, onResize, onEdit, focusIndex, onDraw, drawColor = "#c9a400", width = 680,
}: Props) {
  // Moving or resizing a box: which one, the grab offset, and the pointer/size at the start (fractions).
  const drag = useRef<{ i: number; mode: "move" | "resize"; dx: number; dy: number; px: number; py: number; w: number; h: number } | null>(null);
  const handles = !!(onMove || onResize);
  // Drawing a new box: the page, the start corner, and that page's element.
  const drawStart = useRef<{ page: number; x: number; y: number; el: HTMLElement } | null>(null);
  const justDrew = useRef(false);
  const [draft, setDraft] = useState<PlacedBox | null>(null);

  const frac = (e: React.PointerEvent, el: Element): Pt => {
    const r = el.getBoundingClientRect();
    return [Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1), Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1)];
  };
  const rectFrom = (s: { x: number; y: number }, [x, y]: Pt) => ({
    x: Math.min(s.x, x), y: Math.min(s.y, y), w: Math.abs(x - s.x), h: Math.max(Math.abs(y - s.y), 0.018),
  });
  const pos = (b: PlacedBox) => ({ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });

  const renderBox = (b: PlacedBox, i: number) => (
    <div
      key={i}
      className="pro-place"
      style={{
        ...pos(b),
        ...(b.color ? { borderColor: b.color, color: b.color, background: `${b.color}22` } : {}),
        ...(onMove ? { cursor: "move", touchAction: "none" } : {}),
      }}
      title={onMove ? "Drag to move" : undefined}
      onPointerDown={handles ? (e) => {
        const t = e.target as HTMLElement;
        const resizing = !!t.closest(".pro-resize") && !!onResize;
        if (!resizing && (!onMove || t.closest("input") || (t.closest("button") && !t.closest(".pro-grip")))) return;
        e.preventDefault();
        e.stopPropagation();
        const [px, py] = frac(e, e.currentTarget.closest(".page-wrap")!);
        drag.current = { i, mode: resizing ? "resize" : "move", dx: px - b.x, dy: py - b.y, px, py, w: b.w, h: b.h };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* no live pointer */ }
      } : undefined}
      onPointerMove={handles ? (e) => {
        const d = drag.current;
        if (!d || d.i !== i) return;
        e.stopPropagation();
        const [px, py] = frac(e, e.currentTarget.closest(".page-wrap")!);
        if (d.mode === "resize" && onResize) {
          onResize(i, Math.min(Math.max(d.w + px - d.px, 0.02), 1 - b.x), Math.min(Math.max(d.h + py - d.py, 0.012), 1 - b.y));
        } else if (onMove) {
          onMove(i, Math.min(Math.max(px - d.dx, 0), 1 - b.w), Math.min(Math.max(py - d.dy, 0), 1 - b.h));
        }
      } : undefined}
      onPointerUp={handles ? (e) => { e.stopPropagation(); drag.current = null; } : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      {b.image ? (
        <img src={b.image} alt="" draggable={false} />
      ) : b.editable && onEdit ? (
        <input
          value={b.text ?? ""}
          placeholder={b.placeholder ?? "Type here"}
          autoFocus={i === focusIndex}
          onChange={(e) => onEdit(i, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          style={{ width: "100%", height: "100%", border: 0, outline: 0, background: "rgba(255,255,255,0.85)",
                   font: "inherit", fontSize: 12, color: "#111", padding: "0 4px", boxSizing: "border-box" }}
        />
      ) : b.label}
      {onMove && (
        <button type="button" className="pro-grip" title="Drag to move" aria-label="Drag to move"
          style={{ left: -9, right: "auto", cursor: "move" }} onClick={(e) => e.stopPropagation()}>✥</button>
      )}
      <button type="button" title="Remove" aria-label="Remove" onClick={(e) => { e.stopPropagation(); onRemove(i); }}>×</button>
      {onResize && (
        <span className="pro-resize" title="Drag to resize" aria-label="Drag to resize"
          style={{ position: "absolute", right: -7, bottom: -7, width: 12, height: 12, background: "#fff",
                   border: `2px solid ${b.color ?? "var(--blue)"}`, borderRadius: 3, cursor: "nwse-resize", touchAction: "none" }} />
      )}
    </div>
  );

  return (
    <div
      className="pro-placer"
      onPointerDown={onDraw ? (e) => {
        const t = e.target as HTMLElement;
        const wrap = t.closest(".page-wrap") as HTMLElement | null;
        if (!wrap || t.closest(".pro-place")) return;
        const pages = Array.from(e.currentTarget.querySelectorAll(".page-wrap"));
        const [x, y] = frac(e, wrap);
        drawStart.current = { page: pages.indexOf(wrap) + 1, x, y, el: wrap };
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* no live pointer */ }
      } : undefined}
      onPointerMove={onDraw ? (e) => {
        const s = drawStart.current;
        if (s) setDraft({ page: s.page, ...rectFrom(s, frac(e, s.el)), color: drawColor });
      } : undefined}
      onPointerUp={onDraw ? (e) => {
        const s = drawStart.current;
        drawStart.current = null;
        setDraft(null);
        if (!s) return;
        const r = rectFrom(s, frac(e, s.el));
        if (r.w > 0.01) {  // a real drag, not a click
          justDrew.current = true;
          onDraw(s.page, r.x, r.y, r.w, r.h);
        }
      } : undefined}
    >
      <PdfPreview
        fileId={fileId}
        width={width}
        onPageClick={(page, x, y, e) => {
          if (justDrew.current) { justDrew.current = false; return; }
          if (onDraw) return;  // in draw mode, a plain click does nothing
          if ((e.target as HTMLElement).closest(".pro-place")) return;
          onPlace(page, x, y);
        }}
        overlay={(page) => (
          <>
            {boxes.map((b, i) => (b.page === page ? renderBox(b, i) : null))}
            {draft && draft.page === page && (
              <div className="pro-place" style={{ ...pos(draft), borderColor: draft.color, background: `${draft.color}33`, pointerEvents: "none" }} />
            )}
          </>
        )}
      />
    </div>
  );
}

/** Centre a w×h box on a click, kept inside the page. */
export function boxAt(page: number, x: number, y: number, w: number, h: number): PlacedBox {
  return {
    page,
    w,
    h,
    x: Math.min(Math.max(x - w / 2, 0), 1 - w),
    y: Math.min(Math.max(y - h / 2, 0), 1 - h),
  };
}
