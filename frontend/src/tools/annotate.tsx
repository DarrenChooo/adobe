import { useState } from "react";
import PagePlacer, { boxAt, type PlacedBox } from "../components/PagePlacer";
import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";

type Kind = "text" | "highlight" | "comment" | "whiteout" | "image";
interface Item extends PlacedBox { kind: Kind; text?: string }

const KINDS: { kind: Kind; label: string; w: number; h: number; color: string }[] = [
  { kind: "text", label: "Text box", w: 0.35, h: 0.03, color: "#2457c5" },
  { kind: "highlight", label: "Highlight", w: 0.4, h: 0.022, color: "#c9a400" },
  { kind: "comment", label: "Comment", w: 0.035, h: 0.025, color: "#e08a00" },
  { kind: "whiteout", label: "Whiteout + retype", w: 0.3, h: 0.025, color: "#666666" },
  { kind: "image", label: "Image", w: 0.25, h: 0.15, color: "#1f8a4c" },
];

const tool: ToolUI = {
  id: "annotate",
  Panel: (props) => {
    const { run, busy } = useRun(props);
    const id = props.selectedFileIds[props.selectedFileIds.length - 1];
    const [kind, setKind] = useState<Kind>("text");
    const [text, setText] = useState("");
    const [image, setImage] = useState<string | null>(null);
    const [items, setItems] = useState<Item[]>([]);
    const k = KINDS.find((x) => x.kind === kind)!;
    const needsText = kind === "text" || kind === "comment";

    if (!id) return <p className="muted">Select one PDF.</p>;
    return (
      <div className="stack">
        <div className="tabs" style={{ flexWrap: "wrap" }}>
          {KINDS.map((x) => <button key={x.kind} className={kind === x.kind ? "active" : ""} onClick={() => setKind(x.kind)}>{x.label}</button>)}
        </div>
        {kind !== "highlight" && kind !== "image" && (
          <label>{kind === "comment" ? "Comment" : kind === "whiteout" ? "Replacement text (optional)" : "Text"}
            <input value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        )}
        {kind === "image" && (
          <input type="file" accept="image/png,image/jpeg" onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => setImage(r.result as string);
            r.readAsDataURL(f);
          }} />
        )}
        <p className="muted small">Click the page to place a {k.label.toLowerCase()}.</p>
        <PagePlacer
          fileId={id}
          width={400}
          boxes={items}
          onPlace={(page, x, y) => {
            if (needsText && !text.trim()) return;
            if (kind === "image" && !image) return;
            setItems((s) => [...s, {
              ...boxAt(page, x, y, k.w, k.h), kind, color: k.color,
              text: kind === "highlight" || kind === "image" ? undefined : text,
              label: kind === "comment" ? "💬" : kind === "highlight" ? "" : text,
              image: kind === "image" ? image : undefined,
            }]);
          }}
          onRemove={(i) => setItems((s) => s.filter((_, j) => j !== i))}
        />
        <button className="primary" disabled={busy || !items.length}
          onClick={() => run("annotate", [id], { items: items.map(({ label, color, ...it }) => it) })}>
          {busy ? "Saving…" : `Save ${items.length} change(s)`}
        </button>
      </div>
    );
  },
};
export default tool;
