import type { ToolInfo } from "./api";
import { toolUIs } from "./tools/registry";

// SPEC section 3, one row per paid Acrobat feature, with the tool id that covers it.
const ROWS: { n: number; tier: string; feature: string; tool: string; owner: string; pri: string }[] = [
  { n: 1, tier: "Standard", feature: "Create … PDFs", tool: "create", owner: "A", pri: "P0" },
  { n: 2, tier: "Standard", feature: "edit … PDFs", tool: "annotate", owner: "A", pri: "P1" },
  { n: 3, tier: "Standard", feature: "convert, export", tool: "convert", owner: "B", pri: "P0" },
  { n: 4, tier: "Standard", feature: "organize PDFs", tool: "merge,split,organize", owner: "A", pri: "P0" },
  { n: 5, tier: "Standard", feature: "Collect e-signatures and track responses", tool: "esign", owner: "A", pri: "P0" },
  { n: 6, tier: "Standard", feature: "Fill, sign", tool: "fill_sign", owner: "A", pri: "P0" },
  { n: 7, tier: "Standard", feature: "password-protect PDFs", tool: "protect,unlock", owner: "A", pri: "P0" },
  { n: 8, tier: "Pro", feature: "Redact sensitive content", tool: "redact", owner: "B", pri: "P0" },
  { n: 9, tier: "Pro", feature: "Create web forms", tool: "webform", owner: "B", pri: "P1" },
  { n: 10, tier: "Pro", feature: "Turn scans into editable PDFs", tool: "ocr", owner: "B", pri: "P0" },
  { n: 11, tier: "Pro", feature: "Compare versions of a PDF", tool: "compare", owner: "B", pri: "P0" },
  { n: 12, tier: "Pro", feature: "Reusable e-sign templates", tool: "esign", owner: "A", pri: "P1" },
  { n: 13, tier: "Pro", feature: "Bulk e-signature requests", tool: "esign", owner: "A", pri: "P1" },
  { n: 14, tier: "Pro", feature: "Logo and custom URL on agreements", tool: "esign", owner: "A", pri: "P2" },
  { n: 15, tier: "Studio", feature: "Ask AI to edit, convert, and compress PDFs", tool: "assistant_command", owner: "C", pri: "P0" },
  { n: 16, tier: "Studio", feature: "Get summaries, insights, and answers", tool: "assistant_qa", owner: "C", pri: "P0" },
  { n: 17, tier: "Studio", feature: "Organize, share, and collaborate with PDF Spaces", tool: "spaces", owner: "C", pri: "P1" },
  { n: 18, tier: "Studio", feature: "Generate flyers, social content, and presentations", tool: "generate", owner: "C", pri: "P1" },
  { n: 19, tier: "Pro/Std", feature: "Compress (part of “70+ tools”)", tool: "compress", owner: "A", pri: "P1" },
  { n: 20, tier: "Ours", feature: "Smart autofill (not in Acrobat)", tool: "autofill", owner: "C", pri: "P0" },
  { n: 21, tier: "Ours", feature: "Context rules on the profile", tool: "context_rules", owner: "C", pri: "P2" },
  { n: 22, tier: "Ours", feature: "Chrome extension autofill", tool: "chrome_extension", owner: "C", pri: "P2" },
];

const PRICE: Record<string, string> = { Standard: "from US$179.88/yr", Pro: "US$239.88/yr", Studio: "US$299.88/yr" };

type Status = "works" | "partial" | "not-yet";

function statusFor(ids: string[], tools: Map<string, ToolInfo>): Status {
  const st = ids.map((id) => {
    const t = tools.get(id);
    if (!t) return "not-yet";
    if (t.status !== "works") return t.status;
    return toolUIs[id] ? "works" : "partial"; // server works, no UI yet
  });
  if (st.every((s) => s === "works")) return "works";
  if (st.every((s) => s === "not-yet")) return "not-yet";
  return "partial";
}

const BADGE: Record<Status, string> = { works: "Works", partial: "Partial", "not-yet": "Not yet" };

export default function Coverage({ tools }: { tools: ToolInfo[] }) {
  const byId = new Map(tools.map((t) => [t.id, t]));
  const rows = ROWS.map((r) => ({ ...r, ids: r.tool.split(","), status: statusFor(r.tool.split(","), byId) }));
  const works = rows.filter((r) => r.status === "works").length;
  const tiers = [...new Set(rows.map((r) => r.tier))];

  return (
    <div className="coverage">
      <h1>Every paid Acrobat feature, free</h1>
      <p className="lead">
        <strong>{works}</strong> of {rows.length} features working live · Acrobat Studio costs US$299.88 a year. Fill Me costs US$0.
      </p>
      {tiers.map((tier) => (
        <section key={tier}>
          <h2>
            {tier} {PRICE[tier] && <small className="muted">Adobe: {PRICE[tier]}</small>}
          </h2>
          <table>
            <thead>
              <tr><th>#</th><th>Adobe feature</th><th>Fill Me tool</th><th>Owner</th><th>Pri</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.filter((r) => r.tier === tier).map((r) => (
                <tr key={r.n}>
                  <td>{r.n}</td>
                  <td>{r.feature}</td>
                  <td>{r.ids.map((id) => byId.get(id)?.name ?? id).join(", ")}</td>
                  <td>{r.owner}</td>
                  <td>{r.pri}</td>
                  <td><span className={`badge ${r.status}`}>{BADGE[r.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <p className="muted small">Live from <code>GET /api/tools</code>. “Partial” = server tool exists but its UI or part of the feature isn't done.</p>
    </div>
  );
}
