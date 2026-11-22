import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import api from "../api/api";

export default function MfaSettings() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(null); // null = loading
  const [step, setStep] = useState("status");   // status | scan | codes | disable
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep("status");
    setSetup(null);
    setCode("");
    setCodes([]);
    setError("");
  };

  const openModal = async () => {
    reset();
    setEnabled(null);
    setOpen(true);
    try {
      const { data } = await api.get("/api/mfa/status");
      setEnabled(data.enabled);
    } catch {
      setError("Could not load 2FA status.");
    }
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const startSetup = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/api/mfa/setup");
      setSetup(data);
      setStep("scan");
    } catch {
      setError("Could not start setup. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/api/mfa/enable", { code });
      setCodes(data.codes);
      setEnabled(true);
      setCode("");
      setStep("codes");
    } catch {
      setError("Invalid code. Check your authenticator app and try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/api/mfa/disable", { code: code.trim() });
      setEnabled(false);
      reset();
    } catch {
      setError("Invalid code.");
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = () => navigator.clipboard.writeText(codes.join("\n"));

  const downloadCodes = () => {
    const blob = new Blob([codes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "securevault-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button className="btn" onClick={openModal}>Manage 2FA</button>

      {open && (
        <div className="backdrop" onClick={step === "codes" ? undefined : close}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Two-factor authentication</h3>
            {error && <div className="alert alert-danger">{error}</div>}

            {step === "status" && enabled === null && !error && <p className="hint">Loading...</p>}

            {step === "status" && enabled === false && (
              <>
                <p className="item-sub">
                  Add a second step at login using an authenticator app such as Google Authenticator,
                  Authy or Microsoft Authenticator.
                </p>
                <div className="modal-actions">
                  <button className="btn" onClick={close}>Close</button>
                  <button className="btn btn-primary" onClick={startSetup} disabled={busy}>
                    {busy ? "Working..." : "Enable 2FA"}
                  </button>
                </div>
              </>
            )}

            {step === "status" && enabled === true && (
              <>
                <p>Two-factor authentication is <strong>on</strong>.</p>
                <div className="modal-actions">
                  <button className="btn" onClick={close}>Close</button>
                  <button className="btn btn-danger"
                          onClick={() => { setError(""); setCode(""); setStep("disable"); }}>
                    Disable 2FA
                  </button>
                </div>
              </>
            )}

            {step === "scan" && setup && (
              <form onSubmit={confirmEnable} style={{ display: "grid", gap: 14 }}>
                <p className="item-sub">1. Scan this QR code with your authenticator app.</p>
                <div style={{ display: "grid", placeItems: "center" }}>
                  <div style={{ background: "#fff", padding: 12, borderRadius: 4, border: "1px solid var(--border)" }}>
                    <QRCodeSVG value={setup.otpAuthUri} size={168} />
                  </div>
                </div>
                <p className="item-sub">
                  Can't scan? Enter this key manually:
                </p>
                <div className="pw-line"><span>{setup.secret}</span></div>
                <label>
                  2. Enter the 6-digit code from the app
                  <input value={code} inputMode="numeric" autoComplete="one-time-code"
                         maxLength={6} placeholder="123456" autoFocus required
                         onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                </label>
                <div className="modal-actions">
                  <button type="button" className="btn" onClick={reset}>Cancel</button>
                  <button className="btn btn-primary" disabled={busy || code.length !== 6}>
                    {busy ? "Verifying..." : "Verify and enable"}
                  </button>
                </div>
              </form>
            )}

            {step === "codes" && (
              <>
                <p className="item-sub">
                  2FA is on. Save these recovery codes now. Each works once if you lose your
                  phone, and <strong>they won't be shown again</strong>.
                </p>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
                  fontFamily: "var(--mono)",
                }}>
                  {codes.map((c) => (
                    <div key={c} className="pw-line" style={{ justifyContent: "center" }}>{c}</div>
                  ))}
                </div>
                <div className="modal-actions">
                  <button className="btn" onClick={copyCodes}>Copy</button>
                  <button className="btn" onClick={downloadCodes}>Download</button>
                  <button className="btn btn-primary" onClick={close}>I've saved them</button>
                </div>
              </>
            )}

            {step === "disable" && (
              <form onSubmit={confirmDisable} style={{ display: "grid", gap: 14 }}>
                <label>
                  Enter a code from your app (or a recovery code) to turn 2FA off
                  <input value={code} onChange={(e) => setCode(e.target.value)}
                         maxLength={12} autoFocus required />
                </label>
                <div className="modal-actions">
                  <button type="button" className="btn" onClick={reset}>Cancel</button>
                  <button className="btn btn-danger" disabled={busy}>
                    {busy ? "Working..." : "Disable 2FA"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}