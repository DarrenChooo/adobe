import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import * as api from "../../api";
import type { RunResult } from "./types";

type Field = { name: string; label: string; type: string; options: string[]; required: boolean };
type Schema = { form_id: string; title: string; fields: Field[] };

// The page someone opens from a shared link: /f/<form_id>. No app frame, no files needed.
export default function PublicForm() {
  const { formId = "" } = useParams();
  const [schema, setSchema] = useState<Schema | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.runTool("webform", [], { mode: "schema", form_id: formId }).then((res: RunResult) => {
      if (!res.ok) setMsg({ kind: "err", text: res.message });
      else setSchema(res.data as unknown as Schema);
    }).catch((e: Error) => setMsg({ kind: "err", text: e.message }));
  }, [formId]);

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await api.runTool("webform", [], { mode: "submit", form_id: formId, answers });
      if (!res.ok) return setMsg({ kind: "err", text: res.message });
      setDone(true);
      setMsg({ kind: "ok", text: res.message });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (!schema) return <div className="public">{msg ? <div className={`msg ${msg.kind}`}>{msg.text}</div> : <p className="hint">Loading the form...</p>}</div>;

  return (
    <div className="public">
      <div className="card stack" style={{ padding: "24px 28px" }}>
        <h1 style={{ fontSize: 22 }}>{schema.title}</h1>
        {done ? (
          <div className="msg ok">{msg?.text ?? "Thanks, your answers were saved."}</div>
        ) : (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <p className="hint">Fill in the form and press Submit. Fields marked * are required.</p>
            {schema.fields.map((f) =>
              f.type === "checkbox" ? (
                <label key={f.name} className="check">
                  <input id={`pf-${f.name}`} type="checkbox" checked={answers[f.name] === true}
                    onChange={(e) => setAnswers({ ...answers, [f.name]: e.target.checked })} /> {f.label}{f.required ? " *" : ""}
                </label>
              ) : f.type === "choice" || f.type === "radio" ? (
                <label key={f.name} className="field">
                  {f.label}{f.required ? " *" : ""}
                  <select id={`pf-${f.name}`} value={String(answers[f.name] ?? "")}
                    onChange={(e) => setAnswers({ ...answers, [f.name]: e.target.value })}>
                    <option value="">Choose...</option>
                    {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              ) : (
                <label key={f.name} className="field">
                  {f.label}{f.required ? " *" : ""}
                  <input id={`pf-${f.name}`} type="text" value={String(answers[f.name] ?? "")}
                    onChange={(e) => setAnswers({ ...answers, [f.name]: e.target.value })} />
                </label>
              ),
            )}
            {msg ? <div className={`msg ${msg.kind}`}>{msg.text}</div> : null}
            <div><button className="btn primary" type="submit" disabled={busy}>{busy ? "Sending..." : "Submit"}</button></div>
          </form>
        )}
      </div>
    </div>
  );
}
