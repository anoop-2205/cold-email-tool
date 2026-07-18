"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function UserDetailPanel({ userId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .getAdminUserDetail(userId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2>{detail ? detail.full_name || detail.email : "Loading…"}</h2>
          <button className="btn-ghost" onClick={onClose} type="button">
            Close
          </button>
        </div>

        {error ? <p className="page-error">{error}</p> : null}

        {detail ? (
          <div className="drawer-content">
            <div className="drawer-meta">
              <span className={`role-badge role-${detail.role}`}>{detail.role}</span>
              <span className="page-hint">{detail.email}</span>
              <span className="page-hint">Joined {new Date(detail.created_at).toLocaleDateString()}</span>
            </div>

            <div className="stat-grid drawer-stats">
              <div className="stat-card">
                <span className="stat-label">Jobs discovered</span>
                <span className="stat-value">{detail.jobs_count}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Applications</span>
                <span className="stat-value">{detail.applications_count}</span>
              </div>
            </div>

            {detail.profile ? (
              <section className="drawer-section">
                <h3>Profile</h3>
                <p className="page-hint">{detail.profile.summary || "No summary yet."}</p>
                {detail.profile.skills?.length ? (
                  <div className="tag-list">
                    {detail.profile.skills.slice(0, 12).map((s, i) => (
                      <span key={i} className="tag">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : (
              <p className="page-hint">This candidate hasn&apos;t created a profile yet.</p>
            )}

            {detail.recent_jobs.length > 0 ? (
              <section className="drawer-section">
                <h3>Recent jobs</h3>
                <ul className="drawer-list">
                  {detail.recent_jobs.map((j) => (
                    <li key={j.id}>
                      <span>
                        {j.title} · {j.company}
                      </span>
                      <span className={`job-status job-status-${j.status}`}>{j.status}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {detail.recent_applications.length > 0 ? (
              <section className="drawer-section">
                <h3>Recent applications</h3>
                <ul className="drawer-list">
                  {detail.recent_applications.map((a) => (
                    <li key={a.id}>
                      <span>Job #{a.job_id}</span>
                      <span className={`job-status job-status-${a.status}`}>{a.status}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : (
          !error && <p className="page-hint">Loading…</p>
        )}
      </div>
    </div>
  );
}
