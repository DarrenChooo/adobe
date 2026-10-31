import { useEffect, useState } from "react";
import type { ApiLike } from "./types";

// Renders a PDF's pages to images at 72 dpi via the convert tool, so 1 image pixel = 1 PDF point.
// That lets boxes from the server (in points) be drawn straight onto the images.
export function usePageImages(api: ApiLike, fileId: string | undefined) {
  const [pages, setPages] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  useEffect(() => {
    if (!fileId) {
      setPages([]);
      return;
    }
    let live = true;
    api
      .runTool("convert", [fileId], { target: "png", dpi: 72 })
      .then((res) => {
        if (!live) return;
        if (!res.ok) setError(res.message);
        else setPages(res.outputs.map((o) => api.fileUrl(o.file_id)));
      })
      .catch((e: unknown) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [api, fileId]);
  return { pages, error };
}
