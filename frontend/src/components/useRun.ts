import { useState } from "react";
import type { RunResult } from "../api";
import type { ToolPanelProps } from "../tools/registry";

/** Shared busy-state + error handling for tool panels:
 *  const { run, busy } = useRun(props); run("merge", ids, params) */
export function useRun({ api, onResult }: Pick<ToolPanelProps, "api" | "onResult">) {
  const [busy, setBusy] = useState(false);
  const run = async (toolId: string, fileIds: string[], params: Record<string, unknown> = {}): Promise<RunResult> => {
    setBusy(true);
    try {
      const res = await api.runTool(toolId, fileIds, params);
      onResult(res);
      return res;
    } catch (e) {
      const res: RunResult = { ok: false, message: (e as Error).message, outputs: [], data: {} };
      onResult(res);
      return res;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}
