import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";

const tool: ToolUI = {
  id: "generate",
  Panel: (props) => {
    const { run, busy } = useRun(props);
    const id = props.selectedFileIds[props.selectedFileIds.length - 1];
    return (
      <div className="stack">
        <p className="muted small">The AI writes the words from this PDF's text, and the app builds the file. Check the facts before sharing it.</p>
        <div className="row">
          <button className="primary" disabled={busy || !id} onClick={() => run("generate", [id], { kind: "deck" })}>
            {busy ? "Working…" : "Make a slide deck"}
          </button>
          <button disabled={busy || !id} onClick={() => run("generate", [id], { kind: "flyer" })}>Make a flyer</button>
        </div>
      </div>
    );
  },
};
export default tool;
