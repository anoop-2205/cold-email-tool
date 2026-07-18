"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api } from "@/lib/api";
import { ACCENT_PRESETS, getOnColor, loadSavedAccentColor, setAccentColor } from "@/lib/theme";

const DEFAULT_QUERY = { keywords: "", location: "" };

function AppearancePanel() {
  const [accent, setAccent] = useState(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage on mount, not derived state
    setAccent(loadSavedAccentColor());
  }, []);

  function choose(hex) {
    setAccentColor(hex);
    setAccent(hex);
  }

  return (
    <section className="panel">
      <h2>Appearance</h2>
      <p className="page-hint">
        Pick your own accent color &mdash; used for buttons, links, and highlights everywhere in the app. Text on
        top of it is chosen automatically for readability, whatever color you pick.
      </p>
      <div className="accent-swatch-row">
        {ACCENT_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className={`accent-swatch${accent === preset.value ? " accent-swatch-active" : ""}`}
            style={{ background: preset.value }}
            onClick={() => choose(preset.value)}
            title={preset.name}
            aria-label={preset.name}
          >
            {accent === preset.value ? (
              <span style={{ color: getOnColor(preset.value) }}>✓</span>
            ) : null}
          </button>
        ))}
        <label className="accent-custom-picker" title="Custom color">
          <input type="color" value={accent || "#818cf8"} onChange={(e) => choose(e.target.value)} />
          <span>Custom</span>
        </label>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const [settingsRows, setSettingsRows] = useState([]);
  const [queries, setQueries] = useState([DEFAULT_QUERY]);
  const [thresholds, setThresholds] = useState({ auto_approve_threshold: 80, auto_reject_threshold: 40 });
  const [autoApply, setAutoApply] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [naukriStatus, setNaukriStatus] = useState(null);
  const [naukriForm, setNaukriForm] = useState({ username: "", password: "" });
  const [naukriSaving, setNaukriSaving] = useState(false);
  const [naukriError, setNaukriError] = useState("");

  function loadSettings() {
    api
      .getSettings()
      .then((rows) => {
        setSettingsRows(rows);
        const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        if (byKey.search_queries) setQueries(byKey.search_queries);
        if (byKey.auto_approve_threshold) setThresholds((t) => ({ ...t, auto_approve_threshold: byKey.auto_approve_threshold }));
        if (byKey.auto_reject_threshold) setThresholds((t) => ({ ...t, auto_reject_threshold: byKey.auto_reject_threshold }));
        if (typeof byKey.auto_apply_enabled === "boolean") setAutoApply(byKey.auto_apply_enabled);
      })
      .catch((err) => setError(err.message));
    api.getNaukriStatus().then(setNaukriStatus).catch((err) => setNaukriError(err.message));
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleNaukriSave(e) {
    e.preventDefault();
    setNaukriError("");
    setNaukriSaving(true);
    try {
      const status = await api.setNaukriCredentials(naukriForm.username, naukriForm.password);
      setNaukriStatus(status);
      setNaukriForm({ username: "", password: "" });
    } catch (err) {
      setNaukriError(err.message);
    } finally {
      setNaukriSaving(false);
    }
  }

  async function handleNaukriDisconnect() {
    try {
      const status = await api.clearNaukriCredentials();
      setNaukriStatus(status);
    } catch (err) {
      setNaukriError(err.message);
    }
  }

  function updateQuery(i, field, value) {
    setQueries((prev) => prev.map((q, idx) => (idx === i ? { ...q, [field]: value } : q)));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await Promise.all([
        api.updateSetting("search_queries", queries.filter((q) => q.keywords)),
        api.updateSetting("auto_approve_threshold", thresholds.auto_approve_threshold),
        api.updateSetting("auto_reject_threshold", thresholds.auto_reject_threshold),
        api.updateSetting("auto_apply_enabled", autoApply),
      ]);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell title="Settings">
      {error ? <p className="page-error">{error}</p> : null}

      <AppearancePanel />

      <section className="panel naukri-panel">
        <h2>Naukri account</h2>
        <p className="page-hint">
          Connects your own Naukri login so the scraper searches and applies as you. Naukri has no OAuth, so this
          stores your password encrypted &mdash; never shown again after saving.
        </p>
        {naukriError ? <p className="page-error">{naukriError}</p> : null}

        {naukriStatus === null ? (
          <p className="page-hint">Checking Naukri connection…</p>
        ) : naukriStatus.connected ? (
          <div className="gmail-connect-row">
            <div>
              <p className="gmail-connect-status gmail-connected">Connected</p>
              <p className="page-hint">{naukriStatus.username}</p>
            </div>
            <button className="btn-ghost" onClick={handleNaukriDisconnect} type="button">
              Disconnect
            </button>
          </div>
        ) : (
          <form onSubmit={handleNaukriSave} className="query-row">
            <input
              placeholder="Naukri username / email"
              value={naukriForm.username}
              onChange={(e) => setNaukriForm((f) => ({ ...f, username: e.target.value }))}
              required
            />
            <input
              type="password"
              placeholder="Naukri password"
              value={naukriForm.password}
              onChange={(e) => setNaukriForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
            <button className="btn-primary-sm" type="submit" disabled={naukriSaving}>
              {naukriSaving ? "Saving…" : "Connect"}
            </button>
          </form>
        )}
      </section>

      <section className="panel">
        <h2>Search queries</h2>
        <p className="page-hint">Used by the Naukri scraper once your Naukri account above is connected.</p>
        {queries.map((q, i) => (
          <div key={i} className="query-row">
            <input
              placeholder="Keywords (e.g. software engineer)"
              value={q.keywords}
              onChange={(e) => updateQuery(i, "keywords", e.target.value)}
            />
            <input
              placeholder="Location (e.g. bangalore)"
              value={q.location}
              onChange={(e) => updateQuery(i, "location", e.target.value)}
            />
          </div>
        ))}
        <button className="btn-ghost" onClick={() => setQueries((prev) => [...prev, DEFAULT_QUERY])}>
          + Add another query
        </button>
      </section>

      <section className="panel">
        <h2>Matching thresholds</h2>
        <div className="profile-form">
          <label>
            Auto-approve above
            <input
              type="number"
              value={thresholds.auto_approve_threshold}
              onChange={(e) => setThresholds((t) => ({ ...t, auto_approve_threshold: Number(e.target.value) }))}
            />
          </label>
          <label>
            Auto-reject below
            <input
              type="number"
              value={thresholds.auto_reject_threshold}
              onChange={(e) => setThresholds((t) => ({ ...t, auto_reject_threshold: Number(e.target.value) }))}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>Auto-apply</h2>
        <label className="checkbox-row">
          <input type="checkbox" checked={autoApply} onChange={(e) => setAutoApply(e.target.checked)} />
          Automatically apply to jobs scoring above the auto-approve threshold (default off — human-in-the-loop).
        </label>
      </section>

      <button className="btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </button>
      {saved ? <span className="save-confirm">Saved.</span> : null}
    </DashboardShell>
  );
}
