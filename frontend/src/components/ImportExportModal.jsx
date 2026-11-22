import { useMemo, useState } from "react";
import api from "../api/api";
import { deriveKeys, encryptJson, decryptJson } from "../crypto/crypto";
import { parseCsv, mapRows, cleanList, toCsv, itemKey } from "../utils/csv";
import { createBackup, readBackup, isBackupText } from "../utils/backup";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const CHUNK = 200;

function download(content, filename, mime) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------ Export ------------------------------ */

function ExportTab({ items, email, encKey, onClose }) {
  const [format, setFormat] = useState("backup");
  const [masterPw, setMasterPw] = useState("");
  const [backupPw, setBackupPw] = useState("");
  const [backupPw2, setBackupPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (items.length === 0) return setError("Your vault is empty. There is nothing to export.");
    if (format === "backup") {
      if (backupPw.length < 12) return setError("The backup password must be at least 12 characters.");
      if (backupPw !== backupPw2) return setError("The backup passwords don't match.");
    }

    setBusy(true);
    try {
      // Confirm the master password: the key derived from it must match the one in memory
      const check = await deriveKeys(email, masterPw);
      try {
        const probe = await encryptJson({ ok: 1 }, encKey);
        await decryptJson(probe, check.encKey);
      } catch {
        setError("Your master password is incorrect.");
        return;
      }

      const stamp = new Date().toISOString().slice(0, 10);
      if (format === "backup") {
        download(await createBackup(items, backupPw), `securevault-backup-${stamp}.json`, "application/json");
      } else {
        download(toCsv(items), `securevault-export-${stamp}.csv`, "text/csv");
      }

      // Only records the event. Failure to log must not block the export.
      api.post("/api/vault/export-log", {
        format: format === "backup" ? "encrypted-json" : "csv",
        count: items.length,
      }).catch(() => {});

      setDone(true);
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <>
        <div className="alert alert-success">
          {format === "backup"
            ? "Encrypted backup downloaded. Keep the backup password safe: without it the file can't be opened."
            : "CSV downloaded. It contains your passwords in plain text, so delete it once you no longer need it."}
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
      <label>
        Format
        <select value={format} onChange={(e) => setFormat(e.target.value)} disabled={busy}>
          <option value="backup">Encrypted backup (JSON), recommended</option>
          <option value="csv">Plain CSV (not encrypted)</option>
        </select>
      </label>

      {format === "csv" && (
        <div className="alert alert-warning">
          A CSV is not encrypted. Anyone who gets the file can read every password in it.
        </div>
      )}

      {format === "backup" && (
        <>
          <label>
            Backup password
            <input type="password" value={backupPw} onChange={(e) => setBackupPw(e.target.value)}
                   autoComplete="new-password" disabled={busy} required />
          </label>
          <label>
            Confirm backup password
            <input type="password" value={backupPw2} onChange={(e) => setBackupPw2(e.target.value)}
                   autoComplete="new-password" disabled={busy} required />
          </label>
          <p className="item-sub">
            This password protects the file and is separate from your master password. It cannot be
            recovered if you lose it.
          </p>
        </>
      )}

      <label>
        Confirm with your master password
        <input type="password" value={masterPw} onChange={(e) => setMasterPw(e.target.value)}
               autoComplete="current-password" disabled={busy} required />
      </label>

      {error && <div className="alert alert-danger">{error}</div>}
      {busy && <div className="alert alert-info">Preparing your export…</div>}

      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Working…" : `Export ${items.length} item${items.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------ Import ------------------------------ */

function ImportTab({ items, encKey, reload, onClose, onBusyChange }) {
  const [step, setStep] = useState("pick"); // pick | password | preview | importing | done
  const [fileName, setFileName] = useState("");
  const [backupText, setBackupText] = useState("");
  const [backupPw, setBackupPw] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [skipped, setSkipped] = useState({ nonLogin: 0, noPassword: 0, tooLong: 0, invalid: 0 });
  const [skipDup, setSkipDup] = useState(true);
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const existingKeys = useMemo(() => new Set(items.map(itemKey)), [items]);

  const plan = useMemo(() => {
    const seen = new Set(existingKeys);
    const toImport = [];
    let duplicates = 0;
    for (const c of candidates) {
      const k = itemKey(c);
      if (skipDup && seen.has(k)) { duplicates++; continue; }
      seen.add(k);
      toImport.push(c);
    }
    return { toImport, duplicates };
  }, [candidates, skipDup, existingKeys]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > MAX_FILE_BYTES) return setError("That file is too large (maximum 5 MB).");

    const text = await file.text();
    setFileName(file.name);

    if (isBackupText(text)) {
      setBackupText(text);
      setBackupPw("");
      setStep("password");
      return;
    }

    const res = mapRows(parseCsv(text));
    if (res.error) return setError(res.error);
    if (res.items.length === 0) {
      setSkipped(res.skipped);
      return setError("No importable items were found in that file.");
    }
    setCandidates(res.items);
    setSkipped(res.skipped);
    setStep("preview");
  };

  const unlockBackup = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const raw = await readBackup(backupText, backupPw);
      const res = cleanList(raw);
      if (res.items.length === 0) return setError("That backup contains no importable items.");
      setCandidates(res.items);
      setSkipped(res.skipped);
      setStep("preview");
    } catch (err) {
      setError(err.message === "WRONG_PASSWORD"
        ? "Wrong backup password."
        : "This backup file is damaged or not supported.");
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    setError("");
    setProgress(0);
    setStep("importing");
    onBusyChange(true);
    let done = 0;
    try {
      for (let i = 0; i < plan.toImport.length; i += CHUNK) {
        const chunk = plan.toImport.slice(i, i + CHUNK);
        const payload = await Promise.all(chunk.map((it) => encryptJson(it, encKey)));
        await api.post("/api/vault/bulk", { items: payload });
        done += chunk.length;
        setProgress(done);
      }
      setImported(done);
      setStep("done");
    } catch (err) {
      const s = err.response?.status;
      let msg;
      if (!err.response) msg = "Cannot reach the server. Is the backend running?";
      else if (s === 409) msg = err.response.data?.detail || "Your vault is full.";
      else if (s === 400) msg = "The server rejected part of the file.";
      else msg = "Something went wrong while importing.";
      if (done > 0) msg += ` ${done} items were imported before the error. You can run the import again, and duplicates will be skipped.`;
      setError(msg);
      setStep("preview");
    } finally {
      onBusyChange(false);
      await reload().catch(() => {}); // the list also refreshes the duplicate check on retry
    }
  };

  if (step === "done") {
    return (
      <>
        <div className="alert alert-success">
          Imported {imported} item{imported === 1 ? "" : "s"}.
          {fileName.toLowerCase().endsWith(".csv") &&
            " The CSV contains plain-text passwords, so delete the file now."}
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </>
    );
  }

  if (step === "importing") {
    return (
      <>
        <div className="alert alert-info">
          Encrypting and uploading… {progress} of {plan.toImport.length}
        </div>
        <div className="strength-bar">
          <div style={{ width: `${(progress / Math.max(plan.toImport.length, 1)) * 100}%`, background: "var(--primary)" }} />
        </div>
      </>
    );
  }

  if (step === "password") {
    return (
      <form onSubmit={unlockBackup} style={{ display: "grid", gap: 14 }}>
        <p className="item-sub">{fileName} is an encrypted SecureVault backup.</p>
        <label>
          Backup password
          <input type="password" value={backupPw} onChange={(e) => setBackupPw(e.target.value)}
                 autoFocus required disabled={busy} />
        </label>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn"
                  onClick={() => { setStep("pick"); setError(""); }} disabled={busy}>Back</button>
          <button className="btn btn-primary" disabled={busy || !backupPw}>
            {busy ? "Decrypting…" : "Unlock backup"}
          </button>
        </div>
      </form>
    );
  }

  if (step === "preview") {
    const skippedTotal = skipped.nonLogin + skipped.noPassword + skipped.tooLong + skipped.invalid;
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <p className="item-sub">From <strong>{fileName}</strong></p>

        <div className="alert alert-info">
          <strong>{plan.toImport.length}</strong> item{plan.toImport.length === 1 ? "" : "s"} will be imported.
        </div>

        <div className="item-sub" style={{ display: "grid", gap: 2 }}>
          {plan.duplicates > 0 && <span>• {plan.duplicates} duplicate{plan.duplicates === 1 ? "" : "s"} skipped</span>}
          {skipped.noPassword > 0 && <span>• {skipped.noPassword} without a password skipped</span>}
          {skipped.nonLogin > 0 && <span>• {skipped.nonLogin} non-login entries (notes, cards) skipped</span>}
          {skipped.tooLong > 0 && <span>• {skipped.tooLong} with oversized fields skipped</span>}
          {skipped.invalid > 0 && <span>• {skipped.invalid} unreadable entries skipped</span>}
          {skippedTotal === 0 && plan.duplicates === 0 && <span>• Nothing was skipped</span>}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text)" }}>
          <input type="checkbox" style={{ width: "auto", minHeight: 0 }}
                 checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} />
          Skip items that already exist (same title, username and URL)
        </label>

        {plan.toImport.length > 0 && (
          <div className="pw-line" style={{ display: "grid", gap: 2, fontFamily: "var(--font)" }}>
            {plan.toImport.slice(0, 5).map((it, i) => (
              <span key={i}>{it.title}{it.username ? ` · ${it.username}` : ""}</span>
            ))}
            {plan.toImport.length > 5 && <span className="muted">…and {plan.toImport.length - 5} more</span>}
          </div>
        )}

        {error && <div className="alert alert-danger">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={() => { setStep("pick"); setError(""); }}>Back</button>
          <button className="btn btn-primary" onClick={run} disabled={plan.toImport.length === 0}>
            Import {plan.toImport.length} item{plan.toImport.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    );
  }

  // step === "pick"
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p className="item-sub">
        Choose a CSV exported from Chrome, Bitwarden, 1Password or similar, or an encrypted backup
        made by this app.
      </p>
      <input type="file" accept=".csv,.json,text/csv,application/json" onChange={onFile} />
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="alert alert-warning">
        CSV files hold your passwords in plain text. Delete the file after importing.
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/* ------------------------------ Modal ------------------------------ */

export default function ImportExportModal({ items, email, encKey, reload, onClose }) {
  const [tab, setTab] = useState("import");
  const [importing, setImporting] = useState(false);

  return (
    <div className="backdrop" onClick={importing ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Import / Export</h3>

        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn ${tab === "import" ? "btn-primary" : ""}`}
                  onClick={() => setTab("import")} disabled={importing}>Import</button>
          <button className={`btn ${tab === "export" ? "btn-primary" : ""}`}
                  onClick={() => setTab("export")} disabled={importing}>Export</button>
        </div>

        {tab === "import" ? (
          <ImportTab items={items} encKey={encKey} reload={reload}
                     onClose={onClose} onBusyChange={setImporting} />
        ) : (
          <ExportTab items={items} email={email} encKey={encKey} onClose={onClose} />
        )}
      </div>
    </div>
  );
}