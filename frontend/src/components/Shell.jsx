import { useCallback, useEffect, useState } from "react";
import api from "../api/api";
import { decryptJson } from "../crypto/crypto";
import Layout from "./Layout";
import DashboardPage from "../pages/DashboardPage";
import AuditLogsPage from "../pages/AuditLogsPage";
import SettingsPage from "../pages/SettingsPage";

export default function Shell({
  encKey, email, onLock, autoLockMinutes, onAutoLockChange,
  theme, onThemeChange, onPasswordChanged,
}) {
  const [page, setPage] = useState("dashboard");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await api.get("/api/vault");
    const decrypted = await Promise.all(
      data.map(async (i) => ({ id: i.id, ...(await decryptJson(i, encKey)) }))
    );
    setItems(decrypted);
  }, [encKey]);

  useEffect(() => {
    load()
      .catch(() => setError("Failed to load vault"))
      .finally(() => setLoading(false));
  }, [load]);

  return (
    <Layout page={page} onNavigate={setPage} email={email} onLock={onLock}>
      {page === "dashboard" && (
        <DashboardPage
          items={items}
          loading={loading}
          error={error}
          reload={load}
          encKey={encKey}
          onNavigate={setPage}
        />
      )}
      {page === "audit" && <AuditLogsPage />}
      {page === "settings" && (
        <SettingsPage
          email={email}
          items={items}
          encKey={encKey}
          reload={load}
          autoLockMinutes={autoLockMinutes}
          onAutoLockChange={onAutoLockChange}
          onLock={onLock}
          theme={theme}
          onThemeChange={onThemeChange}
          onPasswordChanged={onPasswordChanged}
        />
      )}
    </Layout>
  );
}