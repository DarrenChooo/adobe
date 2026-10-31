import { useEffect, useState } from "react";
import PagePlacer, { boxAt, type PlacedBox } from "../components/PagePlacer";
import { useRun } from "../components/useRun";
import type { ToolPaneProps, ToolUI } from "./registry";

type Kind = "text" | "highlight" | "comment" | "whiteout" | "image";
interface Item extends PlacedBox { kind: Kind; text?: string }

const KINDS: { kind: Kind; label: string; w: number; h: number; color: string }[] = [
  { kind: "text", label: "Text box", w: 0.35, h: 0.03, color: "#2457c5" },
  { kind: "highlight", label: "Highlight", w: 0.4, h: 0.022, color: "#c9a400" },
  { kind: "comment", label: "Comment", w: 0.3, h: 0.03, color: "#e08a00" },
  { kind: "whiteout", label: "Whiteout and retype", w: 0.3, h: 0.025, color: "#666666" },
  { kind: "image", label: "Image", w: 0.25, h: 0.15, color: "#1f8a4c" },
];

function AnnotatePane(props: ToolPaneProps) {
  const { run, busy } = useRun(props);
  const id = props.file.file_id;
  const { Stage } = props;
  const [kind, setKind] = useState<Kind>("text");
  const [image, setImage] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [focus, setFocus] = useState<number | undefined>();
  const [warn, setWarn] = useState("");
  const k = KINDS.find((x) => x.kind === kind)!;
  const typed = (kd: Kind) => kd === "text" || kd === "comment" || kd === "whiteout";

  useEffect(() => { setItems([]); setWarn(""); }, [id]);

  // Place first; text kinds open a field on the page to type into.
  const place = (page: number, x: number, y: number) => {
    if (kind === "image" && !image) return setWarn("Choose an image first, then click the page.");
    setWarn("");
    setItems((s) => {
      setFocus(s.length);
      return [...s, {
        ...boxAt(page, x, y, k.w, k.h), kind, color: k.color,
        editable: typed(kind), text: typed(kind) ? "" : undefined,
        placeholder: kind === "comment" ? "Type your comment" : kind === "whiteout" ? "Type the replacement" : "Type here",
        label: kind === "highlight" ? "" : undefined,
        image: kind === "image" ? image : undefined,
      }];
    });
  };
  const empty = items.filter((it) => (it.kind === "text" || it.kind === "comment") && !it.text?.trim()).length;

  return (
    <>
      <Stage>
        <PagePlacer
          fileId={id}
          boxes={items}
          focusIndex={focus}
          onPlace={place}
          onRemove={(i) => setItems((s) => s.filter((_, j) => j !== i))}
          onMove={(i, x, y) => setItems((s) => s.map((it, j) => (j === i ? { ...it, x, y } : it)))}
          onEdit={(i, t) => setItems((s) => s.map((it, j) => (j === i ? { ...it, text: t } : it)))}
          // Highlight and whiteout: drag across the text instead of clicking.
          onDraw={kind === "highlight" || kind === "whiteout" ? (page, x, y, w, h) => setItems((s) => {
            setFocus(kind === "whiteout" ? s.length : undefined);
            return [...s, {
              page, x, y, w, h, kind, color: k.color,
              editable: kind === "whiteout", text: kind === "whiteout" ? "" : undefined,
              placeholder: "Type the replacement (optional)", label: "",
            }];
          }) : undefined}
          drawColor={k.color}
        />
      </Stage>

      <div className="step">
        <h4>1. Choose what to add</h4>
        <div className="chips">
          {KINDS.map((x) => (
            <button key={x.kind} type="button" className={`chip${kind === x.kind ? " blue" : ""}`} style={{ border: 0, padding: "5px 11px" }}
              onClick={() => { setKind(x.kind); setWarn(""); }}>
              {x.label}
            </button>
          ))}
        </div>
        {kind === "image" && (
          <label className="field">Image (PNG or JPG)
            <input type="file" accept="image/png,image/jpeg" style={{ height: "auto", padding: 6 }} onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const r = new FileReader();
              r.onload = () => setImage(r.result as string);
              r.readAsDataURL(f);
            }} />
          </label>
        )}
      </div>

      <div className="step">
        <h4>2. {kind === "highlight" || kind === "whiteout" ? "Drag across the text" : "Click the page to place it"}</h4>
        <p className="text">
          {kind === "highlight"
            ? "Press and drag over the words you want to highlight."
            : kind === "whiteout"
              ? "Press and drag over the text to cover, then type the replacement in the box (optional)."
              : `Each click adds a ${k.label.toLowerCase()}${typed(kind) ? " and opens it so you can type straight into it" : ""}.`}
          {" "}Drag a box (or its ✥) to move it, × to remove it.
        </p>
        {warn ? <div className="msg warn">{warn}</div> : null}
        {items.length ? <p className="hint">{items.length} item{items.length === 1 ? "" : "s"} placed.</p> : null}
        {empty ? <div className="msg warn">{empty} box{empty === 1 ? " is" : "es are"} still empty. Type into it, or remove it with ×.</div> : null}
      </div>

      <div className="step">
        <button className="btn primary block" disabled={busy || !items.length || empty > 0}
          onClick={() => run("annotate", [id], {
            items: items.map(({ label, color, editable, placeholder, ...it }) => it),
          })}>
          {busy ? "Saving..." : `Save ${items.length} change${items.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </>
  );
}

const tool: ToolUI = { id: "annotate", Pane: AnnotatePane };
export default tool;
