import { useEffect, useRef } from "react";

const EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];

/**
 * Calls onLock() after `timeoutMs` with no user activity.
 * Only active while `enabled` is true (i.e. the vault is unlocked).
 */
export default function useAutoLock(enabled, timeoutMs, onLock) {
  const lastActivity = useRef(Date.now());
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock; // always call the latest callback

  useEffect(() => {
    if (!enabled) return;

    lastActivity.current = Date.now();
    const markActive = () => {
      lastActivity.current = Date.now();
    };

    const check = () => {
      if (Date.now() - lastActivity.current >= timeoutMs) {
        onLockRef.current();
      }
    };

    EVENTS.forEach((ev) => window.addEventListener(ev, markActive, { passive: true }));
    // Check once a second. Also check when the tab becomes visible again,
    // because browsers slow down timers in background tabs.
    const interval = setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);

    return () => {
      EVENTS.forEach((ev) => window.removeEventListener(ev, markActive));
      clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
    };
  }, [enabled, timeoutMs]);
}