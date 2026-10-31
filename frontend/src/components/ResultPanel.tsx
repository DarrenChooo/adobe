import { fileUrl, type RunResult } from "../api";

interface Props {
  result: RunResult | null;
  onPreview?: (fileId: string) => void;
}

/** Shows a tool's message, its output files with download links, and any data. */
export default function ResultPanel({ result, onPreview }: Props) {
  if (!result) return null;
  const data = Object.keys(result.data ?? {}).length ? result.data : null;
  return (
    <div className={`result ${result.ok ? "ok" : "fail"}`}>
      <div className="result-msg">{result.ok ? "✓ " : "✗ "}{result.message || (result.ok ? "Done." : "Failed.")}</div>
      {result.outputs.length > 0 && (
        <ul className="outputs">
          {result.outputs.map((o) => (
            <li key={o.file_id}>
              <span className="fname">{o.filename}</span>
              {onPreview && o.mime === "application/pdf" && (
                <button className="link" onClick={() => onPreview(o.file_id)}>Preview</button>
              )}
              <a className="button" href={fileUrl(o.file_id, true)} download={o.filename}>Download</a>
            </li>
          ))}
        </ul>
      )}
      {data && (
        <details>
          <summary>Details</summary>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
