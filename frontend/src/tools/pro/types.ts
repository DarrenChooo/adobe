// Shapes from SPEC 5.1, used by Person B's screens.
export type OutputFile = { file_id: string; filename: string; mime: string };

export type RunResult<D = Record<string, unknown>> = {
  ok: boolean;
  message: string;
  outputs: OutputFile[];
  data: D;
};

export type ApiLike = {
  runTool: (toolId: string, fileIds: string[], params: Record<string, unknown>) => Promise<RunResult>;
  fileUrl: (fileId: string) => string;
};

// A rectangle on a PDF page, in PDF points with the origin at the top-left.
export type Box = {
  id: string;
  page: number;
  x0: number;
  top: number;
  x1: number;
  bottom: number;
  label?: string;
  muted?: boolean;
};
