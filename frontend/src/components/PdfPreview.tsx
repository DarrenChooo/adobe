import { useState, type ReactNode } from "react";
import { Document, Page } from "react-pdf";
import { fileUrl } from "../api";

interface Props {
  fileId: string | null;
  width?: number;
  /** Show only this page (1-based) instead of all pages. */
  page?: number;
  /** Drawn over each page, sized to it. Used for placing signatures and boxes. */
  overlay?: (pageNumber: number) => ReactNode;
  onPageClick?: (pageNumber: number, x: number, y: number, e: React.MouseEvent<HTMLDivElement>) => void;
}

/** Renders a stored PDF with react-pdf. Click coordinates are fractions (0-1) of the page, top-left origin. */
export default function PdfPreview({ fileId, width = 520, page, overlay, onPageClick }: Props) {
  const [pages, setPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  if (!fileId) return <div className="empty-state">Select a file to preview it.</div>;
  const list = page ? [page] : Array.from({ length: pages }, (_, i) => i + 1);
  return (
    <Document
      key={fileId}
      file={fileUrl(fileId)}
      onLoadSuccess={(d) => {
        setPages(d.numPages);
        setError(null);
      }}
      onLoadError={(e) => setError(e.message)}
      onPassword={() => setError("This PDF is password-protected, so it can't be previewed. Unlock it first.")}
      error={<div className="empty-state">{error ?? "This file isn't a PDF that can be previewed."}</div>}
      loading={<div className="empty-state">Loading…</div>}
    >
      {error && <div className="empty-state">{error}</div>}
      {list.map((n) => (
        <div
          key={n}
          className="page-wrap"
          data-page={n}
          onClick={
            onPageClick
              ? (e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  onPageClick(n, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, e);
                }
              : undefined
          }
        >
          <Page pageNumber={n} width={width} renderAnnotationLayer={!overlay} renderTextLayer={!overlay} />
          {overlay && <div className="page-overlay">{overlay(n)}</div>}
          {!page && <div className="page-num">{n}</div>}
        </div>
      ))}
    </Document>
  );
}
