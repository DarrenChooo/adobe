// Typed helpers for the frozen HTTP API in SPEC 5.1.

export interface FileInfo {
  file_id: string;
  filename: string;
  pages: number;
  size: number;
}

export interface ToolInfo {
  id: string;
  name: string;
  tier: "standard" | "pro" | "studio" | "ours";
  adobe_feature: string;
  description: string;
  params_schema: Record<string, unknown>;
  min_files: number;
  max_files: number | null;
  status: "works" | "partial" | "not-yet";
}

export interface OutputRef {
  file_id: string;
  filename: string;
  mime: string;
}

export interface RunResult {
  ok: boolean;
  message: string;
  outputs: OutputRef[];
  data: Record<string, any>;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function upload(file: File | Blob, filename?: string): Promise<FileInfo> {
  const fd = new FormData();
  fd.append("file", file, filename ?? (file as File).name ?? "upload");
  return json(await fetch("/api/files", { method: "POST", body: fd }));
}

export async function listTools(): Promise<ToolInfo[]> {
  return json(await fetch("/api/tools"));
}

export async function runTool(
  toolId: string,
  fileIds: string[],
  params: Record<string, unknown> = {},
): Promise<RunResult> {
  return json(
    await fetch(`/api/tools/${toolId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: fileIds, params }),
    }),
  );
}

export async function fileInfo(fileId: string): Promise<FileInfo> {
  return json(await fetch(`/api/files/${fileId}/info`));
}

export function fileUrl(fileId: string, download = false): string {
  return `/api/files/${fileId}${download ? "?download=true" : ""}`;
}

export const api = { upload, listTools, runTool, fileInfo, fileUrl };
export type Api = typeof api;
