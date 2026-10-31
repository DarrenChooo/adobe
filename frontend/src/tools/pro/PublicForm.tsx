import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import * as api from "../../api";
import type { RunResult } from "./types";
import "./pro.css";

type Field = { name: string; label: string; type: string; options: string[]; required: boolean };
type Schema = { form_id: string; title: string; fields: Field[] };

// The page someone opens from a shared link: /f/<form_id>. No app shell, no files needed.
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
    });
  }, [formId]);

  const submit = async () => {
    setBusy(true); setMsg(null);
    const res = await api.runTool("webform", [], { mode: "submit", form_id: formId, answers });
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: res.message });
    setDone(true);
    setMsg({ kind: "good", text: res.message });
  };

  if (!schema) return <div className="pro-public">{msg ? <div className={`pro-msg ${msg.kind}`}>{msg.text}</div> : "Loading form..."}</div>;

  return (
    <div className="pro-public">
      <h1>{schema.title}</h1>
      {done ? (
        <div className="pro-msg good">{msg?.text ?? "Thanks, your answers were saved."}</div>
      ) : (
        <form className="pro-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          {schema.fields.map((f) =>
            f.type === "checkbox" ? (
              <label key={f.name} className="check">
                <input id={`pf-${f.name}`} type="checkbox" checked={answers[f.name] === true}
                  onChange={(e) => setAnswers({ ...answers, [f.name]: e.target.checked })} /> {f.label}
              </label>
            ) : f.type === "choice" || f.type === "radio" ? (
              <label key={f.name}>
                {f.label}{f.required ? " *" : ""}
                <select id={`pf-${f.name}`} value={String(answers[f.name] ?? "")}
                  onChange={(e) => setAnswers({ ...answers, [f.name]: e.target.value })}>
                  <option value="">Choose...</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            ) : (
              <label key={f.name}>
                {f.label}{f.required ? " *" : ""}
                <input id={`pf-${f.name}`} type="text" value={String(answers[f.name] ?? "")}
                  onChange={(e) => setAnswers({ ...answers, [f.name]: e.target.value })} />
              </label>
            ),
          )}
          {msg ? <div className={`pro-msg ${msg.kind}`}>{msg.text}</div> : null}
          <div><button className="pro-btn" type="submit" disabled={busy}>{busy ? "Sending..." : "Submit"}</button></div>
        </form>
      )}
    </div>
  );
}
