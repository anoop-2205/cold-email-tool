"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import ApplicationRow from "@/components/ApplicationRow";
import { api } from "@/lib/api";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [jobsById, setJobsById] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getApplications(), api.getJobs()])
      .then(([apps, jobs]) => {
        setApplications(apps);
        setJobsById(Object.fromEntries(jobs.map((j) => [j.id, j])));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleStatusChange(id, status) {
    try {
      const updated = await api.updateApplication(id, { status });
      setApplications((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <DashboardShell title="Application tracker">
      {error ? <p className="page-error">{error}</p> : null}
      {loading ? (
        <p className="page-hint">Loading applications…</p>
      ) : applications.length === 0 ? (
        <p className="page-hint">No applications yet. Approve a job and click Apply on the Jobs page.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Company</th>
                <th>Applied</th>
                <th>Status</th>
                <th>Files</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <ApplicationRow
                  key={app.id}
                  application={app}
                  job={jobsById[app.job_id]}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
