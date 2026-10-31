// The document view: tools pane on the left, the PDF in the middle, page thumbnails (or the
// AI Assistant) on the right. A tool can take over the middle with <Stage>.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Document, Thumbnail } from "react-pdf";
import { api, fileUrl, type FileInfo } from "../api";
import PdfPreview from "../components/PdfPreview";
import SchemaForm from "../components/SchemaForm";
import { toolUIs, type ToolPaneProps } from "../tools/registry";
import { CATALOG, CATEGORIES, entry, Icon, TierBadge, ToolTile } from "./catalog";
import { startTool } from "./chrome";
import { docPath, useFrame } from "./state";

interface StageSlot {
  el: HTMLElement | null;
  claim: (delta: number) => void;
}
const StageContext = createContext<StageSlot>({ el: null, claim: () => {} });

/** Renders children in the middle of the document view instead of the plain PDF. */
function Stage({ children }: { children: ReactNode }) {
  const { el, claim } = useContext(StageContext);
  useEffect(() => {
    claim(1);
    return () => claim(-1);
  }, [claim]);
  return el ? createPortal(children, el) : null;
}

function AllToolsPane({ file }: { file: FileInfo }) {
  const navigate = useNavigate();
  return (
    <div className="pane">
      <div className="pane-head"><div className="title">All tools</div></div>
      <div className="pane-scroll">
        {CATEGORIES.map((c) => (
          <div key={c}>
            <div className="pane-sec">{c}</div>
            {CATALOG.filter((t) => t.cat === c).map((t) => (
              <button key={t.id} className="pane-item" onClick={() => startTool(t, navigate, file.file_id)}>
                <ToolTile id={t.id} small /> {t.name}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const BASE_WIDTH = 640;

export default function DocumentView() {
  const { fileId = "" } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { files, ctx, tools, ensureTab, addFiles } = useFrame();
  const toolId = search.get("tool");
  const ai = search.get("ai") === "1";
  const info = files.find((f) => f.file_id === fileId) ?? null;
  const [missing, setMissing] = useState(false);
  const [stageEl, setStageEl] = useState<HTMLElement | null>(null);
  const [claims, setClaims] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [slot] = useState(() => ({ claim: (d: number) => setClaims((n) => n + d) }));

  useEffect(() => ensureTab(fileId), [fileId, ensureTab]);

  useEffect(() => {
    setMissing(false);
    if (info) return;
    // A direct link to a file this browser hasn't seen: fetch it and add it, so the tab gets its name.
    api.fileInfo(fileId).then((fetched) => addFiles([fetched])).catch(() => setMissing(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  if (missing) return <div className="empty-state">This file isn't on the server any more. Open it again from Home.</div>;
  if (!info) return <div className="empty-state">Opening…</div>;

  const ui = toolId ? toolUIs[toolId] : undefined;
  const meta = toolId ? entry(toolId) : undefined;
  const serverTool = tools.find((t) => t.id === toolId);
  const Pane = ui?.Pane ?? (serverTool ? SchemaForm : undefined);
  const paneProps: ToolPaneProps = { ...ctx, file: info, Stage, tool: serverTool };
  const AiPane = toolUIs.assistant_qa?.Pane;
  const closeTool = () => navigate(docPath(fileId, null, ai));

  return (
    <StageContext.Provider value={{ el: stageEl, claim: slot.claim }}>
      <div className={`docview${ai ? " ai" : ""}`}>
        {toolId && Pane ? (
          <div className="pane">
            <div className="pane-head">
              <button className="back" onClick={closeTool}>‹ All tools</button>
              <div className="title">
                <ToolTile id={toolId} small /> {meta?.name ?? serverTool?.name ?? toolId}
                {meta && <TierBadge tier={meta.tier} />}
              </div>
            </div>
            <div className="pane-body">
              <Pane key={`${toolId}:${fileId}`} {...paneProps} />
            </div>
          </div>
        ) : (
          <AllToolsPane file={info} />
        )}

        <div className="stage">
          {claims === 0 && (
            <div className="quick" aria-label="Quick tools">
              <button title="Add a comment" onClick={() => navigate(docPath(fileId, "annotate", ai))}><Icon name="comment" /></button>
              <button title="Highlight" onClick={() => navigate(docPath(fileId, "annotate", ai))}><Icon name="highlight" /></button>
              <button title="Add text" onClick={() => navigate(docPath(fileId, "annotate", ai))}><Icon name="text" /></button>
              <button title="Fill & Sign" onClick={() => navigate(docPath(fileId, "fill_sign", ai))}><Icon name="sign" /></button>
            </div>
          )}
          <div className="stage-inner">
            <div ref={setStageEl} style={{ display: claims > 0 ? "contents" : "none" }} />
            {claims === 0 && (info.pages > 0 ? (
              <PdfPreview fileId={fileId} width={Math.round(BASE_WIDTH * zoom)} />
            ) : /\.pdf$/i.test(info.filename) ? (
              // The server can't read its pages: locked or damaged. Opening one in the viewer hangs the page.
              <div className="empty-state">
                This PDF can't be shown because it's password-protected or damaged.
                {toolId !== "unlock" && (
                  <div style={{ marginTop: 12 }}>
                    <button className="btn primary" onClick={() => navigate(docPath(fileId, "unlock", ai))}>Remove the password</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                This file isn't a PDF, so it can't be shown here. <a href={fileUrl(fileId, true)} download={info.filename}>Download it</a>
              </div>
            ))}
          </div>
          {claims === 0 && info.pages > 0 && (
            <div className="zoom">
              <button aria-label="Zoom out" disabled={zoom === ZOOMS[0]} onClick={() => setZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])}>−</button>
              <span style={{ minWidth: 44, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
              <button aria-label="Zoom in" disabled={zoom === ZOOMS[ZOOMS.length - 1]} onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)])}>+</button>
            </div>
          )}
        </div>

        {ai ? (
          <aside className="aside">
            <div className="aside-head">
              <span className="row"><ToolTile id="assistant_qa" small /> AI Assistant</span>
              <button className="iconbtn" aria-label="Close AI Assistant" onClick={() => navigate(docPath(fileId, toolId))}>×</button>
            </div>
            <div className="aside-body">
              {AiPane ? <AiPane key={fileId} {...paneProps} tool={tools.find((t) => t.id === "assistant_qa")} /> : <p className="hint">The AI Assistant isn't available.</p>}
            </div>
          </aside>
        ) : (
          <Rail file={info} />
        )}
      </div>
    </StageContext.Provider>
  );
}

function Rail({ file }: { file: FileInfo }) {
  if (!file.pages) return <div className="rail" />;
  const jump = (n: number) =>
    document.querySelector(`.stage [data-page="${n}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="rail" aria-label="Pages">
      <Document file={fileUrl(file.file_id)} loading="" error="">
        {Array.from({ length: Math.min(file.pages, 60) }, (_, i) => (
          <button key={i} className="rail-thumb" onClick={() => jump(i + 1)} title={`Page ${i + 1}`}>
            <Thumbnail pageNumber={i + 1} width={40} />
            <span>{i + 1}</span>
          </button>
        ))}
      </Document>
    </div>
  );
}
