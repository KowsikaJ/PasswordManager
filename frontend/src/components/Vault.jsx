import { useMemo, useState } from "react";
import api from "../api/api";
import { encryptJson, generatePassword } from "../crypto/crypto";
import { getStrength } from "../utils/strength";
import { useConfirm } from "./ConfirmDialog";

const EMPTY = { title: "", username: "", password: "", url: "", notes: "" };

export default function Vault({ items, encKey, reload, filterIds, filterLabel, onClearFilter }) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [visible, setVisible] = useState({});
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [confirm, confirmDialog] = useConfirm();

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1600);
  };

  const filtered = useMemo(() => {
    let list = items;
    if (filterIds) list = list.filter((i) => filterIds.has(i.id));
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((i) =>
      [i.title, i.username, i.url].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [items, search, filterIds]);

  const openAdd = () => {
    setForm(EMPTY);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    const { id, ...fields } = item;
    setForm(fields);
    setEditingId(id);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(EMPTY);
    setEditingId(null);
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const payload = await encryptJson(form, encKey);
      if (editingId) await api.put(`/api/vault/${editingId}`, payload);
      else await api.post("/api/vault", payload);
      const wasEditing = !!editingId;
      closeModal();
      await reload();
      showToast(wasEditing ? "Item updated" : "Item added");
    } catch {
      setError("Failed to save item");
    }
  };

  const remove = async (item) => {
    const ok = await confirm({
      title: "Delete this item?",
      message: `"${item.title}" will be permanently deleted. This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setError("");
    try {
      await api.delete(`/api/vault/${item.id}`);
      await reload();
      showToast("Item deleted");
    } catch {
      setError("Failed to delete item");
    }
  };

  const copy = async (text) => {
    await navigator.clipboard.writeText(text);
    showToast("Copied. Clipboard clears in 20s");
    setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 20000);
  };

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const strength = getStrength(form.password);

  return (
    <>
      {error && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="toolbar">
        <input placeholder="Search by title, username or URL..." value={search}
               onChange={(e) => setSearch(e.target.value)} />
        <button className="btn btn-primary" onClick={openAdd}>Add item</button>
      </div>

      {filterLabel && (
        <div className="chip">
          Showing {filterLabel}{" "}
          <button className="link" onClick={onClearFilter}>Clear filter</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty">
          <p>{items.length === 0 ? "Your vault is empty. Add your first password." : "No matches found."}</p>
        </div>
      ) : (
        <div className="grid">
          {filtered.map((item) => (
            <div className="item" key={item.id}>
              <div className="item-head">
                <div className="avatar">{(item.title || "?")[0].toUpperCase()}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="item-title">{item.title}</div>
                  <div className="item-sub">{item.username || item.url || "—"}</div>
                </div>
              </div>

              <div className="pw-line">
                <span>{visible[item.id] ? item.password : "••••••••••••"}</span>
                <div className="actions">
                  <button className="btn btn-sm"
                          onClick={() => setVisible({ ...visible, [item.id]: !visible[item.id] })}>
                    {visible[item.id] ? "Hide" : "Show"}
                  </button>
                  <button className="btn btn-sm" onClick={() => copy(item.password)}>Copy</button>
                </div>
              </div>

              {item.notes && <div className="item-sub">{item.notes}</div>}

              <div className="actions item-actions">
                {item.username && (
                  <button className="btn btn-sm" onClick={() => copy(item.username)}>Copy user</button>
                )}
                <button className="btn btn-sm" onClick={() => openEdit(item)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => remove(item)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="backdrop" onClick={closeModal}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h3>{editingId ? "Edit item" : "Add new item"}</h3>

            <label>Title
              <input value={form.title} onChange={change("title")} placeholder="e.g. Gmail" required autoFocus />
            </label>
            <label>Username / Email
              <input value={form.username} onChange={change("username")} />
            </label>
            <label>Password
              <div className="row">
                <input className="grow" value={form.password} onChange={change("password")} required />
                <button type="button" className="btn"
                        onClick={() => setForm({ ...form, password: generatePassword() })}>
                  Generate
                </button>
              </div>
            </label>

            {form.password && (
              <div>
                <div className="strength-bar">
                  <div style={{ width: `${strength.percent}%`, background: strength.color }} />
                </div>
                <span className="strength-label">Strength: {strength.label}</span>
              </div>
            )}

            <label>URL
              <input value={form.url} onChange={change("url")} placeholder="https://" />
            </label>
            <label>Notes
              <textarea value={form.notes} onChange={change("notes")} />
            </label>

            <div className="modal-actions">
              <button type="button" className="btn" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary">{editingId ? "Update" : "Save"}</button>
            </div>
          </form>
        </div>
      )}

      {confirmDialog}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}