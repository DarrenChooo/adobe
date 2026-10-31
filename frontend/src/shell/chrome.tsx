// Top bar (menu button, logo, document tabs, file actions), the slide-out menu, the side menu
// used on Home pages, and the toast that reports finished tool runs.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { fileUrl } from "../api";
import { CATALOG, Icon, ToolTile, type CatalogEntry } from "./catalog";
import { docPath, useFrame } from "./state";

export function startTool(t: CatalogEntry, navigate: (to: string) => void, fileId?: string) {
  if (t.start === "page") return navigate(`/tool/${t.id}`);
  if (t.start.startsWith("/")) return navigate(t.start);
  if (fileId) return navigate(t.start === "ai" ? docPath(fileId, null, true) : docPath(fileId, t.id));
  navigate(`/pick/${t.id}`);
}

function MenuLinks() {
  return (
    <>
      <NavLink to="/" end><Icon name="home" /> Home</NavLink>
      <NavLink to="/tools"><Icon name="tools" /> All tools</NavLink>
      <NavLink to="/recent"><Icon name="recent" /> Recent files</NavLink>
      <hr />
      <NavLink to="/agreements"><Icon name="esign" /> Agreements</NavLink>
      <NavLink to="/spaces"><Icon name="spaces" /> PDF Spaces</NavLink>
      <NavLink to="/profile"><Icon name="user" /> My autofill profile</NavLink>
    </>
  );
}

/** The side menu on Home pages. */
export function HomeFrame({ children }: { children: ReactNode }) {
  return (
    <div className="home">
      <nav className="sidenav" aria-label="Main menu"><MenuLinks /></nav>
      <main className="home-main">{children}</main>
    </div>
  );
}

function Drawer() {
  const { menuOpen, setMenuOpen } = useFrame();
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, setMenuOpen]);
  if (!menuOpen) return null;
  return (
    <div className="drawer-scrim" onClick={() => setMenuOpen(false)}>
      <nav className="drawer sidenav" aria-label="Main menu" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="logo"><i>F</i> Fill Me</span>
          <button className="iconbtn" aria-label="Close menu" onClick={() => setMenuOpen(false)}>×</button>
        </div>
        <MenuLinks />
      </nav>
    </div>
  );
}

function ToolSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return CATALOG.filter((t) => `${t.name} ${t.desc} ${t.cat}`.toLowerCase().includes(s)).slice(0, 7);
  }, [q]);
  return (
    <div className="search">
      <Icon name="search" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools" aria-label="Search tools"
        onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) { startTool(hits[0], navigate); setQ(""); } if (e.key === "Escape") setQ(""); }} />
      {hits.length > 0 && (
        <div className="search-results">
          {hits.map((t) => (
            <button key={t.id} className="pane-item" onClick={() => { startTool(t, navigate); setQ(""); }}>
              <ToolTile id={t.id} small /> {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const { files, tabs, closeTab, setMenuOpen } = useFrame();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [search] = useSearchParams();
  const inDoc = location.pathname.startsWith("/doc/");
  const docId = inDoc ? location.pathname.split("/")[2] : null;
  const ai = search.get("ai") === "1";
  const name = (id: string) => files.find((f) => f.file_id === id)?.filename ?? "Document";
  void params;

  return (
    <header className="topbar">
      <button className="iconbtn" aria-label="Open menu" title="Menu" onClick={() => setMenuOpen(true)}>
        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      <Link to="/" className="logo"><i>F</i> Fill Me</Link>
      <div className="tabs-row">
        <NavLink to="/" end className={() => `doc-tab${!inDoc ? " on" : ""}`}><span className="n">Home</span></NavLink>
        {tabs.map((id) => (
          <div key={id} className={`doc-tab${docId === id ? " on" : ""}`}>
            <Link to={docPath(id)} className="n" style={{ color: "inherit", textDecoration: "none" }} title={name(id)}>{name(id)}</Link>
            <button className="x" aria-label={`Close ${name(id)}`} onClick={() => closeTab(id)}>×</button>
          </div>
        ))}
      </div>
      <span className="grow" />
      {inDoc && docId ? (
        <>
          <a className="iconbtn" href={fileUrl(docId)} target="_blank" rel="noreferrer" title="Open in a new window to print"><Icon name="print" /></a>
          <a className="iconbtn" href={fileUrl(docId, true)} download={name(docId)} title="Download"><Icon name="download" /></a>
          <button className={`ai-btn${ai ? " on" : ""}`} onClick={() => {
            const q = new URLSearchParams(search);
            if (ai) q.delete("ai"); else q.set("ai", "1");
            navigate(`${location.pathname}${q.toString() ? `?${q}` : ""}`);
          }}>
            <Icon name="ai" size={16} /> AI Assistant
          </button>
        </>
      ) : (
        <ToolSearch />
      )}
      <Drawer />
    </header>
  );
}

export function ToastHost() {
  const { toast, dismissToast } = useFrame();
  const location = useLocation();
  useEffect(() => {
    if (!toast || !toast.ok) return;
    const t = setTimeout(dismissToast, 12000);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);
  if (!toast) return null;
  const openedHere = toast.opened && location.pathname === `/doc/${toast.opened}`;
  const others = toast.outputs.filter((o) => o.file_id !== toast.opened);
  return (
    <div className={`toast${toast.ok ? "" : " fail"}`} role="status">
      <span>{toast.message}{toast.opened && !openedHere ? " The result is open in a new tab." : ""}</span>
      {toast.opened && !openedHere && <Link to={docPath(toast.opened)} onClick={dismissToast}>View it</Link>}
      {toast.opened && <a href={fileUrl(toast.opened, true)} download>Download</a>}
      {others.map((o) => <a key={o.file_id} href={fileUrl(o.file_id, true)} download={o.filename}>Download {o.filename}</a>)}
      <button onClick={dismissToast} aria-label="Dismiss">Dismiss</button>
    </div>
  );
}
