import { useState } from "react";
import { useRun } from "../components/useRun";
import type { ToolPaneProps, ToolUI } from "./registry";

function Pane(props: ToolPaneProps) {
  const { run, busy } = useRun(props);
  const [kind, setKind] = useState<"deck" | "flyer" | "">("");
  const id = props.file.file_id;
  const make = async (k: "deck" | "flyer") => {
    setKind(k);
    await run("generate", [id], { kind: k });
    setKind("");
  };
  return (
    <div className="step">
      <p className="hint">The AI writes the words from this PDF's text, and Fill Me builds the file. Check the facts before you share it.</p>
      <button className="btn primary block" disabled={busy} onClick={() => make("deck")}>
        {busy && kind === "deck" ? "Making the deck…" : "Make a slide deck"}
      </button>
      <button className="btn block" disabled={busy} onClick={() => make("flyer")}>
        {busy && kind === "flyer" ? "Making the flyer…" : "Make a flyer"}
      </button>
    </div>
  );
}

const tool: ToolUI = { id: "generate", Pane };
export default tool;
