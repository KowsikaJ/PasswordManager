import { useCallback, useEffect, useState } from "react";
import api from "../api/api";
import { ACTIONS, describe, formatTime, timeAgo, shortDevice } from "../utils/audit";

const PAGE_SIZE = 15;

export default function AuditLogsPage() {
  const [data, setData] = useState({ items: [], page: 0, totalPages: 0, totalElements: 0 });
  const [page, setPage] = useState(0);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, size: PAGE_SIZE };
      if (action) params.action = action;
      const res = await api.get("/api/audit", { params });
      setData(res.data);
    } catch {
      setError("Could not load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [page, action]);

  useEffect(() => {
    load();
  }, [load]);

  const changeFilter = (e) => {
    setAction(e.target.value);
    setPage(0);
  };

  return (
    <>
      <header className="topbar">
        <div className="page-title">
          <h2>Audit Logs</h2>
          <small>A read-only record of security events on your account</small>
        </div>
        <button className="btn" onClick={load} disabled={loading}>Refresh</button>
      </header>

      <div className="filters">
        <select value={action} onChange={changeFilter}>
          <option value="">All events</option>
          {Object.entries(ACTIONS).map(([key, a]) => (
            <option key={key} value={key}>{a.label}</option>
          ))}
        </select>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="table-wrap">
        <table className="logs">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Details</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {loading && data.items.length === 0 && (
              <tr><td colSpan="4" className="muted">Loading…</td></tr>
            )}
            {!loading && data.items.length === 0 && (
              <tr><td colSpan="4" className="muted">No events found.</td></tr>
            )}
            {data.items.map((row) => {
              const a = describe(row.action);
              return (
                <tr key={row.id}>
                  <td>
                    <div>{formatTime(row.createdAt)}</div>
                    <div className="muted">{timeAgo(row.createdAt)}</div>
                  </td>
                  <td><span className={`badge ${a.tone}`}>{a.label}</span></td>
                  <td>{row.details || "—"}</td>
                  <td>
                    <div>{row.ip || "—"}</div>
                    <div className="muted">{shortDevice(row.userAgent)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <span>
          {data.totalElements} event{data.totalElements === 1 ? "" : "s"}
          {data.totalPages > 0 && ` · Page ${data.page + 1} of ${data.totalPages}`}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm" disabled={page === 0 || loading}
                  onClick={() => setPage(page - 1)}>Previous</button>
          <button className="btn btn-sm" disabled={page + 1 >= data.totalPages || loading}
                  onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>

      <p className="hint" style={{ textAlign: "left", marginTop: 14 }}>
        Entries can't be edited or deleted from the app, and are removed automatically after 180 days.
      </p>
    </>
  );
}