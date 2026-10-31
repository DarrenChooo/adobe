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
  Pane: (props) => {
    const { run, busy } = useRun(props);
    const [pw, setPw] = useState("");
    const [pw2, setPw2] = useState("");
    const [owner, setOwner] = useState("");
    const [err, setErr] = useState("");
    const [perms, setPerms] = useState<Record<string, boolean>>(Object.fromEntries(PERMS.map(([k, , d]) => [k, d])));
    const mismatch = pw2 !== "" && pw !== pw2;
    const why = !pw ? "Enter a password" : pw !== pw2 ? (pw2 ? "Passwords don't match" : "Confirm the password") : "";
    return (
      <form
        className="stack"
        style={{ gap: 14 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (why) return;
          setErr("");
          const res = await run("protect", [props.file.file_id], { password: pw, owner_password: owner || undefined, ...perms });
          if (!res.ok) setErr(res.message);
        }}
      >
        <div className="step">
          <h4>Password to open</h4>
          <label className="field">Password
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="field">Type it again
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </label>
          {mismatch && <div className="msg err">Passwords don't match.</div>}
        </div>
        <div className="step">
          <h4>Let readers</h4>
          {PERMS.map(([k, label]) => (
            <label key={k} className="check">
              <input type="checkbox" checked={perms[k]} onChange={(e) => setPerms((s) => ({ ...s, [k]: e.target.checked }))} /> {label}
            </label>
          ))}
          <p className="hint">Most viewers respect these. The password itself is AES-256 encryption.</p>
        </div>
        <div className="step">
          <label className="field">Owner password <span className="hint">Optional. Needed later to change what readers can do.</span>
            <input type="password" value={owner} onChange={(e) => setOwner(e.target.value)} autoComplete="new-password" />
          </label>
        </div>
        <div className="step">
          {err && <div className="msg err">{err}</div>}
          <button className="btn primary block" disabled={busy || !!why}>
            {busy ? "Encrypting…" : why || "Protect with a password"}
          </button>
        </div>
      </form>
    );
  },
};
export default tool;
