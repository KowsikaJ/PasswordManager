export const ACTIONS = {
  REGISTER: { label: "Account created", tone: "info" },
  LOGIN_SUCCESS: { label: "Signed in", tone: "ok" },
  LOGIN_FAILED: { label: "Failed sign-in attempt", tone: "bad" },
  MFA_LOGIN_SUCCESS: { label: "Signed in with 2FA", tone: "ok" },
  MFA_LOGIN_FAILED: { label: "Failed 2FA code", tone: "bad" },
  MFA_SETUP_STARTED: { label: "2FA setup started", tone: "info" },
  MFA_ENABLED: { label: "2FA enabled", tone: "ok" },
  MFA_DISABLED: { label: "2FA disabled", tone: "warn" },
  RECOVERY_CODE_USED: { label: "Recovery code used", tone: "warn" },
  ITEM_CREATED: { label: "Item added", tone: "info" },
  ITEM_UPDATED: { label: "Item updated", tone: "info" },
  ITEM_DELETED: { label: "Item deleted", tone: "warn" },
  PASSWORD_CHANGED: { label: "Master password changed", tone: "warn" },
  PASSWORD_CHANGE_FAILED: { label: "Failed password change", tone: "bad" },
  ITEMS_IMPORTED: { label: "Items imported", tone: "info" },
  ITEMS_EXPORTED: { label: "Items exported", tone: "warn" },
  LOGOUT_ALL: { label: "Signed out of all devices", tone: "warn" },
  REFRESH_REUSE_DETECTED: { label: "Session token reuse detected", tone: "bad" },
};

export const describe = (action) =>
  ACTIONS[action] || { label: action, tone: "info" };

export const formatTime = (iso) => new Date(iso).toLocaleString();

export function timeAgo(iso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

export function shortDevice(ua) {
  if (!ua) return "Unknown device";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" : "Browser";
  const os =
    /Windows/.test(ua) ? "Windows" :
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad/.test(ua) ? "iOS" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return `${browser} on ${os}`;
}