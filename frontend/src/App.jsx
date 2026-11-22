import { useCallback, useEffect, useState } from "react";
import AuthForm from "./components/AuthForm";
import Shell from "./components/Shell";
import { setToken, setUnauthorizedHandler, logoutSession } from "./api/api";
import useAutoLock from "./hooks/useAutoLock";
import useTheme from "./hooks/useTheme";

const STORAGE_KEY = "pm_autolock_minutes";
const ALLOWED = [1, 5, 15, 30];

function readMinutes() {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return ALLOWED.includes(v) ? v : 5;
  } catch {
    return 5;
  }
}

export default function App() {
  const [encKey, setEncKey] = useState(null);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [minutes, setMinutes] = useState(readMinutes);
  const { theme, setTheme } = useTheme();

  const lock = useCallback((reason = "") => {
    logoutSession(); // revokes the refresh token on the server (fire and forget)
    setToken(null);
    setEncKey(null); // key is dropped, Shell unmounts and its decrypted items go with it
    setEmail("");
    setNotice(reason);
  }, []);

  const handleAuth = (key, userEmail) => {
    setNotice("");
    setEmail(userEmail);
    setEncKey(key);
  };

  const changeMinutes = (m) => {
    setMinutes(m);
    try {
      localStorage.setItem(STORAGE_KEY, String(m));
    } catch {
      // storage unavailable: the setting just won't persist
    }
  };

  // Refresh failed or the session was revoked -> lock the vault
  useEffect(() => {
    setUnauthorizedHandler(() => lock("Your session expired. Please log in again."));
    return () => setUnauthorizedHandler(null);
  }, [lock]);

  // Inactivity -> lock the vault
  useAutoLock(!!encKey, minutes * 60 * 1000, () =>
    lock(`Vault locked after ${minutes} minute${minutes === 1 ? "" : "s"} of inactivity.`)
  );

  return encKey ? (
    <Shell
      encKey={encKey}
      email={email}
      onLock={() => lock()}
      autoLockMinutes={minutes}
      onAutoLockChange={changeMinutes}
      theme={theme}
      onThemeChange={setTheme}
      onPasswordChanged={() =>
        lock("Master password changed. Please log in with your new password.")
      }
    />
  ) : (
    <AuthForm onAuth={handleAuth} notice={notice} />
  );
}