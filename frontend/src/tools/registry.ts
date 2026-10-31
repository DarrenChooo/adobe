// Collects every tool UI in this folder. Add frontend/src/tools/<id>.tsx with a
// default export and it shows up: nobody edits a shared list.
//
// How a tool appears (Acrobat-style frame, see frontend/src/shell/):
//   Pane  - the left pane while a document is open in the viewer. Draw on the page with <Stage>.
//   Page  - a full-screen setup page at /tool/<id> (Combine, Compare, Create).
//   routes - extra pages. frame "home" = inside the Home side menu (Agreements, Spaces, Profile);
//            frame "none" (default) = bare page for outsiders (signing page, public web form).
import type { ReactElement, ReactNode } from "react";
import type { Api, FileInfo, RunResult, ToolInfo } from "../api";

/** What every tool screen gets from the app frame. Route pages get the same via useApp(). */
export interface ToolContext {
  api: Api;
  /** This tool's server spec from GET /api/tools (undefined if the server lacks it). */
  tool?: ToolInfo;
  /** Every file the user has opened or produced, newest first. */
  files: FileInfo[];
  /** Upload files from the user's computer. They join `files`; their infos are returned. */
  upload: (list: File[]) => Promise<FileInfo[]>;
  /** Show a finished run: a toast with its message, and its first PDF output opens as a new tab.
   *  Non-PDF outputs are offered as downloads in the toast. */
  onResult: (res: RunResult) => void;
  /** Open a stored file as a document tab, optionally with a tool already chosen. */
  openFile: (fileId: string, toolId?: string) => void;
}

/** Props for a tool that works on the open document. */
export interface ToolPaneProps extends ToolContext {
  /** The document open in the viewer. */
  file: FileInfo;
  /** Renders its children in the centre of the screen in place of the plain page view.
   *  Use it for anything the user places or draws on the page (redaction boxes, signatures). */
  Stage: (props: { children: ReactNode }) => ReactNode;
}

export interface ToolRoute {
  path: string;
  element: ReactElement;
  /** "home" = shown inside the Home side menu frame. "none" (default) = bare page. */
  frame?: "home" | "none";
}

export interface ToolUI {
  id: string;
  Pane?: (props: ToolPaneProps) => ReactNode;
  Page?: (props: ToolContext) => ReactNode;
  routes?: ToolRoute[];
}

const modules = import.meta.glob<{ default: ToolUI }>("./*.tsx", { eager: true });

export const toolUIs: Record<string, ToolUI> = {};
for (const [path, mod] of Object.entries(modules)) {
  const ui = mod.default;
  if (!ui || !ui.id) {
    console.warn(`Tool file ${path} has no default ToolUI export`);
    continue;
  }
  toolUIs[ui.id] = ui;
}

export const toolRoutes: ToolRoute[] = Object.values(toolUIs).flatMap((t) => t.routes ?? []);
