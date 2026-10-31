import { useState } from "react";
import type { PointerEvent as RPointerEvent } from "react";
import type { Box } from "./types";

type Props = {
  pages: string[];                                   // image URLs rendered at 72 dpi (1 px = 1 pt)
  boxes: Box[];
  onToggle?: (id: string) => void;                   // click a box to include/exclude it
  onDraw?: (box: Omit<Box, "id">) => void;           // drag on a page to draw a new box
};

type Draft = { page: number; sx: number; sy: number; x: number; y: number; scale: number };

export default function PageBoxes({ pages, boxes, onToggle, onDraw }: Props) {
  const [scales, setScales] = useState<Record<number, number>>({});
  const [draft, setDraft] = useState<Draft | null>(null);

  const pointFrom = (e: RPointerEvent<HTMLDivElement>, scale: number) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  return (
    <div className="pro-pages">
      {pages.map((src, i) => {
        const page = i + 1;
        const s = scales[page] ?? 1;
        return (
          <div
            key={src}
            className="pro-page"
            onPointerDown={(e) => {
              if (!onDraw || (e.target as HTMLElement).classList.contains("pro-box")) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              const p = pointFrom(e, s);
              setDraft({ page, sx: p.x, sy: p.y, x: p.x, y: p.y, scale: s });
            }}
            onPointerMove={(e) => {
              if (draft && draft.page === page) {
                const p = pointFrom(e, s);
                setDraft({ ...draft, x: p.x, y: p.y });
              }
            }}
            onPointerUp={() => {
              if (draft && draft.page === page && onDraw) {
                const b = {
                  page,
                  x0: Math.min(draft.sx, draft.x),
                  top: Math.min(draft.sy, draft.y),
                  x1: Math.max(draft.sx, draft.x),
                  bottom: Math.max(draft.sy, draft.y),
                };
                if (b.x1 - b.x0 > 4 && b.bottom - b.top > 4) onDraw(b);
              }
              setDraft(null);
            }}
          >
            <img
              src={src}
              alt={`Page ${page}`}
              onLoad={(e) => {
                const img = e.currentTarget;
                setScales((prev) => ({ ...prev, [page]: img.clientWidth / img.naturalWidth }));
              }}
            />
            {boxes
              .filter((b) => b.page === page)
              .map((b) => (
                <div
                  key={b.id}
                  className={`pro-box${b.muted ? " muted" : ""}`}
                  title={b.label}
                  onClick={() => onToggle?.(b.id)}
                  style={{ left: b.x0 * s, top: b.top * s, width: (b.x1 - b.x0) * s, height: (b.bottom - b.top) * s,
                    cursor: onToggle ? "pointer" : "default" }}
                >
                  {b.label && !b.muted ? <span>{b.label}</span> : null}
                </div>
              ))}
            {draft && draft.page === page ? (
              <div
                className="pro-box draft"
                style={{
                  left: Math.min(draft.sx, draft.x) * s,
                  top: Math.min(draft.sy, draft.y) * s,
                  width: Math.abs(draft.x - draft.sx) * s,
                  height: Math.abs(draft.y - draft.sy) * s,
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
