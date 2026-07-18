"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import JobCard from "@/components/JobCard";
import { api } from "@/lib/api";

const STATUS_FILTERS = ["all", "new", "approved", "rejected", "applied", "interviewing", "offered"];

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (minScore) params.min_score = minScore;
      setJobs(await api.getJobs(params));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the backend API, not derived state
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, minScore]);

  async function handleApprove(id) {
    await api.approveJob(id);
    load();
  }
  async function handleReject(id) {
    await api.rejectJob(id);
    load();
  }
  async function handleApply(id) {
    try {
      await api.applyToJob(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <DashboardShell
      title="Job feed"
      actions={
        <div className="jobs-filters">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="Min score"
            value={minScore || ""}
            onChange={(e) => setMinScore(Number(e.target.value) || 0)}
          />
        </div>
      }
    >
      {error ? <p className="page-error">{error}</p> : null}
      {loading ? (
        <p className="page-hint">Loading jobs…</p>
      ) : jobs.length === 0 ? (
        <p className="page-hint">
          No jobs yet. Trigger the scraper from the Dashboard, or add jobs manually via the API once Naukri
          credentials are configured.
        </p>
      ) : (
        <div className="job-list">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onApprove={handleApprove} onReject={handleReject} onApply={handleApply} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
