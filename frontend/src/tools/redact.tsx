import { useState } from "react";
import type { ToolPanelProps, ToolUI } from "./registry";
import PageBoxes from "./pro/PageBoxes";
import { usePageImages } from "./pro/usePageImages";
import type { Box } from "./pro/types";
import "./pro/pro.css";

type Hit = Box & { type: string; text: string };
type Hidden = { page: number; hidden_text: string };

function RedactPanel({ selectedFileIds, api, onResult }: ToolPanelProps) {
  const fileId = selectedFileIds[0];
  const { pages, error: pageError } = usePageImages(api, fileId);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState<Box[]>([]);
  const [hidden, setHidden] = useState<Hidden[] | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);

  if (selectedFileIds.length !== 1) return <p className="pro-help">Select one PDF to redact.</p>;

  const scan = async () => {
    setBusy("scan"); setMsg(null); setHidden(null);
    const res = await api.runTool("redact", [fileId], { mode: "detect" });
    setBusy("");
    if (!res.ok) return setMsg({ kind: "err", text: res.message });
    setHits((res.data.hits as Hit[]).map((h) => ({ ...h, label: h.type })));
    setExcluded(new Set());
    const scanNote = res.data.ocr_first ? " This was a scan, so text recognition ran first." : "";
    setMsg({ kind: "", text: res.message + scanNote + " Click a box to keep it visible, or drag on the page to add one." });
  };

  const audit = async () => {
    setBusy("audit"); setMsg(null);
    const res = await api.runTool("redact", [fileId], { mode: "audit" });
    setBusy("");
    if (!res.ok) return setMsg({ kind: "err", text: res.message });
    const found = res.data.hidden as Hidden[];
    setHidden(found);
    setMsg(found.length ? { kind: "bad", text: res.message } : { kind: "good", text: res.message });
  };

  const apply = async () => {
    setBusy("apply"); setMsg(null);
    const res = await api.runTool("redact", [fileId], {
      mode: "apply",
      exclude: [...excluded],
      extra_boxes: manual.map(({ page, x0, top, x1, bottom }) => ({ page, x0, top, x1, bottom })),
    });
    setBusy("");
    if (!res.ok) return setMsg({ kind: "err", text: res.message });
    const passed = res.data.leak_test === "pass";
    setMsg({ kind: passed ? "good" : "bad", text: passed ? `${res.message} Nothing redacted can be copied out of the new file.` : res.message });
    onResult(res);
  };

  const boxes: Box[] = [
    ...(hits ?? []).map((h) => ({ ...h, muted: excluded.has(h.id) })),
    ...manual,
  ];
  const toggle = (id: string) => {
    if (id.startsWith("manual-")) return setManual((m) => m.filter((b) => b.id !== id));
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const counts = (hits ?? []).filter((h) => !excluded.has(h.id)).reduce<Record<string, number>>((acc, h) => {
    acc[h.type] = (acc[h.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="pro-panel">
      <p className="pro-help">
        Finds NRIC/FIN numbers, Singapore phone numbers, emails and addresses, then removes them for real: the page is rebuilt so the
        text is gone from the file, not just covered.
      </p>
      <div className="pro-row">
        <button className="pro-btn" onClick={scan} disabled={!!busy}>{busy === "scan" ? "Scanning..." : "Find sensitive info"}</button>
        <button className="pro-btn" onClick={apply} disabled={!!busy || boxes.filter((b) => !b.muted).length === 0}>
          {busy === "apply" ? "Redacting..." : "Redact for real"}
        </button>
        <button className="pro-btn ghost" onClick={audit} disabled={!!busy}>
          {busy === "audit" ? "Checking..." : "Check an already-redacted PDF"}
        </button>
      </div>
      {msg ? <div className={`pro-msg ${msg.kind}`}>{msg.text}</div> : null}
      {pageError ? <div className="pro-msg err">Couldn't show the pages: {pageError}</div> : null}
      {hidden && hidden.length ? (
        <ul className="pro-list">
          {hidden.map((h, i) => (
            <li key={i}><span className="pro-chip">Page {h.page}</span> Hidden under a black box: <b className="pro-mono">{h.hidden_text}</b></li>
          ))}
        </ul>
      ) : null}
      {hits ? (
        <div className="pro-row">
          {Object.entries(counts).map(([k, n]) => <span key={k} className="pro-chip">{n} {k}</span>)}
          {manual.length ? <span className="pro-chip">{manual.length} drawn by you</span> : null}
        </div>
      ) : null}
      <PageBoxes
        pages={pages}
        boxes={boxes}
        onToggle={toggle}
        onDraw={(b) => setManual((m) => [...m, { ...b, id: `manual-${Date.now()}`, label: "yours" }])}
      />
    </div>
  );
}

const tool: ToolUI = { id: "redact", Panel: RedactPanel, routes: [] };
export default tool;
