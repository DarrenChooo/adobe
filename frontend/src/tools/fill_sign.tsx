import { useEffect, useState } from "react";
import PagePlacer, { boxAt, type PlacedBox } from "../components/PagePlacer";
import SignaturePad from "../components/SignaturePad";
import { useRun } from "../components/useRun";
import type { ToolPaneProps, ToolUI } from "./registry";

interface Field {
  name: string;
  tooltip: string | null;
  type: string;
  value: string | null;
  options: string[] | null;
  on_value: string | null;
  page: number;
}

function FillSignPane(props: ToolPaneProps) {
  const { api, Stage } = props;
  const { run, busy } = useRun(props);
  const id = props.file.file_id;
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [sig, setSig] = useState<string | null>(null);
  const [stamps, setStamps] = useState<PlacedBox[]>([]);
  const [flatten, setFlatten] = useState(false);
  const [loadMsg, setLoadMsg] = useState("Reading the form...");
  const [loadOk, setLoadOk] = useState(true);

  useEffect(() => {
    setFields([]); setValues({}); setStamps([]); setLoadMsg("Reading the form..."); setLoadOk(true);
    api.runTool("fill_sign", [id], { action: "list" }).then((r) => {
      setLoadMsg(r.message);
      setLoadOk(r.ok);
      if (!r.ok) return;
      const fs: Field[] = r.data.fields;
      setFields(fs);
      setValues(Object.fromEntries(fs.map((f) => [f.name, f.type === "checkbox" ? !!f.value && f.value !== "/Off" : f.value ?? ""])));
    }).catch((e: Error) => { setLoadMsg(e.message); setLoadOk(false); });
  }, [api, id]);

  const changed = Object.fromEntries(
    Object.entries(values).filter(([k, v]) => {
      const f = fields.find((x) => x.name === k)!;
      return f.type === "checkbox" ? v !== (!!f.value && f.value !== "/Off") : v !== (f.value ?? "");
    }),
  );
  const nChanged = Object.keys(changed).length;
  const shown = fields.filter((f) => !["signature", "button", "radio"].includes(f.type));

  return (
    <>
      <Stage>
        <PagePlacer
          fileId={id}
          boxes={stamps}
          onPlace={(page, x, y) => sig && setStamps((s) => [...s, { ...boxAt(page, x, y, 0.3, 0.07), image: sig }])}
          onRemove={(i) => setStamps((s) => s.filter((_, j) => j !== i))}
        />
      </Stage>

      <div className="step">
        <h4>1. Fill in the fields</h4>
        {!loadOk ? <div className="msg err">{loadMsg}</div> : shown.length ? null : <p className="hint">{loadMsg}</p>}
        {shown.map((f) => f.type === "checkbox" ? (
          <label key={f.name} className="check">
            <input type="checkbox" checked={!!values[f.name]} onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.checked }))} />
            {f.tooltip || f.name}
          </label>
        ) : (
          <label key={f.name} className="field">
            <span>{f.tooltip || f.name} <span className="hint">· page {f.page}</span></span>
            {f.options ? (
              <select value={values[f.name] as string} onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}>
                <option value="" />
                {f.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input value={values[f.name] as string} onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))} />
            )}
          </label>
        ))}
        {shown.length > 0 && (
          <label className="check">
            <input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} />
            Lock the answers so they can't be changed
          </label>
        )}
      </div>

      <div className="step">
        <h4>2. Sign</h4>
        <SignaturePad onChange={setSig} />
        <div className={`msg ${sig ? "info" : ""}`} style={sig ? undefined : { padding: 0 }}>
          {sig ? "Now click the page where your signature goes." : <span className="hint">Draw or type a signature, then click the page to place it.</span>}
        </div>
        {stamps.length ? <p className="hint">{stamps.length} signature{stamps.length === 1 ? "" : "s"} placed. Use × to remove one.</p> : null}
      </div>

      <div className="step">
        <button
          className="btn primary block"
          disabled={busy || (!nChanged && !stamps.length)}
          onClick={() => run("fill_sign", [id], {
            action: "fill",
            values: changed,
            flatten,
            stamps: stamps.map(({ page, x, y, w, h, image }) => ({ page, x, y, w, h, kind: "image", image })),
          })}
        >
          {busy ? "Saving..." : "Save"}
        </button>
        <p className="hint">
          {nChanged} field{nChanged === 1 ? "" : "s"} changed, {stamps.length} signature{stamps.length === 1 ? "" : "s"} placed.
        </p>
      </div>
    </>
  );
}

const tool: ToolUI = { id: "fill_sign", Pane: FillSignPane };
export default tool;
