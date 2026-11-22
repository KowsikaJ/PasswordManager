import { useState } from "react";
import api, { setToken } from "../api/api";
import { deriveKeys } from "../crypto/crypto";
import { getStrength } from "../utils/strength";
import PasswordInput, { PasswordChecklist } from "./PasswordInput";

// Defined outside AuthForm so it isn't recreated (and the inputs reset) on every render
function AuthShell({ children }) {
  return (
    <div className="auth-layout">
      <aside className="auth-hero">
        <img src="/auth-art.svg" alt="" />
      </aside>
      <main className="auth-panel">{children}</main>
    </div>
  );
}

export default function AuthForm({ onAuth, notice }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // MFA step
  const [mfaToken, setMfaToken] = useState(null);
  const [pendingKey, setPendingKey] = useState(null);
  const [mfaCode, setMfaCode] = useState("");

  const isRegister = mode === "register";
  const strength = getStrength(password);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (isRegister && password.length < 12) {
      setError("Master password must be at least 12 characters.");
      return;
    }
    setLoading(true);
    try {
      const { authHash, encKey } = await deriveKeys(email, password);
      const { data } = await api.post(`/api/auth/${mode}`, { email, authHash });

      if (isRegister) {
        setMode("login");
        setPassword("");
        setError("");
        setSuccess("Account created. Please log in.");
        return;
      }

      if (data.mfaRequired) {
        setPendingKey(encKey);
        setMfaToken(data.mfaToken);
        setPassword("");
        return;
      }

      setToken(data.token);
      onAuth(encKey, email.trim().toLowerCase());
    } catch (err) {
      const status = err.response?.status;
      if (!err.response) setError("Cannot reach the server. Is the backend running?");
      else if (status === 401) setError("Invalid email or master password.");
      else if (status === 429) setError("Too many attempts. Please wait a few minutes and try again.");
      else if (status === 409) setError("This email is already registered.");
      else if (status === 400) setError("Please enter a valid email and password.");
      else setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitMfa = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/mfa/verify", {
        mfaToken,
        code: mfaCode.trim(),
      });
      setToken(data.token);
      onAuth(pendingKey, email.trim().toLowerCase());
    } catch (err) {
      if (!err.response) setError("Cannot reach the server. Is the backend running?");
      else if (err.response.status === 401)
        setError("Invalid or expired code. Try again, or go back and log in again.");
      else if (err.response.status === 429)
        setError("Too many incorrect codes. Please wait a few minutes, then log in again.");
      else setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const cancelMfa = () => {
    setMfaToken(null);
    setPendingKey(null);
    setMfaCode("");
    setError("");
  };

  // ---------- Step 2: enter the code ----------
  if (mfaToken) {
    return (
      <AuthShell>
        <form className="auth-card" onSubmit={submitMfa}>
          <div className="brand-mark">SecureVault</div>
          <h2>Two-factor authentication</h2>
          <p className="auth-sub">Enter the 6-digit code from your authenticator app.</p>

          <label>
            Code
            <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value)}
                   inputMode="numeric" autoComplete="one-time-code" maxLength={12}
                   placeholder="123456" autoFocus required />
          </label>

          {error && <div className="alert alert-danger">{error}</div>}

          <button className="btn btn-primary" disabled={loading || !mfaCode.trim()}>
            {loading ? "Verifying..." : "Verify"}
          </button>

          <p className="hint">Lost your phone? Enter one of your recovery codes instead.</p>

          <p className="hint">
            <button type="button" className="link" onClick={cancelMfa}>Back to login</button>
          </p>
        </form>
      </AuthShell>
    );
  }

  // ---------- Step 1: email and master password ----------
  return (
    <AuthShell>
      <form className="auth-card" onSubmit={submit}>
        <div className="brand-mark">SecureVault</div>
        <h2>{isRegister ? "Create your vault" : "Sign in to your vault"}</h2>
        <p className="auth-sub">
          {isRegister ? "Your data is encrypted before it leaves your browser." : "Welcome back."}
        </p>

        {notice && !success && <div className="alert alert-warning">{notice}</div>}

        <label>
          Email
          <input type="email" placeholder="you@example.com" value={email}
                 onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>

        <label>
          Master password
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Master password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
          />
        </label>

        {isRegister && password && (
          <div style={{ display: "grid", gap: 8 }}>
            <div>
              <div className="strength-bar">
                <div style={{ width: `${strength.percent}%`, background: strength.color }} />
              </div>
              <span className="strength-label">Strength: {strength.label}</span>
            </div>
            <PasswordChecklist password={password} />
          </div>
        )}

        {success && <div className="alert alert-success">{success}</div>}
        {error && <div className="alert alert-danger">{error}</div>}

        <button className="btn btn-primary" disabled={loading}>
          {loading ? "Working..." : isRegister ? "Create account" : "Sign in"}
        </button>

        <p className="hint">
          {isRegister
            ? "If you forget your master password, your data cannot be recovered."
            : "Deriving your keys takes a second or two. That's intentional."}
        </p>

        <p className="hint">
          {isRegister ? "Already have an account? " : "Need an account? "}
          <button type="button" className="link"
                  onClick={() => { setMode(isRegister ? "login" : "register"); setError(""); setSuccess(""); }}>
            {isRegister ? "Sign in" : "Register"}
          </button>
        </p>
      </form>
    </AuthShell>
  );
}