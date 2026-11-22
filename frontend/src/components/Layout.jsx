const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "audit", label: "Audit Logs" },
  { id: "settings", label: "Settings" },
];

export default function Layout({ page, onNavigate, email, onLock, children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo">SV</div>
          <div>
            <strong>SecureVault</strong>
            <small>Password manager</small>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? "active" : ""}`}
              onClick={() => onNavigate(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip" title={email}>{email}</div>
          <button className="btn" onClick={onLock}>Lock vault</button>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}