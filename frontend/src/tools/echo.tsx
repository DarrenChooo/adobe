import { useState } from "react";
import type { ToolUI } from "./registry";

const tool: ToolUI = {
  id: "echo",
  Panel: ({ selectedFileIds, api, onResult }) => {
    const [busy, setBusy] = useState(false);
    return (
      <div className="stack">
        <p className="muted">Returns the selected files unchanged. Use it to check the pipeline.</p>
        <button
          className="primary"
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
