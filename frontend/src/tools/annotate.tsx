import { useEffect, useState } from "react";
import PagePlacer, { boxAt, type PlacedBox } from "../components/PagePlacer";
import { useRun } from "../components/useRun";
import type { ToolPaneProps, ToolUI } from "./registry";

type Kind = "text" | "highlight" | "comment" | "whiteout" | "image";
interface Item extends PlacedBox { kind: Kind; text?: string }

const KINDS: { kind: Kind; label: string; w: number; h: number; color: string }[] = [
  { kind: "text", label: "Text box", w: 0.35, h: 0.03, color: "#2457c5" },
  { kind: "highlight", label: "Highlight", w: 0.4, h: 0.022, color: "#c9a400" },
  { kind: "comment", label: "Comment", w: 0.035, h: 0.025, color: "#e08a00" },
  { kind: "whiteout", label: "Whiteout and retype", w: 0.3, h: 0.025, color: "#666666" },
  { kind: "image", label: "Image", w: 0.25, h: 0.15, color: "#1f8a4c" },
];

function AnnotatePane(props: ToolPaneProps) {
  const { run, busy } = useRun(props);
  const id = props.file.file_id;
  const { Stage } = props;
  const [kind, setKind] = useState<Kind>("text");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [warn, setWarn] = useState("");
  const k = KINDS.find((x) => x.kind === kind)!;
  const needsText = kind === "text" || kind === "comment";

  useEffect(() => { setItems([]); setWarn(""); }, [id]);

  const place = (page: number, x: number, y: number) => {
    if (needsText && !text.trim()) return setWarn(`Type the ${kind === "comment" ? "comment" : "text"} first, then click the page.`);
    if (kind === "image" && !image) return setWarn("Choose an image first, then click the page.");
    setWarn("");
    setItems((s) => [...s, {
      ...boxAt(page, x, y, k.w, k.h), kind, color: k.color,
      text: kind === "highlight" || kind === "image" ? undefined : text,
      label: kind === "comment" ? "💬" : kind === "highlight" ? "" : text,
      image: kind === "image" ? image : undefined,
    }]);
  };

  return (
    <>
      <Stage>
        <PagePlacer fileId={id} boxes={items} onPlace={place} onRemove={(i) => setItems((s) => s.filter((_, j) => j !== i))} />
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
        {kind !== "highlight" && kind !== "image" && (
          <label className="field">{kind === "comment" ? "Comment" : kind === "whiteout" ? "Replacement text (optional)" : "Text"}
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === "comment" ? "Write your comment" : "Type the text to add"} />
          </label>
        )}
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
        <h4>2. Click the page to place it</h4>
        <p className="text">Each click adds a {k.label.toLowerCase()}. Use × on an item to remove it.</p>
        {warn ? <div className="msg warn">{warn}</div> : null}
        {items.length ? <p className="hint">{items.length} item{items.length === 1 ? "" : "s"} placed.</p> : null}
      </div>

      <div className="step">
        <button className="btn primary block" disabled={busy || !items.length}
          onClick={() => run("annotate", [id], { items: items.map(({ label, color, ...it }) => it) })}>
          {busy ? "Saving..." : `Save ${items.length} change${items.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </>
  );
}

const tool: ToolUI = { id: "annotate", Pane: AnnotatePane };
export default tool;
