import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api as sharedApi, type RunResult } from "../api";
import type { ToolPanelProps, ToolUI } from "./registry";

interface Row {
  field: string;
  shown_as: string;
  type: string;
  options: string[];
  key: string | null;
  value: string;
  confidence: number;
  needs_review: boolean;
}

interface MapData {
  signature: string;
  source: "model" | "learned";
  fields: Row[];
  values: Record<string, string>;
  sent_to_model?: string;
}

function pretty(key: string) {
  return key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function ProfilePage() {
  const [keys, setKeys] = useState<string[]>([]);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    sharedApi.runTool("autofill", [], { action: "get_profile" }).then((res) => {
      setKeys(res.data.keys ?? []);
      setProfile(res.data.profile ?? {});
    }).catch((e) => setStatus((e as Error).message));
  }, []);

  const save = async () => {
    try {
      const res = await sharedApi.runTool("autofill", [], { action: "save_profile", profile });
      setStatus(res.message);
      setSaved(res.ok);
    } catch (e) {
      setStatus((e as Error).message);
      setSaved(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "24px auto", padding: "0 16px" }} className="stack">
      <h2 style={{ margin: 0 }}>Your profile</h2>
      <p className="muted small">
        Saved only on this machine, in <code>storage/profile.json</code>. The AI is told which of these labels exist. It is never told what you typed.
      </p>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {keys.map((key) => (
          <label key={key}>
            {pretty(key)}
            <input
              type={key === "date_of_birth" ? "date" : "text"}
              value={profile[key] ?? ""}
              onChange={(e) => { setSaved(false); setProfile((p) => ({ ...p, [key]: e.target.value })); }}
              autoComplete="off"
            />
          </label>
        ))}
        <button className="primary">Save profile</button>
      </form>
      {status && <p className={saved ? "" : "muted"}>{status} {saved && <Link to="/">Back to the workspace</Link>}</p>}
    </div>
  );
}

function Panel({ selectedFileIds, api, onResult }: ToolPanelProps) {
  const id = selectedFileIds[selectedFileIds.length - 1];
  const [data, setData] = useState<MapData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [summary, setSummary] = useState("");

  // Reset the review if a different form is chosen.
  useEffect(() => { setData(null); setSummary(""); setError(""); }, [id]);

  const match = async () => {
    setBusy(true);
    setError("");
    setSummary("");
    try {
      // Not sent to onResult: the shared result panel would print the profile values.
      const res: RunResult = await api.runTool("autofill", [id], { action: "map" });
      if (!res.ok) {
        setError(res.message);
        setData(null);
        return;
      }
      const map = res.data as MapData;
      setData(map);
      setOverrides({});
      setMapping(Object.fromEntries(map.fields.filter((r) => r.key).map((r) => [r.field, r.key as string])));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const corrected = useMemo(() => {
    if (!data) return 0;
    return data.fields.filter((r) => (mapping[r.field] ?? null) !== r.key || r.field in overrides).length;
  }, [data, mapping, overrides]);

  const fill = async () => {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.runTool("autofill", [id], {
        action: "fill", signature: data.signature, mapping, overrides,
      });
      onResult(res);
      if (res.ok) {
        const suggested = data.fields.filter((r) => r.key).length;
        const skipped: string[] = res.data.skipped ?? [];
        setSummary(
          `Filled ${res.data.filled?.length ?? 0} fields. The AI suggested ${suggested} and you changed ${corrected}. ` +
          (skipped.length ? `${skipped.length} couldn't be filled because the form doesn't accept that value. ` : "") +
          "Your choices are remembered for this form.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const keys = data ? Object.keys(data.values).sort() : [];
  const rows = data ? data.fields.filter((r) => showAll || mapping[r.field] || r.field in overrides) : [];

  return (
    <div className="stack">
      <p className="muted small">
        Select a blank PDF form. <Link to="/profile">Edit your profile</Link>
      </p>
      <button className="primary" disabled={busy || !id} onClick={match}>
        {busy && !data ? "Reading the form…" : data ? "Match again" : "Match fields to my profile"}
      </button>
      {error && <div className="result fail">{error}</div>}

      {data && (
        <>
          <p className="small" style={{ margin: 0 }}>
            <strong>{Object.keys(mapping).length} of {data.fields.length}</strong> fields matched.{" "}
            {data.source === "learned"
              ? "Remembered from last time, so the AI wasn't needed."
              : "Check them, especially anything highlighted."}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr><th>The form asks</th><th>Fill with</th><th>Value</th><th>Sure?</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const key = mapping[r.field] ?? "";
                  const value = overrides[r.field] ?? (key ? data.values[key] ?? "" : "");
                  const flagged = r.needs_review && mapping[r.field] === r.key && !(r.field in overrides);
                  return (
                    <tr key={r.field} style={flagged ? { background: "var(--warn-bg)" } : undefined}>
                      <td className="small" title={r.field}>{r.shown_as.length > 80 ? `${r.shown_as.slice(0, 80)}…` : r.shown_as}</td>
                      <td>
                        <select
                          value={key}
                          onChange={(e) => {
                            const next = e.target.value;
                            setMapping((m) => {
                              const copy = { ...m };
                              if (next) copy[r.field] = next;
                              else delete copy[r.field];
                              return copy;
                            });
                            setOverrides((o) => {
                              const copy = { ...o };
                              delete copy[r.field];
                              return copy;
                            });
                          }}
                        >
                          <option value="">Leave empty</option>
                          {keys.map((k) => <option key={k} value={k}>{pretty(k)}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          value={value}
                          onChange={(e) => {
                            const typed = e.target.value;
                            setOverrides((o) => ({ ...o, [r.field]: typed }));
                          }}
                          aria-label={`Value for ${r.shown_as}`}
                        />
                      </td>
                      <td className="small">{r.key ? `${Math.round(r.confidence * 100)}%` : ""}</td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={4} className="muted">Nothing matched. Show all fields to choose by hand.</td></tr>}
              </tbody>
            </table>
          </div>
          <label className="inline small">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all {data.fields.length} fields
          </label>
          <button className="primary" disabled={busy} onClick={fill}>{busy ? "Filling…" : "Fill the PDF"}</button>
          {summary && <p className="small" style={{ margin: 0 }}>{summary}</p>}
          {data.sent_to_model && (
            <details className="card">
              <summary>See exactly what the AI received</summary>
              <p className="muted small">Field descriptions and profile labels. None of your details.</p>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, maxHeight: 240, overflow: "auto" }}>{data.sent_to_model}</pre>
            </details>
          )}
        </>
      )}
    </div>
  );
}

const tool: ToolUI = {
  id: "autofill",
  Panel,
  routes: [{ path: "/profile", element: <ProfilePage /> }],
};
export default tool;
