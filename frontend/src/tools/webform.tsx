import { useEffect, useState } from "react";
import type { ToolUI } from "./registry";
import PageBoxes from "./pro/PageBoxes";
import PublicForm from "./pro/PublicForm";
import { usePageImages } from "./pro/usePageImages";
import type { ApiLike, Box, RunResult } from "./pro/types";
import "./pro/pro.css";

type Field = { name: string; label: string; type: string; options: string[] };
type NewBox = Box & { name: string; kind: "text" | "checkbox" };

function WebformPanel({ selectedFileIds, api, onResult }: { selectedFileIds: string[]; api: ApiLike; onResult: (r: RunResult) => void }) {
  const [fileId, setFileId] = useState<string | undefined>(selectedFileIds[0]);
  const [fields, setFields] = useState<Field[] | null>(null);
  const [title, setTitle] = useState("");
  const [formId, setFormId] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [drawn, setDrawn] = useState<NewBox[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const { pages } = usePageImages(api, fields && fields.length === 0 ? fileId : undefined);

  useEffect(() => setFileId(selectedFileIds[0]), [selectedFileIds]);
  useEffect(() => {
    if (!fileId) return;
    setFields(null); setFormId(""); setDrawn([]); setMsg(null);
    api.runTool("webform", [fileId], { mode: "inspect" }).then((res) => {
      if (!res.ok) setMsg({ kind: "err", text: res.message });
      else setFields(res.data.fields as Field[]);
    });
  }, [api, fileId]);

  if (selectedFileIds.length !== 1) return <p className="pro-help">Select one PDF form.</p>;

  const create = async () => {
    if (!fileId) return;
    setBusy("create"); setMsg(null);
    const res = await api.runTool("webform", [fileId], { mode: "create", title: title || undefined });
    setBusy("");
    if (!res.ok) return setMsg({ kind: "err", text: res.message });
    setFormId(String(res.data.form_id));
    setMsg({ kind: "good", text: res.message });
  };

  const addFields = async () => {
    if (!fileId) return;
    setBusy("add"); setMsg(null);
    const boxes = drawn.map((b) => ({ page: b.page, name: b.name, label: b.name, type: b.kind, x0: b.x0, top: b.top, x1: b.x1, bottom: b.bottom }));
    const res = await api.runTool("webform", [fileId], { mode: "add_fields", boxes });
    setBusy("");
    if (!res.ok) return setMsg({ kind: "err", text: res.message });
    onResult(res);
    setMsg({ kind: "good", text: `${res.message} Now making it a web form...` });
    setFileId(res.outputs[0].file_id); // continue with the new fillable PDF
  };

  const exportCsv = async () => {
    const res = await api.runTool("webform", [], { mode: "responses", form_id: formId });
    if (!res.ok) return setMsg({ kind: "err", text: res.message });
    setCount(Number(res.data.count));
    onResult(res);
  };

  const link = formId ? `${window.location.origin}/f/${formId}` : "";
  const copy = () => navigator.clipboard.writeText(link).catch(() => setMsg({ kind: "", text: `Copy this link: ${link}` }));

  return (
    <div className="pro-panel">
      <p className="pro-help">Turns a PDF form into a link anyone can fill in. Every answer becomes a filled copy of the PDF.</p>
      {msg ? <div className={`pro-msg ${msg.kind}`}>{msg.text}</div> : null}
      {fields === null ? <p className="pro-help">Reading the form...</p> : null}

      {fields && fields.length > 0 && !formId ? (
        <>
          <ul className="pro-list">
            {fields.map((f) => <li key={f.name}><span className="pro-chip">{f.type}</span> {f.label}</li>)}
          </ul>
          <div className="pro-form">
            <label>Form title<input id="wf-title" type="text" value={title} placeholder="e.g. Event Pass Registration" onChange={(e) => setTitle(e.target.value)} /></label>
          </div>
          <div className="pro-row"><button className="pro-btn" onClick={create} disabled={!!busy}>{busy ? "Creating..." : "Create web form"}</button></div>
        </>
      ) : null}

      {fields && fields.length === 0 ? (
        <>
          <p className="pro-help">This PDF has no fill-in boxes yet. Drag on the page to draw one, name it, then add the fields.</p>
          <ul className="pro-list">
            {drawn.map((b, i) => (
              <li key={b.id}>
                <input id={`wf-name-${i}`} type="text" value={b.name} aria-label="Field name"
                  onChange={(e) => setDrawn(drawn.map((d) => (d.id === b.id ? { ...d, name: e.target.value, label: e.target.value } : d)))} />
                <select id={`wf-kind-${i}`} value={b.kind} aria-label="Field type"
                  onChange={(e) => setDrawn(drawn.map((d) => (d.id === b.id ? { ...d, kind: e.target.value as NewBox["kind"] } : d)))}>
                  <option value="text">Text</option>
                  <option value="checkbox">Tick box</option>
                </select>
                <button className="pro-btn ghost" onClick={() => setDrawn(drawn.filter((d) => d.id !== b.id))}>Remove</button>
              </li>
            ))}
          </ul>
          <div className="pro-row">
            <button className="pro-btn" onClick={addFields} disabled={!!busy || drawn.length === 0 || drawn.some((d) => !d.name.trim())}>
              {busy === "add" ? "Adding..." : `Add ${drawn.length} field(s)`}
            </button>
          </div>
          <PageBoxes
            pages={pages}
            boxes={drawn}
            onToggle={(id) => setDrawn(drawn.filter((d) => d.id !== id))}
            onDraw={(b) => setDrawn([...drawn, { ...b, id: `box-${Date.now()}`, name: `field_${drawn.length + 1}`, label: `field_${drawn.length + 1}`, kind: "text" }])}
          />
        </>
      ) : null}

      {formId ? (
        <>
          <div className="pro-row">
            <span className="pro-mono">{link}</span>
            <button className="pro-btn ghost" onClick={copy}>Copy link</button>
            <a className="pro-btn ghost" href={`/f/${formId}`} target="_blank" rel="noreferrer">Open form</a>
          </div>
          <div className="pro-row">
            <button className="pro-btn" onClick={exportCsv}>Download responses (CSV)</button>
            {count !== null ? <span className="pro-chip">{count} response(s)</span> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

const tool: ToolUI = { id: "webform", Panel: WebformPanel, routes: [{ path: "/f/:formId", element: <PublicForm /> }] };
export default tool;
