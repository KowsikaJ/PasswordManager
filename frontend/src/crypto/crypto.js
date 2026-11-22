const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const ITERATIONS = 600000;

/**
 * From email + master password, derive:
 *  - authHash: sent to the server (proves identity)
 *  - encKey:   AES-GCM key that never leaves the browser
 */
export async function deriveKeys(email, password) {
  const salt = enc.encode(email.trim().toLowerCase());

  const baseKey = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const masterBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    baseKey, 256
  );

  // Auth hash: one more PBKDF2 round on top of the master key
  const masterAsBase = await crypto.subtle.importKey(
    "raw", masterBits, "PBKDF2", false, ["deriveBits"]
  );
  const authBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(password), iterations: 1 },
    masterAsBase, 256
  );

  const encKey = await crypto.subtle.importKey(
    "raw", masterBits, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]
  );

  return { authHash: toB64(authBits), encKey };
}

export async function encryptJson(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj))
  );
  return { encryptedData: toB64(ciphertext), iv: toB64(iv) };
}

export async function decryptJson({ encryptedData, iv }, key) {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(encryptedData)
  );
  return JSON.parse(dec.decode(plain));
}

export function generatePassword(length = 20) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
  const rand = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(rand, (n) => chars[n % chars.length]).join("");
}