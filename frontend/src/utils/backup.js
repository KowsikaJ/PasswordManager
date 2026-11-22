const enc = new TextEncoder();
const dec = new TextDecoder();

const FORMAT = "securevault-backup";
const VERSION = 1;
const ITERATIONS = 600000;
const MIN_ITERATIONS = 100000;
const MAX_ITERATIONS = 5000000; // a file must not be able to make your browser grind for hours

const toB64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
};
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function isBackupText(text) {
  try {
    return JSON.parse(text)?.format === FORMAT;
  } catch {
    return false;
  }
}

/** Encrypts the items with a key derived from the backup password. Returns the file contents. */
export async function createBackup(items, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);

  const payload = {
    exportedAt: new Date().toISOString(),
    items: items.map(({ title, username, password: pw, url, notes }) => ({
      title, username, password: pw, url, notes,
    })),
  };
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(payload))
  );

  return JSON.stringify(
    {
      format: FORMAT,
      version: VERSION,
      kdf: { name: "PBKDF2-SHA256", iterations: ITERATIONS, salt: toB64(salt) },
      iv: toB64(iv),
      ciphertext: toB64(ciphertext),
    },
    null,
    2
  );
}

/** Returns the raw item list. Throws Error("WRONG_PASSWORD") or Error("INVALID"). */
export async function readBackup(text, password) {
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error("INVALID");
  }
  const iterations = file?.kdf?.iterations;
  if (file?.format !== FORMAT || file?.version !== VERSION ||
      file?.kdf?.name !== "PBKDF2-SHA256" ||
      !Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS ||
      typeof file.kdf.salt !== "string" || typeof file.iv !== "string" ||
      typeof file.ciphertext !== "string") {
    throw new Error("INVALID");
  }

  let plain;
  try {
    const key = await deriveKey(password, fromB64(file.kdf.salt), iterations);
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(file.iv) }, key, fromB64(file.ciphertext));
  } catch {
    throw new Error("WRONG_PASSWORD"); // AES-GCM fails authentication with a wrong key
  }

  let data;
  try {
    data = JSON.parse(dec.decode(plain));
  } catch {
    throw new Error("INVALID");
  }
  if (!Array.isArray(data?.items)) throw new Error("INVALID");
  return data.items;
}