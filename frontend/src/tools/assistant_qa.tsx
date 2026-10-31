import { useEffect, useState } from "react";
import type { ToolPanelProps, ToolUI } from "./registry";

interface Citation {
  page: number;
  quote: string;
  verified: boolean;
  page_exists: boolean;
}

interface Answer {
  found: boolean;
  answer: string;
  citations: Citation[];
  all_verified: boolean;
  needs_ocr?: boolean;
  pages_sent: number[];
  page_count?: number;
}

function Panel({ selectedFileIds, api }: ToolPanelProps) {
  const id = selectedFileIds[selectedFileIds.length - 1];
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [summary, setSummary] = useState("");
  const [badPages, setBadPages] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setAnswer(null); setSummary(""); setError(""); }, [id]);

  const call = async (params: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const res = await api.runTool("assistant_qa", [id], params);
      if (!res.ok) {
        setError(res.message);
        return null;
      }
      return res;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const ask = async () => {
    setAnswer(null);
    setSummary("");
    const res = await call({ action: "ask", question });
    if (res) setAnswer(res.data as Answer);
  };

  const summarise = async () => {
    setAnswer(null);
    setSummary("");
    const res = await call({ action: "summary" });
    if (res) {
      setSummary(res.data.summary || res.message);
      setBadPages(res.data.invalid_pages ?? []);
    }
  };

  const partial = answer && answer.page_count && answer.pages_sent.length < answer.page_count;

  return (
    <div className="stack">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <label>
          Your question
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What is the deadline?" />
        </label>
        <div className="row">
          <button className="primary" disabled={busy || !id || !question.trim()}>{busy ? "Reading…" : "Ask"}</button>
          <button type="button" disabled={busy || !id} onClick={summarise}>Summarise</button>
        </div>
      </form>
      <p className="muted small">The text of this PDF is sent to the AI model. Don't use documents you can't share with it.</p>
      {error && <div className="result fail">{error}</div>}

      {answer && (
        <div className={`result ${answer.found ? "ok" : ""} card`}>
          <div className="result-msg">{answer.answer}</div>
          {answer.found && !answer.all_verified && (
            <p className="small" style={{ color: "var(--warn)" }}>
              ⚠ Not every citation could be found in the document. Check this answer yourself.
            </p>
          )}
          {answer.citations.length > 0 && (
            <ul className="small" style={{ paddingLeft: 18, marginBottom: 0 }}>
              {answer.citations.map((c, i) => (
                <li key={i}>
                  {c.verified ? "✓" : "⚠"} Page {c.page}
                  {c.quote && <>: <em>"{c.quote}"</em></>}
                  {!c.page_exists && " (this page doesn't exist)"}
                  {c.page_exists && !c.verified && " (these words weren't found on this page)"}
                </li>
              ))}
            </ul>
          )}
          {partial && (
            <p className="muted small">Long document: searched the {answer.pages_sent.length} most relevant of {answer.page_count} pages.</p>
          )}
        </div>
      )}

      {summary && (
        <div className="card">
          <div style={{ whiteSpace: "pre-wrap" }}>{summary}</div>
          {badPages.length > 0 && (
            <p className="small" style={{ color: "var(--warn)" }}>⚠ This cites pages that don't exist: {badPages.join(", ")}.</p>
          )}
        </div>
      )}
    </div>
  );
}

const tool: ToolUI = { id: "assistant_qa", Panel };
export default tool;
