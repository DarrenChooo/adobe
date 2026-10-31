import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RunResult } from "../api";
import { useApp } from "../shell/app-context";
import type { ToolPaneProps, ToolUI } from "./registry";
import "./autofill.css";

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

interface RememberedForm {
  signature: string;
  name: string;
  fields: number;
  last_filled: string | null;
}

function pretty(key: string) {
  return key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

// Plain-word labels for the standard profile keys (the server's PROFILE_KEYS) and derived ones.
const LABELS: Record<string, string> = {
  full_name: "Full name", surname: "Surname", given_name: "Given name", middle_name: "Middle name",
  nric: "NRIC", passport_number: "Passport number", date_of_birth: "Date of birth", nationality: "Nationality",
  sex: "Sex", address_line1: "Address line 1", address_line2: "Address line 2", city: "City", state: "State",
  postal_code: "Postal code", country: "Country", phone: "Mobile", email: "Email", occupation: "Occupation",
  employer: "Employer", emergency_contact_name: "Emergency contact name",
  emergency_contact_phone: "Emergency contact phone", emergency_contact_relationship: "Emergency contact relationship",
  full_address: "Full address", city_state_postal_code: "City, state and postal code",
  date_of_birth_day: "Date of birth: day", date_of_birth_month: "Date of birth: month",
  date_of_birth_year: "Date of birth: year", date_of_birth_mmddyyyy: "Date of birth (MM/DD/YYYY)",
  date_of_birth_ddmmyyyy: "Date of birth (DD/MM/YYYY)",
};
const label = (key: string) => LABELS[key] ?? pretty(key);

const SECTIONS: { title: string; keys: string[]; short?: Record<string, string> }[] = [
  { title: "About you", keys: ["full_name", "date_of_birth", "given_name", "surname", "middle_name", "nric", "passport_number", "nationality", "sex"] },
  { title: "Contact and address", keys: ["phone", "email", "address_line1", "address_line2", "city", "state", "postal_code", "country"] },
  { title: "Work", keys: ["occupation", "employer"] },
  {
    title: "Emergency contact",
    keys: ["emergency_contact_name", "emergency_contact_relationship", "emergency_contact_phone"],
    short: { emergency_contact_name: "Name", emergency_contact_relationship: "Relationship", emergency_contact_phone: "Phone" },
  },
];

/** "Driving licence number" -> "driving_licence_number" */
function toKey(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function ProfilePage() {
  const { api } = useApp();
  const [keys, setKeys] = useState<string[]>([]);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [forms, setForms] = useState<RememberedForm[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [addError, setAddError] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadForms = () =>
    api.runTool("autofill_memory", [], { action: "list" })
      .then((res) => setForms(res.ok ? res.data.forms ?? [] : []))
      .catch(() => setForms([]));

  useEffect(() => {
    api.runTool("autofill", [], { action: "get_profile" }).then((res) => {
      setKeys(res.data.keys ?? []);
      setProfile(res.data.profile ?? {});
    }).catch((e) => setStatus({ ok: false, text: (e as Error).message }));
    loadForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key: string, value: string) => {
    setStatus(null);
    setProfile((p) => ({ ...p, [key]: value }));
  };

  const grouped = new Set(SECTIONS.flatMap((s) => s.keys));
  const sections = [...SECTIONS.map((s) => ({ ...s, keys: s.keys.filter((k) => keys.includes(k)) })),
    { title: "Other", keys: keys.filter((k) => !grouped.has(k)), short: undefined }].filter((s) => s.keys.length);
  const custom = Object.keys(profile).filter((k) => !keys.includes(k));

  const addField = () => {
    const key = toKey(newName);
    if (!key) return setAddError("Give the field a name.");
    if (keys.includes(key)) return setAddError(`"${label(key)}" is already in your profile above.`);
    if (custom.includes(key)) return setAddError(`You already have a field called "${pretty(key)}".`);
    setAddError("");
    set(key, newValue);
    setNewName("");
    setNewValue("");
  };

  const removeField = (key: string) => {
    setStatus(null);
    setProfile((p) => {
      const copy = { ...p };
      delete copy[key];
      return copy;
    });
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = await api.runTool("autofill", [], { action: "save_profile", profile });
      setStatus({ ok: res.ok, text: res.message });
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const forgetForm = async (signature: string) => {
    try {
      await api.runTool("autofill_memory", [], { action: "forget", signature });
    } finally {
      loadForms();
    }
  };

  return (
    <div className="setup autofill-profile">
      <div className="setup-head"><h1>My autofill profile</h1></div>
      <p className="lead">
        Saved only on this computer. When you autofill a form, the AI is told the names of these fields, like
        "Passport number", and never what you typed.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        {sections.map((s) => (
          <section className="sect" key={s.title}>
            <h3>{s.title}</h3>
            <div className="form2">
              {s.keys.map((key) => (
                <label className="field" key={key}>
                  {s.short?.[key] ?? label(key)}
                  <input
                    type={key === "date_of_birth" ? "date" : key === "email" ? "email" : "text"}
                    value={profile[key] ?? ""}
                    onChange={(e) => set(key, e.target.value)}
                    autoComplete="off"
                  />
                </label>
              ))}
            </div>
          </section>
        ))}

        <section className="sect">
          <h3>Your own fields</h3>
          <p className="hint" style={{ marginBottom: 12 }}>Anything a form might ask that isn't above. Autofill can use these too.</p>
          {custom.length > 0 && (
            <div className="autofill-own">
              {custom.map((key) => (
                <div key={key} style={{ display: "contents" }}>
                  <span className="autofill-own-name">{pretty(key)}</span>
                  <input className="inp" value={profile[key] ?? ""} onChange={(e) => set(key, e.target.value)} aria-label={pretty(key)} autoComplete="off" />
                  <button type="button" className="autofill-x" onClick={() => removeField(key)} aria-label={`Remove ${pretty(key)}`} title="Remove">×</button>
                </div>
              ))}
            </div>
          )}
          <div className="autofill-add" style={custom.length ? undefined : { borderTop: 0, marginTop: 0, paddingTop: 0 }}>
            <label className="field">
              Field name
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Driving licence number" autoComplete="off"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addField(); } }} />
            </label>
            <label className="field">
              Value
              <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="e.g. S1234567D" autoComplete="off"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addField(); } }} />
            </label>
            <button type="button" className="btn" onClick={addField} disabled={!newName.trim()}>Add field</button>
          </div>
          {addError && <div className="msg err" style={{ marginTop: 10 }}>{addError}</div>}
        </section>

        <section className="sect">
          <h3>Forms Fill Me remembers</h3>
          {forms === null ? (
            <p className="hint">Loading…</p>
          ) : forms.length === 0 ? (
            <p className="hint">None yet. After you fill a form, Fill Me remembers your choices for it here.</p>
          ) : (
            <>
              <p className="hint" style={{ marginBottom: 6 }}>Next time you open one of these, your earlier choices are reused and the AI isn't needed.</p>
              <ul className="list autofill-forms">
                {forms.map((f) => (
                  <li key={f.signature}>
                    <span className="file-cell"><span className="pdf-ico">PDF</span>{f.name}</span>
                    <span className="hint">
                      {f.fields} fields{f.last_filled ? `, last filled ${new Date(f.last_filled).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : ""}
                    </span>
                    <button type="button" className="btn small" onClick={() => forgetForm(f.signature)}>Forget</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <div className="autofill-save">
          {status && <span className={`msg ${status.ok ? "ok" : "err"}`}>{status.text}</span>}
          <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
        </div>
      </form>
    </div>
  );
}

function Pane({ file, api, onResult }: ToolPaneProps) {
  const navigate = useNavigate();
  const id = file.file_id;
  const [data, setData] = useState<MapData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"" | "map" | "fill">("");
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [summary, setSummary] = useState("");

  // Start over when a different document is open.
  useEffect(() => { setData(null); setSummary(""); setError(""); setShowAll(false); }, [id]);

  const match = async () => {
    setBusy("map");
    setError("");
    setSummary("");
    try {
      // Not sent to onResult: the toast would show the profile values.
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
      setBusy("");
    }
  };

  const corrected = useMemo(() => {
    if (!data) return 0;
    return data.fields.filter((r) => (mapping[r.field] ?? null) !== r.key || r.field in overrides).length;
  }, [data, mapping, overrides]);

  const fill = async () => {
    if (!data) return;
    setBusy("fill");
    setError("");
    try {
      const res = await api.runTool("autofill", [id], {
        action: "fill", signature: data.signature, mapping, overrides,
      });
      onResult(res);
      if (res.ok) {
        const skipped: string[] = res.data.skipped ?? [];
        const changed = data.source === "learned" ? "" : ` The AI suggested ${data.fields.filter((r) => r.key).length} and you changed ${corrected}.`;
        setSummary(
          `Filled ${res.data.filled?.length ?? 0} fields.${changed} ` +
          (skipped.length ? `${skipped.length} couldn't be filled because the form doesn't accept that value. ` : "") +
          "Your choices are remembered for this form.",
        );
        // So the profile page can list this form by name. Never sends profile values.
        api.runTool("autofill_memory", [], {
          action: "note", signature: data.signature, filename: file.filename, fields: data.fields.length,
        }).catch(() => undefined);
      } else {
        setError(res.message);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const keys = data ? Object.keys(data.values).sort((a, b) => label(a).localeCompare(label(b))) : [];
  const rows = data ? data.fields.filter((r) => showAll || mapping[r.field] || r.field in overrides) : [];
  const matched = data ? Object.keys(mapping).length : 0;
  const flaggedCount = data ? data.fields.filter((r) => r.needs_review && r.key && mapping[r.field] === r.key && !(r.field in overrides)).length : 0;

  return (
    <>
      <div className="step">
        <p className="text">Matches this form's fields to your saved profile. The AI only sees field names, never your details.</p>
        <button className={`btn block${data ? "" : " primary"}`} disabled={!!busy} onClick={match}>
          {busy === "map" ? "Reading the form…" : data ? "Match again" : "Match fields to my profile"}
        </button>
        <div><button className="link-btn" onClick={() => navigate("/profile")}>Edit my profile</button></div>
        {error && <div className="msg err">{error}</div>}
      </div>

      {data && (
        <div className="step">
          {data.source === "learned" ? (
            <div className="msg info">
              <strong>Remembered from last time.</strong> You've filled this form before, so your earlier choices were reused. The AI wasn't needed.
            </div>
          ) : (
            <h4>
              {matched} of {data.fields.length} fields matched by the AI.
              {flaggedCount > 0 ? ` Check the highlighted ${flaggedCount === 1 ? "one" : "ones"}.` : " Check them before filling."}
            </h4>
          )}
          <p className="hint">Measured on 9 public forms: 31 of 35 required fields right, and 4 wrong fills out of 460 fields. Always check before you submit.</p>
          <div className="autofill-rows">
            {rows.map((r) => {
              const key = mapping[r.field] ?? "";
              const value = overrides[r.field] ?? (key ? data.values[key] ?? "" : "");
              const flagged = r.needs_review && !!r.key && mapping[r.field] === r.key && !(r.field in overrides);
              const shown = r.shown_as.length > 80 ? `${r.shown_as.slice(0, 80)}…` : r.shown_as;
              const conf = r.field in overrides ? "Typed by you"
                : key !== (r.key ?? "") ? "Changed"
                : !r.key ? ""
                : data.source === "learned" ? "Remembered"
                : `${Math.round(r.confidence * 100)}%`;
              return (
                <div key={r.field} className={`autofill-row${flagged ? " review" : ""}`}>
                  <div className="autofill-row-top">
                    <span className="autofill-row-label" title={r.field}>{shown}</span>
                    <span className="autofill-row-conf">{conf}</span>
                  </div>
                  <select
                    className="inp"
                    value={key}
                    aria-label={`Profile entry for ${shown}`}
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
                    {keys.map((k) => <option key={k} value={k}>{label(k)}</option>)}
                  </select>
                  <input
                    className="inp"
                    value={value}
                    placeholder="Type a value"
                    onChange={(e) => {
                      const typed = e.target.value;
                      setOverrides((o) => ({ ...o, [r.field]: typed }));
                    }}
                    aria-label={`Value for ${shown}`}
                  />
                </div>
              );
            })}
            {!rows.length && <p className="hint">Nothing matched. Show all fields to choose by hand.</p>}
          </div>
          <label className="check">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all {data.fields.length} fields
          </label>
          {data.sent_to_model && (
            <details className="autofill-sent">
              <summary>See exactly what the AI received</summary>
              <p className="hint">Field descriptions and profile labels. None of your details.</p>
              <pre>{data.sent_to_model}</pre>
            </details>
          )}
        </div>
      )}

      {data && (
        <div className="step">
          <button className="btn primary block" disabled={!!busy} onClick={fill}>{busy === "fill" ? "Filling…" : "Fill the PDF"}</button>
          {summary && <div className="msg ok">{summary}</div>}
        </div>
      )}
    </>
  );
}

const tool: ToolUI = {
  id: "autofill",
  Pane,
  routes: [{ path: "/profile", frame: "home", element: <ProfilePage /> }],
};
export default tool;
