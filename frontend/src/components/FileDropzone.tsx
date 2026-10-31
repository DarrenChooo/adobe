import { useRef, useState } from "react";

interface Props {
  onFiles: (files: File[]) => void;
  accept?: string;
  label?: string;
}

/** Drag-and-drop area that also opens a file picker on click. */
export default function FileDropzone({ onFiles, accept, label = "Drop a file here, or click to choose one" }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`drop${over ? " over" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <svg className="icon" viewBox="0 0 24 24" style={{ width: 26, height: 26 }} aria-hidden="true"><path d="M12 20V8M7 13l5-5 5 5M5 4h14" /></svg>
      <b>{label}</b>
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </div>
  );
}
