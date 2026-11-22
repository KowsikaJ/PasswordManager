import { useState } from "react";

const EyeOpen = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOff = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function PasswordInput({
  value, onChange, placeholder, autoComplete, autoFocus, required, disabled,
}) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);

  // Only known after a key event: browsers can't report Caps Lock before one happens
  const checkCaps = (e) => setCaps(!!e.getModifierState?.("CapsLock"));

  return (
    <div>
      <div className="pw-row">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          onKeyDown={checkCaps}
          onKeyUp={checkCaps}
          onBlur={() => setCaps(false)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required={required}
          disabled={disabled}
        />
        <button
          type="button"
          className="pw-toggle"
          onClick={() => setShow(!show)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          tabIndex={-1}
        >
          {show ? EyeOff : EyeOpen}
        </button>
      </div>
      {caps && <div className="caps-warning" role="status">Caps Lock is on</div>}
    </div>
  );
}

/** Live rules list for the register page. Only the length rule is enforced. */
export function PasswordChecklist({ password }) {
  const rules = [
    { label: "At least 12 characters (required)", ok: password.length >= 12 },
    { label: "Upper and lower case letters", ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: "A number", ok: /\d/.test(password) },
    { label: "A symbol", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  return (
    <ul className="checklist" aria-live="polite">
      {rules.map((r) => (
        <li key={r.label} className={r.ok ? "met" : ""}>{r.label}</li>
      ))}
    </ul>
  );
}