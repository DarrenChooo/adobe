// How each tool is presented in the frame: name, category, icon, colour, and how it starts.
// The server's GET /api/tools stays the source of truth for whether a tool exists and works.
import type { ReactNode } from "react";

const P: Record<string, ReactNode> = {
  autofill: <><path d="M4 20h4l10-10-4-4L4 16v4z" /><path d="M13 7l4 4" /><path d="M19 3l.7 1.6L21 5l-1.3.6L19 7l-.6-1.4L17 5l1.4-.4z" /></>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  create: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M12 12v6M9 15h6" /></>,
  export: <><path d="M7 3h7l5 5v13H7z" /><path d="M11 14h8M16 11l3 3-3 3" /></>,
  combine: <><rect x="3" y="4" width="8" height="11" rx="1" /><rect x="13" y="9" width="8" height="11" rx="1" /></>,
  split: <><path d="M12 3v18" /><rect x="3" y="5" width="6" height="14" rx="1" /><rect x="15" y="5" width="6" height="14" rx="1" /></>,
  organize: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  compress: <><path d="M8 3v6h8V3M8 21v-6h8v6" /><path d="M4 12h16" /></>,
  sign: <><path d="M3 17c3-6 5-6 6-3s2 3 4 0 4-3 8 2" /><path d="M3 21h18" /></>,
  esign: <><path d="M4 6l8 6 8-6" /><rect x="3" y="5" width="18" height="14" rx="2" /></>,
  webform: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h6M7 17h4" /></>,
  protect: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></>,
  unlock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 017.5-2" /></>,
  redact: <><rect x="4" y="5" width="16" height="4" rx="1" /><rect x="4" y="11" width="10" height="4" rx="1" /><path d="M4 19h16" /></>,
  ocr: <><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" /><path d="M8 12h8" /></>,
  compare: <><rect x="3" y="4" width="7" height="16" rx="1" /><rect x="14" y="4" width="7" height="16" rx="1" /><path d="M10 9h4M10 15h4" /></>,
  ai: <><path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z" /><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></>,
  command: <><path d="M5 7l5 5-5 5" /><path d="M12 17h7" /></>,
  spaces: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M8 6V4h8v2" /></>,
  generate: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  home: <path d="M4 11l8-7 8 7v9H4z" />,
  recent: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>,
  tools: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  cursor: <path d="M5 3l14 7-6 2-2 6z" />,
  comment: <path d="M4 5h16v11H9l-5 4z" />,
  highlight: <><path d="M4 20h16" /><path d="M7 16l3-9 7 7-9 3z" /></>,
  text: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
  download: <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4-4" /></>,
  print: <><path d="M7 9V3h10v6" /><rect x="4" y="9" width="16" height="8" rx="1" /><path d="M7 14h10v7H7z" /></>,
  upload: <path d="M12 20V8M7 13l5-5 5 5M5 4h14" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
};

/** A stroke icon by name (see the list above). Inherits the text colour. */
export function Icon({ name, size }: { name: string; size?: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" style={size ? { width: size, height: size } : undefined} aria-hidden="true">
      {P[name]}
    </svg>
  );
}

export type Tier = "standard" | "pro" | "studio" | "ours";
export const TIER_LABEL: Record<Tier, string> = { standard: "Standard", pro: "Pro", studio: "Studio", ours: "Fill Me only" };

export interface CatalogEntry {
  id: string;
  name: string;
  desc: string;
  cat: string;
  tier: Tier;
  icon: string;
  color: string;
  /** pane = works on an open document; page = own setup page at /tool/<id>;
   *  ai = opens the AI Assistant side panel; a path ("/spaces") = goes to that page. */
  start: "pane" | "page" | "ai" | `/${string}`;
}

export const CATEGORIES = ["Forms & signatures", "Create & edit", "Convert & compress", "Organize", "Protect", "Review", "AI"];

export const CATALOG: CatalogEntry[] = [
  { id: "autofill", name: "Smart Autofill", desc: "Fill any PDF form from your saved profile", tier: "ours", icon: "autofill", color: "#12805c", cat: "Forms & signatures", start: "pane" },
  { id: "fill_sign", name: "Fill & Sign", desc: "Type into fields and add your signature", tier: "standard", icon: "sign", color: "#7b4dd6", cat: "Forms & signatures", start: "pane" },
  { id: "esign", name: "Request e-signatures", desc: "Send a signing link and track who signed", tier: "standard", icon: "esign", color: "#7b4dd6", cat: "Forms & signatures", start: "pane" },
  { id: "webform", name: "Prepare a web form", desc: "Turn a PDF form into a link anyone can fill", tier: "pro", icon: "webform", color: "#7b4dd6", cat: "Forms & signatures", start: "pane" },
  { id: "annotate", name: "Edit & comment", desc: "Add text, highlights, comments and images", tier: "standard", icon: "edit", color: "#d6337a", cat: "Create & edit", start: "pane" },
  { id: "create", name: "Create a PDF", desc: "From images, text, Markdown or Office files", tier: "standard", icon: "create", color: "#d6342c", cat: "Create & edit", start: "page" },
  { id: "ocr", name: "Scan & OCR", desc: "Make a scanned PDF searchable", tier: "pro", icon: "ocr", color: "#d6342c", cat: "Create & edit", start: "pane" },
  { id: "convert", name: "Export a PDF", desc: "To Word, Excel, images or text", tier: "standard", icon: "export", color: "#1473e6", cat: "Convert & compress", start: "pane" },
  { id: "compress", name: "Compress a PDF", desc: "Make the file smaller", tier: "standard", icon: "compress", color: "#1473e6", cat: "Convert & compress", start: "pane" },
  { id: "merge", name: "Combine files", desc: "Merge several files into one PDF", tier: "standard", icon: "combine", color: "#0d8aa8", cat: "Organize", start: "page" },
  { id: "organize", name: "Organize pages", desc: "Reorder, rotate and delete pages", tier: "standard", icon: "organize", color: "#0d8aa8", cat: "Organize", start: "pane" },
  { id: "split", name: "Split a PDF", desc: "Break one PDF into several", tier: "standard", icon: "split", color: "#0d8aa8", cat: "Organize", start: "pane" },
  { id: "redact", name: "Redact a PDF", desc: "Find and permanently remove sensitive info", tier: "pro", icon: "redact", color: "#444444", cat: "Protect", start: "pane" },
  { id: "protect", name: "Protect a PDF", desc: "Add a password (AES-256)", tier: "standard", icon: "protect", color: "#444444", cat: "Protect", start: "pane" },
  { id: "unlock", name: "Remove a password", desc: "Unlock a PDF you have the password for", tier: "standard", icon: "unlock", color: "#444444", cat: "Protect", start: "pane" },
  { id: "compare", name: "Compare files", desc: "See what changed between two versions", tier: "pro", icon: "compare", color: "#e07a00", cat: "Review", start: "page" },
  { id: "assistant_qa", name: "AI Assistant", desc: "Ask questions and get answers with page citations", tier: "studio", icon: "ai", color: "#b3264a", cat: "AI", start: "ai" },
  { id: "assistant_command", name: "Ask AI to do it", desc: "Say what you want, like \"merge these and compress\"", tier: "studio", icon: "command", color: "#b3264a", cat: "AI", start: "pane" },
  { id: "spaces", name: "PDF Spaces", desc: "Group files, keep notes, ask across all of them", tier: "studio", icon: "spaces", color: "#b3264a", cat: "AI", start: "/spaces" },
  { id: "generate", name: "Generate", desc: "Turn a PDF into a slide deck or a flyer", tier: "studio", icon: "generate", color: "#b3264a", cat: "AI", start: "pane" },
];

export const entry = (id: string): CatalogEntry | undefined => CATALOG.find((t) => t.id === id);

/** The coloured square icon for a tool. */
export function ToolTile({ id, small }: { id: string; small?: boolean }) {
  const t = entry(id);
  return (
    <span className={`ti${small ? " sm" : ""}`} style={{ background: t?.color ?? "#666" }}>
      <Icon name={t?.icon ?? "tools"} />
    </span>
  );
}

export function TierBadge({ tier }: { tier: Tier }) {
  return <span className={`tier ${tier}`}>{TIER_LABEL[tier]}</span>;
}
