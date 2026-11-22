import { useEffect, useState } from "react";
import api from "../api/api";
import { deriveKeys, encryptJson, decryptJson } from "../crypto/crypto";
import { getStrength } from "../utils/strength";

export default function ChangePasswordModal({ email, onClose, onChanged }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(null); // null = loading
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const strength = getStrength(next);
  const type = showPw ? "text" : "password";

  useEffect(() => {
    api.get("/api/mfa/status")
      .then(({ data }) => setMfaEnabled(data.enabled))
      .catch(() => setError("Could not load your account status. Close this window and try again."));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (next.length < 12) return setError("The new master password must be at least 12 characters.");
    if (next !== confirm) return setError("The new passwords don't match.");
    if (next === current) return setError("The new password must be different from the current one.");
    if (mfaEnabled && !mfaCode.trim()) return setError("Enter your 2FA or recovery code.");

    setBusy(true);
    try {
      setStatus("Checking your current password…");
      const oldKeys = await deriveKeys(email, current);
      setStatus("Preparing your new keys…");
      const newKeys = await deriveKeys(email, next);

      setStatus("Re-encrypting your vault…");
      const { data: stored } = await api.get("/api/vault");

      let plain;
      try {
        plain = await Promise.all(
          stored.map(async (i) => ({ id: i.id, data: await decryptJson(i, oldKeys.encKey) }))
        );
      } catch {
        // Decryption only fails with the wrong key
        setError("Your current master password is incorrect.");
        return;
      }

      const items = await Promise.all(
        plain.map(async (p) => ({ id: p.id, ...(await encryptJson(p.data, newKeys.encKey)) }))
      );

      setStatus("Saving…");
      await api.post("/api/account/change-password", {
        currentAuthHash: oldKeys.authHash,
        newAuthHash: newKeys.authHash,
        mfaCode: mfaEnabled ? mfaCode.trim() : null,
        items,
      });
      setDone(true);
    } catch (err) {
      const s = err.response?.status;
      if (!err.response) setError("Cannot reach the server. Is the backend running?");
      else if (s === 400) setError(err.response.data?.detail || "Please check your details and try again.");
      else if (s === 409) setError("Your vault changed while updating. Close this window and try again.");
      else if (s === 429) setError("Too many attempts. Please wait a few minutes and try again.");
      else if (s !== 401) setError("Something went wrong. Please try again.");
      // 401 is handled globally (the vault locks and shows the login screen)
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  if (done) {
    return (
      <div className="backdrop">
        <div className="modal">
          <h3>Master password changed</h3>
          <div className="alert alert-success">
            Your vault was re-encrypted with the new password. For your security you will now be
            signed out. Log in again with the new password.
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onChanged}>Sign in again</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop" onClick={busy ? undefined : onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Change master password</h3>
        <p className="item-sub">
          Your vault is re-encrypted in this browser. If you forget the new password, your data
          cannot be recovered.
        </p>

        <label>
          Current master password
          <input type={type} value={current} onChange={(e) => setCurrent(e.target.value)}
                 autoComplete="current-password" autoFocus required disabled={busy} />
        </label>

        <label>
          New master password
          <input type={type} value={next} onChange={(e) => setNext(e.target.value)}
                 autoComplete="new-password" required disabled={busy} />
        </label>

        {next && (
          <div>
            <div className="strength-bar">
              <div style={{ width: `${strength.percent}%`, background: strength.color }} />
            </div>
            <span className="strength-label">Strength: {strength.label}</span>
          </div>
        )}

        <label>
          Confirm new master password
          <input type={type} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                 autoComplete="new-password" required disabled={busy} />
        </label>

        {mfaEnabled && (
          <label>
            2FA code (or a recovery code)
            <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)}
                   inputMode="numeric" autoComplete="one-time-code" maxLength={12}
                   placeholder="123456" required disabled={busy} />
          </label>
        )}

        <button type="button" className="link" style={{ justifySelf: "start" }}
                onClick={() => setShowPw(!showPw)}>
          {showPw ? "Hide passwords" : "Show passwords"}
        </button>

        {error && <div className="alert alert-danger">{error}</div>}
        {busy && status && <div className="alert alert-info">{status}</div>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || mfaEnabled === null}>
            {busy ? "Working…" : "Change password"}
          </button>
        </div>
      </form>
    </div>
  );
}