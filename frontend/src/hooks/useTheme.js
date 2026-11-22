import { useCallback, useEffect, useState } from "react";

const KEY = "pm_theme";
const OPTIONS = ["system", "light", "dark"];

function read() {
  try {
    const v = localStorage.getItem(KEY);
    return OPTIONS.includes(v) ? v : "system";
  } catch {
    return "system";
  }
}

function resolve(pref) {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function useTheme() {
  const [theme, setThemeState] = useState(read);

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolve(theme);
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // storage unavailable: the choice just won't persist
    }
  }, []);

  return { theme, setTheme };
}