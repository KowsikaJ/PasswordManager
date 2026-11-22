import { useState } from "react";
import MfaSettings from "../components/MfaSettings";
import ChangePasswordModal from "../components/ChangePasswordModal";
import ImportExportModal from "../components/ImportExportModal";
import { useConfirm } from "../components/ConfirmDialog";
import { logoutEverywhere } from "../api/api";

const OPTIONS = [1, 5, 15, 30];

export default function SettingsPage({
  email, items, encKey, reload,
  autoLockMinutes, onAutoLockChange, onLock,
  onPasswordChanged,
}) {
  const [changing, setChanging] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const signOutEverywhere = async () => {
    const ok = await confirm({
      title: "Sign out of all devices?",
      message: "Every active session, including this one, will end. You will need to log in again everywhere.",
      confirmLabel: "Sign out everywhere",
      danger: true,
    });
    if (!ok) return;

    setSessionError("");
    setSigningOut(true);
    try {
      await logoutEverywhere();
      onLock();
    } catch (err) {
      // A 401 is handled globally (the vault locks)
      if (err.response?.status !== 401) setSessionError("Could not sign out of all devices. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <header className="topbar">
        <div className="page-title">
          <h2>Settings</h2>
          <small>Manage your account, security and data</small>
        </div>
      </header>

      <section className="panel">
        <div className="panel-head"><h3>Account</h3></div>
        <div className="setting-row">
          <div className="desc">
            <div>Email</div>
            <small className="muted">{email}</small>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Security</h3></div>

        <div className="setting-row">
          <div className="desc">
            <div>Master password</div>
            <small className="muted">Re-encrypts your whole vault with a new password</small>
          </div>
          <button className="btn" onClick={() => setChanging(true)}>Change</button>
        </div>

        <div className="setting-row">
          <div className="desc">
            <div>Two-factor authentication</div>
            <small className="muted">Require a code from an authenticator app at login</small>
          </div>
          <MfaSettings />
        </div>

        <div className="setting-row">
          <div className="desc">
            <div>Auto-lock</div>
            <small className="muted">Lock the vault after this much inactivity</small>
          </div>
          <select value={autoLockMinutes} onChange={(e) => onAutoLockChange(Number(e.target.value))}>
            {OPTIONS.map((m) => (
              <option key={m} value={m}>{m} minute{m === 1 ? "" : "s"}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Data</h3></div>
        <div className="setting-row">
          <div className="desc">
            <div>Import / Export</div>
            <small className="muted">
              Bring in passwords from a CSV, or download an encrypted backup of your vault
            </small>
          </div>
          <button className="btn" onClick={() => setTransferring(true)}>Open</button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Session</h3></div>
        <div className="setting-row">
          <div className="desc">
            <div>Lock vault now</div>
            <small className="muted">Clears your encryption key from memory</small>
          </div>
          <button className="btn" onClick={onLock}>Lock</button>
        </div>
        <div className="setting-row">
          <div className="desc">
            <div>Sign out of all devices</div>
            <small className="muted">Ends every active session, including this one</small>
          </div>
          <button className="btn btn-danger" onClick={signOutEverywhere} disabled={signingOut}>
            {signingOut ? "Working…" : "Sign out everywhere"}
          </button>
        </div>
        {sessionError && <div className="alert alert-danger" style={{ marginTop: 8 }}>{sessionError}</div>}
      </section>

      {changing && (
        <ChangePasswordModal
          email={email}
          onClose={() => setChanging(false)}
          onChanged={onPasswordChanged}
        />
      )}

      {transferring && (
        <ImportExportModal
          items={items}
          email={email}
          encKey={encKey}
          reload={reload}
          onClose={() => setTransferring(false)}
        />
      )}

      {confirmDialog}
    </>
  );
}