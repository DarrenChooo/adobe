import { useState } from "react";
import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";

const PERMS = [
  ["allow_print", "Printing", true],
  ["allow_copy", "Copying text and images", false],
  ["allow_modify", "Editing and page changes", false],
  ["allow_annotate", "Comments and form filling", true],
] as const;

const tool: ToolUI = {
  id: "protect",
  Panel: (props) => {
    const { run, busy } = useRun(props);
    const [pw, setPw] = useState("");
    const [pw2, setPw2] = useState("");
    const [owner, setOwner] = useState("");
    const [perms, setPerms] = useState<Record<string, boolean>>(Object.fromEntries(PERMS.map(([k, , d]) => [k, d])));
    const id = props.selectedFileIds[props.selectedFileIds.length - 1];
    const mismatch = pw2 !== "" && pw !== pw2;
    return (
      <form className="stack" onSubmit={(e) => { e.preventDefault(); run("protect", [id], { password: pw, owner_password: owner || undefined, ...perms }); }}>
        <label>Password to open<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></label>
        <label>Confirm<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></label>
        {mismatch && <small style={{ color: "var(--fail)" }}>Passwords don't match.</small>}
        <fieldset className="stack card">
          <legend>Allow readers to…</legend>
          {PERMS.map(([k, label]) => (
            <label key={k} className="inline"><input type="checkbox" checked={perms[k]} onChange={(e) => setPerms((s) => ({ ...s, [k]: e.target.checked }))} /> {label}</label>
          ))}
          <small className="muted">Permissions are honoured by well-behaved viewers only. The password itself is real AES-256 encryption.</small>
        </fieldset>
        <label>Owner password <small className="muted">(optional, for changing permissions)</small>
          <input type="password" value={owner} onChange={(e) => setOwner(e.target.value)} autoComplete="new-password" />
        </label>
        <button className="primary" disabled={busy || !id || !pw || pw !== pw2}>{busy ? "Encrypting…" : "Protect with AES-256"}</button>
      </form>
    );
  },
};
export default tool;
