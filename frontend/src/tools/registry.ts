// Collects every tool UI in this folder. Add frontend/src/tools/<id>.tsx with a
// default export and it shows up: nobody edits a shared list.
import type { ReactElement, ReactNode } from "react";
import type { Api, FileInfo, RunResult, ToolInfo } from "../api";

export interface ToolPanelProps {
  /** Selected file ids, in the order the user ticked them. */
  selectedFileIds: string[];
  /** Every file in the session (uploads and outputs). */
  files: FileInfo[];
  api: Api;
  /** Show a result in the result panel; its outputs are added to the file list. */
  onResult: (res: RunResult) => void;
  /** This tool's server-side spec from GET /api/tools (undefined if the server lacks it). */
  tool?: ToolInfo;
}

export interface ToolRoute {
  path: string;
  element: ReactElement;
}

export interface ToolUI {
  id: string;
  Panel: (props: ToolPanelProps) => ReactNode;
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
