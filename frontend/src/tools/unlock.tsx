import { useState } from "react";
import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";

const tool: ToolUI = {
  id: "unlock",
  Pane: (props) => {
    const { run, busy } = useRun(props);
    const [pw, setPw] = useState("");
    const [err, setErr] = useState("");
    return (
      <form
        className="step"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr("");
          const res = await run("unlock", [props.file.file_id], { password: pw });
          if (!res.ok) setErr(res.message);
        }}
      >
        <p className="hint">Enter the password that opens this PDF. You get a copy that opens without one.</p>
        <label className="field">Password
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
        </label>
        {err && <div className="msg err">{err}</div>}
        <button className="btn primary block" disabled={busy || !pw}>
          {busy ? "Unlocking…" : pw ? "Remove password" : "Enter the password first"}
        </button>
      </form>
    );
  },
};
export default tool;
