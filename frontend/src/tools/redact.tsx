import { useEffect, useState } from "react";
import type { RunResult } from "../api";
import type { ToolPaneProps, ToolUI } from "./registry";
import PageBoxes from "./pro/PageBoxes";
import { usePageImages } from "./pro/usePageImages";
import type { Box } from "./pro/types";

type Hit = Box & { type: string; text: string };
type Hidden = { page: number; hidden_text: string };
type Msg = { kind: "ok" | "err" | "info" | "warn"; text: string } | null;
const nice = (t: string) => (t === "nric" ? "NRIC" : t);

function RedactPane({ file, api, onResult, Stage }: ToolPaneProps) {
  const fileId = file.file_id;
  const { pages, error: pageError } = usePageImages(api, fileId);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState<Box[]>([]);
  const [hidden, setHidden] = useState<Hidden[] | null>(null);
  const [busy, setBusy] = useState("");
  const [findMsg, setFindMsg] = useState<Msg>(null);
  const [applyMsg, setApplyMsg] = useState<Msg>(null);
  const [auditMsg, setAuditMsg] = useState<Msg>(null);

  useEffect(() => {
    setHits(null); setExcluded(new Set()); setManual([]); setHidden(null);
    setFindMsg(null); setApplyMsg(null); setAuditMsg(null);
  }, [fileId]);

  const call = async (params: Record<string, unknown>): Promise<RunResult> => {
    try {
      return await api.runTool("redact", [fileId], params);
    } catch (e) {
      return { ok: false, message: (e as Error).message, outputs: [], data: {} };
    }
  };

  const scan = async () => {
    setBusy("scan"); setFindMsg(null); setApplyMsg(null);
    const res = await call({ mode: "detect" });
    setBusy("");
    if (!res.ok) return setFindMsg({ kind: "err", text: res.message });
    setHits((res.data.hits as Hit[]).map((h) => ({ ...h, label: nice(h.type) })));
    setExcluded(new Set());
    setFindMsg(res.data.ocr_first ? { kind: "info", text: "This was a scan, so text recognition ran first." } : null);
    if (!(res.data.hits as Hit[]).length) setFindMsg({ kind: "info", text: res.message });
  };

  const audit = async () => {
    setBusy("audit"); setAuditMsg(null);
    const res = await call({ mode: "audit" });
    setBusy("");
    if (!res.ok) return setAuditMsg({ kind: "err", text: res.message });
    const found = res.data.hidden as Hidden[];
    setHidden(found);
    setAuditMsg({ kind: found.length ? "err" : "ok", text: res.message });
  };

  const apply = async () => {
    setBusy("apply"); setApplyMsg(null);
    const res = await call({
      mode: "apply",
      exclude: [...excluded],
      extra_boxes: manual.map(({ page, x0, top, x1, bottom }) => ({ page, x0, top, x1, bottom })),
    });
    setBusy("");
    onResult(res);
    if (!res.ok) return setApplyMsg({ kind: "err", text: res.message });
    const passed = res.data.leak_test === "pass";
    setApplyMsg(passed
      ? { kind: "ok", text: "Leak test passed: nothing you redacted can be copied out of the new file." }
      : { kind: "err", text: `Leak test failed: ${res.message}` });
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
  const active = boxes.filter((b) => !b.muted).length;

  return (
    <>
      <Stage>
        {pageError ? <div className="msg err">Couldn't show the pages: {pageError}</div> : null}
        {!pages.length && !pageError ? <p className="hint">Loading pages...</p> : null}
        <PageBoxes
          pages={pages}
          boxes={boxes}
          onToggle={toggle}
          onDraw={(b) => setManual((m) => [...m, { ...b, id: `manual-${Date.now()}`, label: "yours" }])}
        />
      </Stage>

      <div className="step">
        <h4>1. Find what to hide</h4>
        <p className="text">Looks for NRIC/FIN numbers, Singapore phone numbers, emails and addresses.</p>
        <button className="btn block" onClick={scan} disabled={!!busy}>
          {busy === "scan" ? "Searching..." : hits ? "Search again" : "Find sensitive info"}
        </button>
        {findMsg ? <div className={`msg ${findMsg.kind}`}>{findMsg.text}</div> : null}
        {hits && (Object.keys(counts).length || manual.length) ? (
          <div className="chips">
            {Object.entries(counts).map(([k, n]) => <span key={k} className="chip red">{n} {nice(k)}</span>)}
            {manual.length ? <span className="chip red">{manual.length} drawn by you</span> : null}
          </div>
        ) : null}
      </div>

      <div className="step">
        <h4>2. Check the boxes</h4>
        <p className="text">Click a box on the page to keep that text visible. Drag on the page to add your own box.</p>
        {excluded.size ? <p className="hint">{excluded.size} kept visible.</p> : null}
      </div>

      <div className="step">
        <h4>3. Remove for real</h4>
        <p className="text">The text is deleted from the file, not just covered.</p>
        <button className="btn primary block" onClick={apply} disabled={!!busy || active === 0}>
          {busy === "apply" ? "Redacting..." : `Redact ${active} item${active === 1 ? "" : "s"}`}
        </button>
        {applyMsg ? <div className={`msg ${applyMsg.kind}`}>{applyMsg.text}</div> : null}
      </div>

      <div className="step">
        <h4>Got a PDF someone else redacted?</h4>
        <button className="btn block" onClick={audit} disabled={!!busy}>
          {busy === "audit" ? "Checking..." : "Check for hidden text"}
        </button>
        {auditMsg ? <div className={`msg ${auditMsg.kind}`}>{auditMsg.text}</div> : null}
        {hidden && hidden.length ? (
          <ul className="list">
            {hidden.map((h, i) => (
              <li key={i} style={{ alignItems: "flex-start" }}>
                <span className="chip" style={{ whiteSpace: "nowrap" }}>Page {h.page}</span>
                <span className="small">Hidden under a black box: <b className="mono">{h.hidden_text}</b></span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}

const tool: ToolUI = { id: "redact", Pane: RedactPane };
export default tool;
