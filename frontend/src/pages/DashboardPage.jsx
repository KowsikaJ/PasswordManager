import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import Vault from "../components/Vault";
import { getStrength } from "../utils/strength";
import { describe, timeAgo } from "../utils/audit";

export default function DashboardPage({ items, loading, error, reload, encKey, onNavigate }) {
  const [filter, setFilter] = useState(null); // null | "weak" | "reused"
  const [mfaEnabled, setMfaEnabled] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    api.get("/api/mfa/status")
      .then(({ data }) => setMfaEnabled(data.enabled))
      .catch(() => {});
  }, []);

  // Refresh recent activity whenever the vault changes (add/edit/delete creates audit entries)
  useEffect(() => {
    api.get("/api/audit", { params: { page: 0, size: 5 } })
      .then(({ data }) => setRecent(data.items))
      .catch(() => {});
  }, [items]);

  const { weakIds, reusedIds } = useMemo(() => {
    const counts = new Map();
    items.forEach((i) => {
      if (i.password) counts.set(i.password, (counts.get(i.password) || 0) + 1);
    });
    const weak = new Set();
    const reused = new Set();
    items.forEach((i) => {
      if (!i.password) return;
      if (getStrength(i.password).score <= 2) weak.add(i.id);
      if (counts.get(i.password) > 1) reused.add(i.id);
    });
    return { weakIds: weak, reusedIds: reused };
  }, [items]);

  const filterIds = filter === "weak" ? weakIds : filter === "reused" ? reusedIds : null;
  const filterLabel = filter === "weak" ? "weak passwords" : filter === "reused" ? "reused passwords" : null;
  const toggle = (f) => setFilter(filter === f ? null : f);

  return (
    <>
      <header className="topbar">
        <div className="page-title">
          <h2>Dashboard</h2>
          <small>Your vault at a glance</small>
        </div>
      </header>

      <div className="stats">
        <button className={`stat ${filter === null ? "active" : ""}`} onClick={() => setFilter(null)}>
          <span className="label">Total items</span>
          <span className="value">{items.length}</span>
          <span className="sub">Stored and encrypted</span>
        </button>

        <button className={`stat ${filter === "weak" ? "active" : ""}`} onClick={() => toggle("weak")}>
          <span className="label">Weak passwords</span>
          <span className={`value ${weakIds.size ? "bad" : "ok"}`}>{weakIds.size}</span>
          <span className="sub">{weakIds.size ? "Click to review" : "None found"}</span>
        </button>

        <button className={`stat ${filter === "reused" ? "active" : ""}`} onClick={() => toggle("reused")}>
          <span className="label">Reused passwords</span>
          <span className={`value ${reusedIds.size ? "warn" : "ok"}`}>{reusedIds.size}</span>
          <span className="sub">{reusedIds.size ? "Click to review" : "None found"}</span>
        </button>

        <button className="stat" onClick={() => onNavigate("settings")}>
          <span className="label">Two-factor auth</span>
          <span className={`value ${mfaEnabled ? "ok" : "warn"}`}>
            {mfaEnabled === null ? "…" : mfaEnabled ? "On" : "Off"}
          </span>
          <span className="sub">{mfaEnabled ? "Account protected" : "Click to enable"}</span>
        </button>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Recent activity</h3>
          <button className="link" onClick={() => onNavigate("audit")}>View all</button>
        </div>
        {recent.length === 0 ? (
          <p className="muted">No activity yet.</p>
        ) : (
          <div className="activity">
            {recent.map((r) => {
              const a = describe(r.action);
              return (
                <div className="activity-row" key={r.id}>
                  <span className={`dot ${a.tone}`} />
                  <span>{a.label}</span>
                  <span className="when">{timeAgo(r.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {error && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{error}</div>}

      {loading ? (
        <p className="muted">Decrypting your vault…</p>
      ) : (
        <Vault
          items={items}
          encKey={encKey}
          reload={reload}
          filterIds={filterIds}
          filterLabel={filterLabel}
          onClearFilter={() => setFilter(null)}
        />
      )}
    </>
  );
}