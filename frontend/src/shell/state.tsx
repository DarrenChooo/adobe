// The frame's state: known files, open document tabs, the server's tool list, and the toast.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, type FileInfo, type OutputRef, type RunResult, type ToolInfo } from "../api";
import type { ToolContext } from "../tools/registry";
import { AppContext } from "./app-context";

const FILES_KEY = "fillme.files";
const TABS_KEY = "fillme.tabs";

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the session still works, it just isn't remembered */
  }
}

export interface Toast {
  ok: boolean;
  message: string;
  outputs: OutputRef[];
  /** A PDF output that was opened as a tab. */
  opened?: string;
  at: number;
}

interface Frame {
  tools: ToolInfo[];
  serverDown: boolean;
  files: FileInfo[];
  tabs: string[];
  ensureTab: (fileId: string) => void;
  closeTab: (fileId: string) => void;
  clearFiles: () => void;
  toast: Toast | null;
  dismissToast: () => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  ctx: ToolContext;
}

const FrameContext = createContext<Frame | null>(null);
export const useFrame = () => {
  const f = useContext(FrameContext);
  if (!f) throw new Error("useFrame() outside FrameProvider");
  return f;
};

export function docPath(fileId: string, toolId?: string | null, ai?: boolean) {
  const q = new URLSearchParams();
  if (toolId) q.set("tool", toolId);
  if (ai) q.set("ai", "1");
  const s = q.toString();
  return `/doc/${fileId}${s ? `?${s}` : ""}`;
}

export function FrameProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [serverDown, setServerDown] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>(() => load(FILES_KEY, []));
  const [tabs, setTabs] = useState<string[]>(() => load(TABS_KEY, []));
  const [toast, setToast] = useState<Toast | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api.listTools().then(setTools).catch(() => setServerDown(true));
    // Forget files the server no longer has (e.g. its storage was wiped).
    load<FileInfo[]>(FILES_KEY, []).forEach((f) =>
      api.fileInfo(f.file_id).catch(() => {
        setFiles((s) => s.filter((x) => x.file_id !== f.file_id));
        setTabs((s) => s.filter((x) => x !== f.file_id));
      }),
    );
  }, []);
  useEffect(() => save(FILES_KEY, files), [files]);
  useEffect(() => save(TABS_KEY, tabs), [tabs]);
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const addFiles = useCallback((infos: FileInfo[]) => {
    setFiles((s) => [...infos, ...s.filter((f) => !infos.some((i) => i.file_id === f.file_id))]);
  }, []);

  const addTab = useCallback((fileId: string) => setTabs((s) => (s.includes(fileId) ? s : [...s, fileId])), []);

  const openFile = useCallback(
    (fileId: string, toolId?: string) => {
      addTab(fileId);
      navigate(docPath(fileId, toolId));
    },
    [addTab, navigate],
  );

  const upload = useCallback(
    async (list: File[]) => {
      const infos = await Promise.all(list.map((f) => api.upload(f)));
      addFiles(infos);
      return infos;
    },
    [addFiles],
  );

  const onResult = useCallback(
    async (res: RunResult) => {
      const t: Toast = { ok: res.ok, message: res.message || (res.ok ? "Done." : "That didn't work."), outputs: res.outputs ?? [], at: Date.now() };
      setToast(t);
      if (!res.ok || !res.outputs?.length) return;
      const infos = await Promise.all(res.outputs.map((o) => api.fileInfo(o.file_id).catch(() => null)));
      addFiles(infos.filter((x): x is FileInfo => !!x));
      const pdf = res.outputs.find((o) => o.mime === "application/pdf");
      if (!pdf) return;
      setToast({ ...t, opened: pdf.file_id });
      addTab(pdf.file_id);
      // Inside a document the new file opens as a background tab, so the tool's own messages stay
      // on screen. From a setup page (Combine, Compare, Create) we go straight to the result.
      if (!location.pathname.startsWith("/doc/")) navigate(docPath(pdf.file_id));
    },
    [addFiles, addTab, location.pathname, navigate],
  );

  const closeTab = useCallback(
    (fileId: string) => {
      setTabs((s) => {
        const next = s.filter((x) => x !== fileId);
        if (location.pathname === `/doc/${fileId}`) {
          const i = s.indexOf(fileId);
          const neighbour = next[i] ?? next[i - 1];
          navigate(neighbour ? docPath(neighbour) : "/");
        }
        return next;
      });
    },
    [location.pathname, navigate],
  );

  const clearFiles = useCallback(() => {
    setFiles([]);
    setTabs([]);
  }, []);

  const ctx: ToolContext = useMemo(() => ({ api, files, upload, onResult, openFile }), [files, upload, onResult, openFile]);

  const frame: Frame = {
    tools, serverDown, files, tabs, ensureTab: addTab, closeTab, clearFiles, toast, dismissToast: () => setToast(null),
    menuOpen, setMenuOpen, ctx,
  };
  return (
    <FrameContext.Provider value={frame}>
      <AppContext.Provider value={ctx}>{children}</AppContext.Provider>
    </FrameContext.Provider>
  );
}

export function fmtSize(n: number) {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}
