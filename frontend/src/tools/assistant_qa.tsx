import { useEffect, useRef, useState } from "react";
import type { ToolPaneProps, ToolUI } from "./registry";
import "./assistant_qa.css";

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

type Msg =
  | { who: "me"; text: string }
  | { who: "ai"; text: string; citations?: Citation[]; note?: string }
  | { who: "err"; text: string };

// Conversations live as long as the app is open, one per document.
const chats = new Map<string, Msg[]>();

const SUGGESTIONS = ["What is this document about?", "What do I need to do, and by when?"];

function Pane({ file, api }: ToolPaneProps) {
  const id = file.file_id;
  const [log, setLog] = useState<Msg[]>(() => chats.get(id) ?? []);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { setLog(chats.get(id) ?? []); setQuestion(""); }, [id]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [log, busy]);

  const push = (msg: Msg) => {
    const next = [...(chats.get(id) ?? []), msg];
    chats.set(id, next);
    setLog(next);
  };

  const call = async (params: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await api.runTool("assistant_qa", [id], params);
      if (!res.ok) {
        push({ who: "err", text: res.message });
        return null;
      }
      return res;
    } catch (e) {
      push({ who: "err", text: (e as Error).message });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setQuestion("");
    push({ who: "me", text });
    const res = await call({ action: "ask", question: text });
    if (!res) return;
    const a = res.data as Answer;
    const notes: string[] = [];
    if (a.found && !a.all_verified) notes.push("Not every quote could be found in the document. Check this answer yourself.");
    if (a.page_count && a.pages_sent && a.pages_sent.length < a.page_count) {
      notes.push(`Long document: searched the ${a.pages_sent.length} most relevant of ${a.page_count} pages.`);
    }
    push({ who: "ai", text: a.answer, citations: a.citations, note: notes.join(" ") || undefined });
  };

  const summarise = async () => {
    if (busy) return;
    push({ who: "me", text: "Summarise this" });
    const res = await call({ action: "summary" });
    if (!res) return;
    const bad: number[] = res.data.invalid_pages ?? [];
    push({
      who: "ai",
      text: res.data.summary || res.message,
      note: bad.length ? `⚠ This cites pages that don't exist: ${bad.join(", ")}.` : undefined,
    });
  };

  const pages = file.pages ? ` (${file.pages} page${file.pages === 1 ? "" : "s"})` : "";

  return (
    <div className="assistant_qa">
      <div className="assistant_qa-log">
        <div className="assistant_qa-msg ai">
          I've read <strong>{file.filename}</strong>{pages}. Ask me anything about it.
        </div>
        {log.map((m, i) => (
          <div key={i} className={`assistant_qa-msg ${m.who}`}>
            {m.text}
            {m.who === "ai" && m.citations?.map((c, j) => (
              <span key={j} className="chip" title={c.quote ? `"${c.quote}"` : undefined}>p.{c.page}</span>
            ))}
            {m.who === "ai" && !!m.citations?.length && (
              <div className="assistant_qa-checks">
                {m.citations.map((c, j) => (
                  <span key={j} className={c.verified ? "ok" : "bad"}>
                    {c.verified ? `✓ Quote found on page ${c.page}`
                      : !c.page_exists ? `⚠ Page ${c.page} doesn't exist`
                      : `⚠ Not found on page ${c.page}`}
                  </span>
                ))}
              </div>
            )}
            {m.who === "ai" && m.note && <div className="assistant_qa-note">{m.note}</div>}
          </div>
        ))}
        {busy && <div className="assistant_qa-msg ai">Reading…</div>}
        <div ref={end} />
      </div>

      <div className="assistant_qa-sugg">
        <button disabled={busy} onClick={summarise}>Summarise this</button>
        {SUGGESTIONS.map((s) => <button key={s} disabled={busy} onClick={() => ask(s)}>{s}</button>)}
      </div>
      <form className="assistant_qa-ask" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about this document" aria-label="Ask about this document" />
        <button disabled={busy || !question.trim()} aria-label="Send" title="Send">↵</button>
      </form>
      <p className="assistant_qa-privacy">The text of this PDF is sent to the AI model. Don't use documents you can't share with it.</p>
    </div>
  );
}

const tool: ToolUI = { id: "assistant_qa", Pane };
export default tool;
