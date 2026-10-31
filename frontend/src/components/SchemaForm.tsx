import { useState } from "react";
import type { ToolPaneProps } from "../tools/registry";

type Prop = { type?: string; enum?: unknown[]; default?: unknown; description?: string; title?: string };

/** Fallback panel built from a tool's params_schema, for server tools with no .tsx yet. */
export default function SchemaForm({ tool, file, api, onResult }: ToolPaneProps) {
  const selectedFileIds = [file.file_id];
  const props = ((tool?.params_schema as any)?.properties ?? {}) as Record<string, Prop>;
  const [values, setValues] = useState<Record<string, any>>(() =>
    Object.fromEntries(Object.entries(props).map(([k, p]) => [k, p.default ?? (p.type === "boolean" ? false : "")])),
  );
  const [busy, setBusy] = useState(false);
  if (!tool) return null;

  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const params: Record<string, unknown> = {};
        for (const [k, p] of Object.entries(props)) {
          const v = values[k];
          if (v === "" || v === undefined) continue;
          if (p.type === "integer" || p.type === "number") params[k] = Number(v);
          else if (p.type === "array" || p.type === "object") {
            try {
              params[k] = JSON.parse(v);
            } catch {
              params[k] = v;
            }
          } else params[k] = v;
        }
        try {
          onResult(await api.runTool(tool.id, selectedFileIds, params));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="muted">No custom UI for this tool yet; options come from its schema.</p>
      {Object.entries(props).map(([k, p]) => (
        <label key={k}>
          <span>{p.title ?? k}{p.description ? <small className="muted"> — {p.description}</small> : null}</span>
          {p.enum ? (
            <select value={values[k] as string} onChange={(e) => set(k, e.target.value)}>
              {p.enum.map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
            </select>
          ) : p.type === "boolean" ? (
            <input type="checkbox" checked={!!values[k]} onChange={(e) => set(k, e.target.checked)} />
          ) : (
            <input
              type={p.type === "integer" || p.type === "number" ? "number" : "text"}
              value={typeof values[k] === "object" ? JSON.stringify(values[k]) : (values[k] as string)}
              onChange={(e) => set(k, e.target.value)}
            />
          )}
        </label>
      ))}
      <button className="btn primary block" disabled={busy}>{busy ? "Running…" : `Run ${tool.name}`}</button>
    </form>
  );
}
