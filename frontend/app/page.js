"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import StatCard from "@/components/StatCard";
import { agentStatusSocket, api } from "@/lib/api";

export default function DashboardHome() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [statusLog, setStatusLog] = useState([]);
  const [running, setRunning] = useState({});

  useEffect(() => {
    api
      .getAnalyticsSummary()
      .then(setSummary)
      .catch((err) => setError(err.message));

    const close = agentStatusSocket((msg) => {
      setStatusLog((prev) => [{ ...msg, at: new Date().toLocaleTimeString() }, ...prev].slice(0, 20));
      if (msg.event.endsWith(".finished") || msg.event.endsWith(".error")) {
        const key = msg.event.split(".")[0];
        setRunning((prev) => ({ ...prev, [key]: false }));
      }
    });
    return close;
  }, []);

  async function trigger(key, fn) {
    setRunning((prev) => ({ ...prev, [key]: true }));
    try {
      await fn();
    } catch (err) {
      setError(err.message);
      setRunning((prev) => ({ ...prev, [key]: false }));
    }
  }

  return (
    <DashboardShell
      title="Dashboard"
      actions={
        <div className="dashboard-actions-row">
          <button className="btn-secondary" disabled={running.scraper} onClick={() => trigger("scraper", api.runScraper)}>
            {running.scraper ? "Scraping…" : "Run scraper"}
          </button>
          <button className="btn-secondary" disabled={running.matcher} onClick={() => trigger("matcher", api.runMatcher)}>
            {running.matcher ? "Matching…" : "Run matcher"}
          </button>
        </div>
      }
    >
      {error ? <p className="page-error">{error}</p> : null}

      {summary ? (
        <div className="stat-grid">
          <StatCard label="Jobs discovered" value={summary.total_jobs_discovered} />
          <StatCard label="Applications sent" value={summary.total_applications} sublabel="all time" />
          <StatCard label="Last 30 days" value={summary.applications_last_30_days} sublabel="applications" />
          <StatCard label="Response rate" value={`${summary.response_rate_percent}%`} />
        </div>
      ) : (
        <p className="page-hint">Loading stats…</p>
      )}

      <section className="panel">
        <h2>Agent activity</h2>
        {statusLog.length === 0 ? (
          <p className="page-hint">
            No activity yet. Trigger the scraper or matcher above, or wait for the scheduled run (every 6h).
          </p>
        ) : (
          <ul className="activity-log">
            {statusLog.map((entry, i) => (
              <li key={i}>
                <span className="activity-time">{entry.at}</span>
                <span className="activity-event">{entry.event}</span>
                {entry.detail && Object.keys(entry.detail).length ? (
                  <span className="activity-detail">{JSON.stringify(entry.detail)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardShell>
  );
}
