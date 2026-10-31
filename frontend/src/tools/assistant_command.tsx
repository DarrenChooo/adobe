import { useEffect, useState } from "react";
import { entry } from "../shell/catalog";
import type { ToolPaneProps, ToolUI } from "./registry";

interface Step {
  tool_id: string;
  params: Record<string, unknown>;
  why?: string;
}

interface Plan {
  explanation: string;
  steps: Step[];
  problems: string[];
}

function showParams(params: Record<string, unknown>) {
  return Object.entries(params).map(([k, v]) =>
    `${k.replace(/_/g, " ")}: ${/password/i.test(k) ? "••••" : typeof v === "string" ? v : JSON.stringify(v)}`).join(", ");
}

function Pane({ file, files, api, onResult }: ToolPaneProps) {
  const [sentence, setSentence] = useState("");
  const [also, setAlso] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState<"" | "plan" | "run">("");
  const [error, setError] = useState("");

  useEffect(() => { setPlan(null); setAlso([]); setError(""); }, [file.file_id]);

  const others = files.filter((f) => f.file_id !== file.file_id && /\.pdf$/i.test(f.filename));
  const fileIds = [file.file_id, ...also];

  const makePlan = async () => {
    setBusy("plan");
    setError("");
    setPlan(null);
    try {
      const res = await api.runTool("assistant_command", fileIds, { action: "plan", sentence });
      if (res.ok) setPlan(res.data as Plan);
      else setError(res.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const runPlan = async () => {
    if (!plan) return;
    setBusy("run");
    setError("");
    try {
      onResult(await api.runTool("assistant_command", fileIds, { action: "run", steps: plan.steps }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const runnable = plan && plan.steps.length > 0 && plan.problems.length === 0;

  return (
    <>
      <form className="step" onSubmit={(e) => { e.preventDefault(); makePlan(); }}>
        <label className="field">
          What should happen to this file?
          <textarea rows={3} value={sentence} onChange={(e) => { setSentence(e.target.value); setPlan(null); }}
            placeholder="Compress it and add a password" />
        </label>
        {others.length > 0 && (
          <details>
            <summary className="hint" style={{ cursor: "pointer" }}>Also include other files{also.length ? ` (${also.length})` : ""}</summary>
            <div className="stack" style={{ marginTop: 8, gap: 6 }}>
              {others.map((f) => (
                <label key={f.file_id} className="check" style={{ fontSize: 13 }}>
                  <input type="checkbox" checked={also.includes(f.file_id)}
                    onChange={(e) => { setPlan(null); setAlso((a) => e.target.checked ? [...a, f.file_id] : a.filter((x) => x !== f.file_id)); }} />
                  {f.filename}
                </label>
              ))}
            </div>
          </details>
        )}
        <button className={`btn block${plan ? "" : " primary"}`} disabled={!!busy || !sentence.trim()}>{busy === "plan" ? "Planning…" : "Make a plan"}</button>
        <p className="hint">Your sentence goes to the AI model, so don't type a real password here. Your files don't: the AI only picks the tools.</p>
        {error && <div className="msg err">{error}</div>}
      </form>

      {plan && (
        <div className="step">
          {plan.explanation && <p className="text">{plan.explanation}</p>}
          {plan.steps.length > 0 && (
            <ol className="stack" style={{ margin: 0, paddingLeft: 20, gap: 8 }}>
              {plan.steps.map((s, i) => (
                <li key={i} style={{ fontSize: 14 }}>
                  <strong>{entry(s.tool_id)?.name ?? s.tool_id}</strong>
                  {Object.keys(s.params).length > 0 && <div className="hint">{showParams(s.params)}</div>}
                  {s.why && <div className="hint">{s.why}</div>}
                </li>
              ))}
            </ol>
          )}
          {plan.problems.map((p, i) => <div key={i} className="msg err">{p}</div>)}
          {runnable && (
            <button className="btn primary block" disabled={!!busy} onClick={runPlan}>
              {busy === "run" ? "Running…" : `Run ${plan.steps.length === 1 ? "this step" : `these ${plan.steps.length} steps`}`}
            </button>
          )}
        </div>
      )}
    </>
  );
}

const tool: ToolUI = { id: "assistant_command", Pane };
export default tool;
