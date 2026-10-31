import { useState } from "react";
import type { ToolUI } from "./registry";

const tool: ToolUI = {
  id: "echo",
  Pane: ({ file, api, onResult }) => {
    const selectedFileIds = [file.file_id];
    const [busy, setBusy] = useState(false);
    return (
      <div className="stack">
        <p className="hint">Returns the file unchanged. Use it to check the pipeline.</p>
        <button
          className="btn primary block"
          disabled={busy || selectedFileIds.length === 0}
          onClick={async () => {
            setBusy(true);
            try {
              onResult(await api.runTool("echo", selectedFileIds, {}));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Running…" : "Run echo"}
        </button>
      </div>
    );
  },
};
export default tool;
