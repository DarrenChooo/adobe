// Person B's screens use Person A's real types from api.ts.
import type { Api } from "../../api";

export type { RunResult, OutputRef as OutputFile } from "../../api";
export type ApiLike = Pick<Api, "runTool" | "fileUrl">;

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
