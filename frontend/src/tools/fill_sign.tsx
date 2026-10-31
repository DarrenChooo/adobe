import { useEffect, useState } from "react";
import PagePlacer, { boxAt, type PlacedBox } from "../components/PagePlacer";
import SignaturePad from "../components/SignaturePad";
import { useRun } from "../components/useRun";
import type { ToolUI } from "./registry";

interface Field {
  name: string;
  tooltip: string | null;
  type: string;
  value: string | null;
  options: string[] | null;
  on_value: string | null;
  page: number;
}

const tool: ToolUI = {
  id: "fill_sign",
  Panel: (props) => {
    const { api } = props;
    const { run, busy } = useRun(props);
    const id = props.selectedFileIds[props.selectedFileIds.length - 1];
    const [fields, setFields] = useState<Field[]>([]);
    const [values, setValues] = useState<Record<string, string | boolean>>({});
    const [sig, setSig] = useState<string | null>(null);
    const [stamps, setStamps] = useState<PlacedBox[]>([]);
    const [flatten, setFlatten] = useState(false);
    const [loadMsg, setLoadMsg] = useState("");

    useEffect(() => {
      setFields([]); setValues({}); setStamps([]);
      if (!id) return;
      api.runTool("fill_sign", [id], { action: "list" }).then((r) => {
        setLoadMsg(r.message);
        if (!r.ok) return;
        const fs: Field[] = r.data.fields;
        setFields(fs);
        setValues(Object.fromEntries(fs.map((f) => [f.name, f.type === "checkbox" ? !!f.value && f.value !== "/Off" : f.value ?? ""])));
      });
    }, [id]);

    if (!id) return <p className="muted">Select one PDF.</p>;
    const changed = Object.fromEntries(
      Object.entries(values).filter(([k, v]) => {
        const f = fields.find((x) => x.name === k)!;
        return f.type === "checkbox" ? v !== (!!f.value && f.value !== "/Off") : v !== (f.value ?? "");
      }),
    );

    return (
      <div className="stack">
        <h3>1. Fill fields</h3>
        <p className="muted small">{loadMsg}</p>
        <div className="fields">
          {fields.filter((f) => !["signature", "button", "radio"].includes(f.type)).map((f) => (
            <label key={f.name} className={f.type === "checkbox" ? "inline" : ""}>
              {f.type === "checkbox" ? (
                <><input type="checkbox" checked={!!values[f.name]} onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.checked }))} /> {f.tooltip || f.name}</>
              ) : (
                <>
                  <span>{f.tooltip || f.name} <small className="muted">{f.tooltip ? f.name : ""} · p.{f.page}</small></span>
                  {f.options ? (
                    <select value={values[f.name] as string} onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}>
                      <option value="" />
                      {f.options.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input value={values[f.name] as string} onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))} />
                  )}
                </>
              )}
            </label>
          ))}
        </div>
        {fields.length > 0 && <label className="inline"><input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} /> Flatten (make values permanent)</label>}

        <h3>2. Sign</h3>
        <SignaturePad onChange={setSig} />
        <p className="muted small">{sig ? "Now click on the page where the signature goes." : "Draw or type a signature, then click the page to place it."}</p>
        <PagePlacer
          fileId={id}
          boxes={stamps}
          width={400}
          onPlace={(page, x, y) => sig && setStamps((s) => [...s, { ...boxAt(page, x, y, 0.3, 0.07), image: sig }])}
          onRemove={(i) => setStamps((s) => s.filter((_, j) => j !== i))}
        />
        <button
          className="primary"
          disabled={busy || (!Object.keys(changed).length && !stamps.length)}
          onClick={() => run("fill_sign", [id], {
            action: "fill",
            values: changed,
            flatten,
            stamps: stamps.map(({ page, x, y, w, h, image }) => ({ page, x, y, w, h, kind: "image", image })),
          })}
        >
          {busy ? "Saving…" : `Save (${Object.keys(changed).length} field(s), ${stamps.length} signature(s))`}
        </button>
      </div>
    );
  },
};
export default tool;
