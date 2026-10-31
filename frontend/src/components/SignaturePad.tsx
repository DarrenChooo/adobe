import { useEffect, useRef, useState } from "react";
import "../tools/pro/pro.css";

interface Props {
  /** Called with a transparent PNG data URL, or null when cleared. */
  onChange: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
}

/** Draw a signature with mouse/touch, or type one. Emits a PNG data URL. */
export default function SignaturePad({ onChange, width = 360, height = 120 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState("");

  const ctx = () => canvas.current!.getContext("2d")!;
  const clear = () => {
    ctx().clearRect(0, 0, width, height);
    dirty.current = false;
    onChange(null);
  };

  useEffect(() => {
    if (mode !== "type") return;
    const c = ctx();
    c.clearRect(0, 0, width, height);
    if (!typed.trim()) return onChange(null);
    c.fillStyle = "#1a2b6d";
    c.font = `italic ${Math.round(height * 0.45)}px "Brush Script MT", "Segoe Script", cursive`;
    c.textBaseline = "middle";
    c.fillText(typed, 10, height / 2, width - 20);
    onChange(canvas.current!.toDataURL("image/png"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, mode]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [((e.clientX - r.left) * width) / r.width, ((e.clientY - r.top) * height) / r.height];
  };

  return (
    <div className="stack pro-sigpad">
      <div className="seg">
        <button type="button" className={mode === "draw" ? "on" : ""} onClick={() => { setMode("draw"); clear(); }}>Draw</button>
        <button type="button" className={mode === "type" ? "on" : ""} onClick={() => { setMode("type"); clear(); }}>Type</button>
      </div>
      {mode === "type" && <input className="inp" placeholder="Type your name" value={typed} onChange={(e) => setTyped(e.target.value)} />}
      <canvas
        ref={canvas}
        width={width}
        height={height}
        aria-label={mode === "draw" ? "Draw your signature here" : "Signature preview"}
        onPointerDown={(e) => {
          if (mode !== "draw") return;
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const [x, y] = pos(e);
          const c = ctx();
          c.lineWidth = 2.5;
          c.lineCap = "round";
          c.lineJoin = "round";
          c.strokeStyle = "#1a2b6d";
          c.beginPath();
          c.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const [x, y] = pos(e);
          ctx().lineTo(x, y);
          ctx().stroke();
          dirty.current = true;
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          if (dirty.current) onChange(canvas.current!.toDataURL("image/png"));
        }}
      />
      <div className="row">
        <span className="hint" style={{ flex: 1 }}>{mode === "draw" ? "Sign in the box above." : "Your name is drawn in a signature style."}</span>
        <button type="button" className="link-btn" onClick={() => { setTyped(""); clear(); }}>Clear</button>
      </div>
    </div>
  );
}
