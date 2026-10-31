import { useState } from "react";
import type { ToolPanelProps, ToolUI } from "./registry";

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
  const shown = Object.entries(params).map(([k, v]) =>
    `${k}: ${/password/i.test(k) ? "••••" : typeof v === "string" ? v : JSON.stringify(v)}`);
  return shown.join(", ");
}

function Panel({ selectedFileIds, api, onResult }: ToolPanelProps) {
  const [sentence, setSentence] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const makePlan = async () => {
    setBusy(true);
    setError("");
    setPlan(null);
    try {
      const res = await api.runTool("assistant_command", selectedFileIds, { action: "plan", sentence });
      if (res.ok) setPlan(res.data as Plan);
      else setError(res.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runPlan = async () => {
    if (!plan) return;
    setBusy(true);
    setError("");
    try {
      onResult(await api.runTool("assistant_command", selectedFileIds, { action: "run", steps: plan.steps }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runnable = plan && plan.steps.length > 0 && plan.problems.length === 0;

  return (
    <div className="stack">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); makePlan(); }}>
        <label>
          What should happen to the selected files?
          <textarea rows={2} value={sentence} onChange={(e) => setSentence(e.target.value)} placeholder="Merge these two and compress" />
        </label>
        <button className="primary" disabled={busy || !sentence.trim()}>{busy && !plan ? "Planning…" : "Make a plan"}</button>
      </form>
      <p className="muted small">Your sentence goes to the AI model, so avoid typing a real password here. Your files don't: the AI only picks the tools.</p>
      {error && <div className="result fail">{error}</div>}

      {plan && (
        <div className="card stack">
          <div>{plan.explanation}</div>
          {plan.steps.length > 0 && (
            <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
              {plan.steps.map((s, i) => (
                <li key={i}>
                  <strong>{s.tool_id}</strong>{Object.keys(s.params).length > 0 && <> ({showParams(s.params)})</>}
                  {s.why && <div className="muted">{s.why}</div>}
                </li>
              ))}
            </ol>
          )}
          {plan.problems.map((p, i) => <div key={i} className="small" style={{ color: "var(--fail)" }}>{p}</div>)}
          {runnable && <button className="primary" disabled={busy} onClick={runPlan}>{busy ? "Running…" : `Run these ${plan.steps.length} step(s)`}</button>}
        </div>
      )}
    </div>
  );
}

const tool: ToolUI = { id: "assistant_command", Panel };
export default tool;
