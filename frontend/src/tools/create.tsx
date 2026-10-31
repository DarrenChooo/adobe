import { useState } from "react";
import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";

const IMG = /\.(jpe?g|png|gif|bmp|tiff?|webp)$/i;
const TXT = /\.(txt|md|markdown)$/i;

const tool: ToolUI = {
  id: "create",
  Panel: (props) => {
    const { run, busy } = useRun(props);
    const [text, setText] = useState("");
    const [pageSize, setPageSize] = useState("A4");
    const [fit, setFit] = useState("page");
    const usable = props.selectedFileIds.filter((id) => {
      const n = props.files.find((f) => f.file_id === id)?.filename ?? "";
      return IMG.test(n) || TXT.test(n);
    });
    return (
      <div className="stack">
        <p className="muted">Selected images become one PDF (a page each, in tick order). Selected .txt/.md files each become a PDF. Or type below.</p>
        <p className="small">{usable.length} usable file(s) selected.</p>
        <label>Text or Markdown <small className="muted">(optional)</small>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"# Title\n\nSome **bold** text.\n\n- a list item"} />
        </label>
        <div className="row">
          <label>Page size<select value={pageSize} onChange={(e) => setPageSize(e.target.value)}><option>A4</option><option>Letter</option></select></label>
          <label>Images<select value={fit} onChange={(e) => setFit(e.target.value)}><option value="page">Fit to page</option><option value="image">Page = image size</option></select></label>
        </div>
        <button className="primary" disabled={busy || (!usable.length && !text.trim())}
          onClick={() => run("create", usable, { text: text.trim() || undefined, page_size: pageSize, fit })}>
          {busy ? "Creating…" : "Create PDF"}
        </button>
      </div>
    );
  },
};
export default tool;
