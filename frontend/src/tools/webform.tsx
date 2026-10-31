import { useEffect, useState } from "react";
import type { ToolPaneProps, ToolUI } from "./registry";
import PageBoxes from "./pro/PageBoxes";
import PublicForm from "./pro/PublicForm";
import { usePageImages } from "./pro/usePageImages";
import type { Box } from "./pro/types";

type Field = { name: string; label: string; type: string; options: string[] };
type NewBox = Box & { name: string; kind: "text" | "checkbox" };
type Msg = { kind: "ok" | "err" | "info"; text: string } | null;

function WebformPane({ file, api, onResult, openFile, Stage }: ToolPaneProps) {
  const [fileId, setFileId] = useState<string>(file.file_id);
  const [fields, setFields] = useState<Field[] | null>(null);
  const [title, setTitle] = useState("");
  const [formId, setFormId] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [drawn, setDrawn] = useState<NewBox[]>([]);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const noFields = fields !== null && fields.length === 0;
  const { pages } = usePageImages(api, noFields ? fileId : undefined);

  useEffect(() => setFileId(file.file_id), [file.file_id]);
  useEffect(() => {
    // Keeps any message: after "Add fields" it tells the user what to do next.
    setFields(null); setFormId(""); setDrawn([]); setCount(null);
    api.runTool("webform", [fileId], { mode: "inspect" }).then((res) => {
      if (!res.ok) setMsg({ kind: "err", text: res.message });
      else setFields(res.data.fields as Field[]);
    }).catch((e: Error) => setMsg({ kind: "err", text: e.message }));
  }, [api, fileId]);

  const create = async () => {
    setBusy("create"); setMsg(null);
    try {
      const res = await api.runTool("webform", [fileId], { mode: "create", title: title || undefined });
      if (!res.ok) return setMsg({ kind: "err", text: res.message });
      setFormId(String(res.data.form_id));
      setMsg({ kind: "ok", text: res.message });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  const addFields = async () => {
    setBusy("add"); setMsg(null);
    const boxes = drawn.map((b) => ({ page: b.page, name: b.name, label: b.name, type: b.kind, x0: b.x0, top: b.top, x1: b.x1, bottom: b.bottom }));
    try {
      const res = await api.runTool("webform", [fileId], { mode: "add_fields", boxes });
      if (!res.ok) return setMsg({ kind: "err", text: res.message });
      // The frame opens the new fillable PDF as a background tab; this pane carries on with it.
      onResult(res);
      setFileId(res.outputs[0].file_id);
      setMsg({ kind: "ok", text: `${res.message} Now give the form a title and create the link.` });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  const exportCsv = async () => {
    try {
      const res = await api.runTool("webform", [], { mode: "responses", form_id: formId });
      if (!res.ok) return setMsg({ kind: "err", text: res.message });
      setCount(Number(res.data.count));
      onResult(res);
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  };

  const link = formId ? `${window.location.origin}/f/${formId}` : "";
  const copy = () => {
    navigator.clipboard.writeText(link).then(() => setCopied(true)).catch(() => setMsg({ kind: "info", text: `Copy this link: ${link}` }));
  };

  return (
    <>
      {noFields ? (
        <Stage>
          {!pages.length ? <p className="hint">Loading pages...</p> : null}
          <PageBoxes
            pages={pages}
            boxes={drawn}
            onToggle={(id) => setDrawn(drawn.filter((d) => d.id !== id))}
            onDraw={(b) => setDrawn([...drawn, { ...b, id: `box-${Date.now()}`, name: `field_${drawn.length + 1}`, label: `field_${drawn.length + 1}`, kind: "text" }])}
          />
        </Stage>
      ) : null}

      <p className="text">Turns a PDF form into a link anyone can fill in. Every answer becomes a filled copy of the PDF.</p>
      {fields === null && !msg ? <p className="hint">Reading the form...</p> : null}

      {noFields ? (
        <div className="step">
          <h4>1. Draw the fields</h4>
          <p className="text">This PDF has no fill-in boxes yet. Drag on the page to draw one, then name it. Click a box to remove it.</p>
          {drawn.map((b, i) => (
            <div key={b.id} className="row" style={{ flexWrap: "nowrap" }}>
              <input id={`wf-name-${i}`} className="inp" type="text" value={b.name} aria-label="Field name"
                onChange={(e) => setDrawn(drawn.map((d) => (d.id === b.id ? { ...d, name: e.target.value, label: e.target.value } : d)))} />
              <select id={`wf-kind-${i}`} className="inp" style={{ width: 92, flex: "none" }} value={b.kind} aria-label="Field type"
                onChange={(e) => setDrawn(drawn.map((d) => (d.id === b.id ? { ...d, kind: e.target.value as NewBox["kind"] } : d)))}>
                <option value="text">Text</option>
                <option value="checkbox">Tick box</option>
              </select>
              <button className="link-btn" onClick={() => setDrawn(drawn.filter((d) => d.id !== b.id))} aria-label="Remove field">×</button>
            </div>
          ))}
          <button className="btn primary block" onClick={addFields} disabled={!!busy || drawn.length === 0 || drawn.some((d) => !d.name.trim())}>
            {busy === "add" ? "Adding..." : `Add ${drawn.length} field${drawn.length === 1 ? "" : "s"}`}
          </button>
        </div>
      ) : null}

      {fields && fields.length > 0 && !formId ? (
        <>
          <div className="step">
            <h4>1. Check the fields</h4>
            <ul className="list">
              {fields.map((f) => <li key={f.name}><span className="chip blue">{f.type}</span> <span className="small">{f.label}</span></li>)}
            </ul>
          </div>
          <div className="step">
            <h4>2. Make the link</h4>
            <label className="field">Form title
              <input id="wf-title" type="text" value={title} placeholder="e.g. Event pass registration" onChange={(e) => setTitle(e.target.value)} />
            </label>
            <button className="btn primary block" onClick={create} disabled={!!busy}>{busy === "create" ? "Creating..." : "Create web form"}</button>
          </div>
        </>
      ) : null}

      {msg ? <div className={`msg ${msg.kind}`}>{msg.text}</div> : null}

      {formId ? (
        <div className="step">
          <h4>Share the form</h4>
          <a className="mono" style={{ wordBreak: "break-all" }} href={`/f/${formId}`} target="_blank" rel="noreferrer">{link}</a>
          <div className="row">
            <button className="btn small" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
            <a className="btn small" href={`/f/${formId}`} target="_blank" rel="noreferrer">Open form</a>
          </div>
          <button className="btn block" onClick={exportCsv}>Download responses (CSV)</button>
          {count !== null ? <p className="hint">{count} response{count === 1 ? "" : "s"} so far.</p> : null}
          {fileId !== file.file_id ? (
            <button className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => openFile(fileId)}>Open the fillable PDF</button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

const tool: ToolUI = { id: "webform", Pane: WebformPane, routes: [{ path: "/f/:formId", frame: "none", element: <PublicForm /> }] };
export default tool;
