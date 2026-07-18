"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import StatCard from "@/components/StatCard";
import { api } from "@/lib/api";

export default function AnalyticsPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getAnalyticsSummary()
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <DashboardShell title="Analytics"><p className="page-error">{error}</p></DashboardShell>;
  if (!summary) return <DashboardShell title="Analytics"><p className="page-hint">Loading…</p></DashboardShell>;

  const perDayEntries = Object.entries(summary.applications_per_day).sort();
  const maxPerDay = Math.max(1, ...perDayEntries.map(([, v]) => v));

  return (
    <DashboardShell title="Analytics">
      <div className="stat-grid">
        <StatCard label="Jobs discovered" value={summary.total_jobs_discovered} />
        <StatCard label="Total applications" value={summary.total_applications} />
        <StatCard label="Last 30 days" value={summary.applications_last_30_days} />
        <StatCard label="Response rate" value={`${summary.response_rate_percent}%`} />
      </div>

      <section className="panel">
        <h2>Applications per day</h2>
        {perDayEntries.length === 0 ? (
          <p className="page-hint">No applications yet.</p>
        ) : (
          <div className="bar-chart">
            {perDayEntries.map(([date, count]) => (
              <div key={date} className="bar-chart-col" title={`${date}: ${count}`}>
                <div className="bar-chart-bar" style={{ height: `${(count / maxPerDay) * 100}%` }} />
                <span className="bar-chart-label">{date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Top companies applied to</h2>
        {summary.top_companies.length === 0 ? (
          <p className="page-hint">No applications yet.</p>
        ) : (
          <ul className="rank-list">
            {summary.top_companies.map(([company, count]) => (
              <li key={company}>
                <span>{company}</span>
                <span className="rank-count">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Status breakdown</h2>
        <div className="tag-list">
          {Object.entries(summary.status_breakdown).map(([status, count]) => (
            <span key={status} className={`tag status-${status}`}>
              {status}: {count}
            </span>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
