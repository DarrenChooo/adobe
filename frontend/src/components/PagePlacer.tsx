import PdfPreview from "./PdfPreview";

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
}

interface Props {
  fileId: string | null;
  boxes: PlacedBox[];
  /** Called with the click point; the caller decides the box size. */
  onPlace: (page: number, x: number, y: number) => void;
  onRemove: (index: number) => void;
  width?: number;
}

/** A PDF preview you click on to drop boxes (signatures, fields, notes). */
export default function PagePlacer({ fileId, boxes, onPlace, onRemove, width = 420 }: Props) {
  return (
    <div className="placer">
      <PdfPreview
        fileId={fileId}
        width={width}
        onPageClick={(page, x, y, e) => {
          if ((e.target as HTMLElement).closest(".place-box")) return;
          onPlace(page, x, y);
        }}
        overlay={(page) =>
          boxes.map((b, i) =>
            b.page === page ? (
              <div
                key={i}
                className="place-box"
                style={{
                  left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`,
                  ...(b.color ? { borderColor: b.color, color: b.color, background: `${b.color}22` } : {}),
                }}
              >
                {b.image ? <img src={b.image} alt="" /> : b.label}
                <button type="button" title="Remove" onClick={(e) => { e.stopPropagation(); onRemove(i); }}>×</button>
              </div>
            ) : null,
          )
        }
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
