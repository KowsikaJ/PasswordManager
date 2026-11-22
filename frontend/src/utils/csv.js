// Field limits keep every encrypted item under the server's 20,000-character cap,
// even with multi-byte characters.
const LIMITS = { title: 200, username: 200, password: 1000, url: 500, notes: 2000 };

const ALIASES = {
  title: ["name", "title", "account"],
  url: ["url", "login_uri", "website", "web site", "login_url"],
  username: ["username", "login_username", "user name", "login", "email", "user"],
  password: ["password", "login_password", "pass"],
  notes: ["note", "notes", "extra", "comments"],
};

export const newSkipped = () => ({ nonLogin: 0, noPassword: 0, tooLong: 0, invalid: 0 });

/** Picks the delimiter by counting candidates in the header line, ignoring quoted text. */
function detectDelimiter(text) {
  const counts = { ",": 0, "\t": 0, ";": 0 };
  let inQuotes = false;
  for (const c of text) {
    if (c === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (c === "\n" || c === "\r") break;
      if (c in counts) counts[c]++;
    }
  }
  let best = ",";
  for (const d of ["\t", ";"]) {
    if (counts[d] > counts[best]) best = d;
  }
  return best;
}

/** RFC 4180 CSV parser: quoted fields, escaped quotes, newlines inside quotes, CRLF, BOM.
 *  Accepts comma, tab or semicolon separated files. */
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

function hostOf(url) {
  if (!url) return "";
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Normalises one raw record. Returns { item } or { reason } (noPassword | tooLong | invalid). */
export function cleanItem(raw) {
  if (!raw || typeof raw !== "object") return { reason: "invalid" };
  const str = (v) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

  const url = str(raw.url).trim();
  const username = str(raw.username).trim();
  const password = str(raw.password); // not trimmed: spaces may be part of a password
  const notes = str(raw.notes).trim();
  let title = str(raw.title).trim();

  if (!password) return { reason: "noPassword" };
  if (!title) title = hostOf(url) || "Untitled";

  if (title.length > LIMITS.title || username.length > LIMITS.username ||
      password.length > LIMITS.password || url.length > LIMITS.url || notes.length > LIMITS.notes) {
    return { reason: "tooLong" };
  }
  return { item: { title, username, password, url, notes } };
}

/** Cleans a list of raw records (used for backup files). */
export function cleanList(rawList) {
  const skipped = newSkipped();
  const items = [];
  for (const raw of rawList) {
    const res = cleanItem(raw);
    if (res.item) items.push(res.item);
    else skipped[res.reason]++;
  }
  return { items, skipped };
}

/** Maps parsed CSV rows (Chrome, Bitwarden, 1Password, generic) to vault items. */
export function mapRows(rows) {
  const skipped = newSkipped();
  if (rows.length < 2) return { error: "The file has no data rows.", items: [], skipped };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const find = (names) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const idx = {};
  for (const k of Object.keys(ALIASES)) idx[k] = find(ALIASES[k]);

  if (idx.password < 0) {
    return {
      error: "Couldn't find a password column. Expected a header such as: name, url, username, password.",
      items: [],
      skipped,
    };
  }

  // Bitwarden exports notes, cards and identities too. Only logins are imported.
  const typeIdx = header.includes("login_password") ? header.indexOf("type") : -1;

  const items = [];
  for (const r of rows.slice(1)) {
    if (typeIdx >= 0 && (r[typeIdx] || "").trim().toLowerCase() !== "login") {
      skipped.nonLogin++;
      continue;
    }
    const get = (k) => (idx[k] >= 0 ? r[idx[k]] ?? "" : "");
    const res = cleanItem({
      title: get("title"),
      url: get("url").split(/\r?\n/)[0], // Bitwarden may hold several URIs
      username: get("username"),
      password: get("password"),
      notes: get("notes"),
    });
    if (res.item) items.push(res.item);
    else skipped[res.reason]++;
  }
  return { items, skipped };
}

/** Same title + username + URL (case-insensitive) counts as a duplicate. */
export const itemKey = (i) =>
  [i.title, i.username, i.url].map((s) => (s || "").trim().toLowerCase()).join("\u0000");

// Stops spreadsheets from running a cell as a formula. The password column is left untouched
// so it can be copied back exactly.
const neutralize = (s) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);
const quote = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;

export function toCsv(items) {
  const lines = ["name,url,username,password,note"];
  for (const i of items) {
    lines.push(
      [neutralize(i.title || ""), neutralize(i.url || ""), neutralize(i.username || ""),
       i.password || "", neutralize(i.notes || "")].map(quote).join(",")
    );
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n"; // BOM so Excel reads UTF-8 correctly
}