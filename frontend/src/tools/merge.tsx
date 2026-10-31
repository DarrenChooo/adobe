import { useState } from "react";
import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";

const tool: ToolUI = {
  id: "merge",
  Panel: (props) => {
    const { selectedFileIds, files } = props;
    const { run, busy } = useRun(props);
    const [filename, setFilename] = useState("merged.pdf");
    const [bookmarks, setBookmarks] = useState(true);
    const pdfs = selectedFileIds.filter((id) => files.find((f) => f.file_id === id)?.pages);
    return (
      <div className="stack">
        <p className="muted">Files are merged in the order you ticked them (the numbers in the file list).</p>
        <ol className="small">
          {pdfs.map((id) => {
            const f = files.find((x) => x.file_id === id)!;
            return <li key={id}>{f.filename} <span className="muted">({f.pages} p)</span></li>;
          })}
        </ol>
        <label>Output name<input value={filename} onChange={(e) => setFilename(e.target.value)} /></label>
        <label className="inline"><input type="checkbox" checked={bookmarks} onChange={(e) => setBookmarks(e.target.checked)} /> Bookmark each file</label>
        <button className="primary" disabled={busy || pdfs.length < 2} onClick={() => run("merge", pdfs, { filename, bookmarks })}>
          {busy ? "Merging…" : pdfs.length < 2 ? "Select 2+ PDFs" : `Merge ${pdfs.length} PDFs`}
        </button>
      </div>
    );
  },
};
export default tool;
