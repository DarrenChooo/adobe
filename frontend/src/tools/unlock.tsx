import { useState } from "react";
import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";

const tool: ToolUI = {
  id: "unlock",
  Panel: (props) => {
    const { run, busy } = useRun(props);
    const [pw, setPw] = useState("");
    const id = props.selectedFileIds[props.selectedFileIds.length - 1];
    return (
      <form className="stack" onSubmit={(e) => { e.preventDefault(); run("unlock", [id], { password: pw }); }}>
        <label>Password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <button className="primary" disabled={busy || !id || !pw}>{busy ? "Unlocking…" : "Remove password"}</button>
      </form>
    );
  },
};
export default tool;
