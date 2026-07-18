"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import StatCard from "@/components/StatCard";
import UserDetailPanel from "@/components/UserDetailPanel";
import { api } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      setUsers(await api.getAdminUsers());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the backend API, not derived state
    load();
  }, []);

  async function handleToggleActive(id) {
    try {
      await api.toggleUserActive(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const stats = useMemo(() => {
    const candidates = users.filter((u) => u.role === "candidate");
    return {
      total: users.length,
      candidates: candidates.length,
      withProfile: candidates.filter((u) => u.has_profile).length,
      totalApplications: users.reduce((sum, u) => sum + u.applications_count, 0),
    };
  }, [users]);

  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (search && !`${u.full_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <DashboardShell title="User activity" variant="admin">
      {error ? <p className="page-error">{error}</p> : null}

      <div className="stat-grid">
        <StatCard label="Total accounts" value={stats.total} />
        <StatCard label="Candidates" value={stats.candidates} />
        <StatCard label="Profiles created" value={stats.withProfile} sublabel={`of ${stats.candidates} candidates`} />
        <StatCard label="Applications sent" value={stats.totalApplications} sublabel="across all users" />
      </div>

      <section className="panel">
        <div className="admin-table-toolbar">
          <input
            className="admin-search"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="admin-role-filter">
            {["all", "candidate", "admin"].map((r) => (
              <button
                key={r}
                className={roleFilter === r ? "tab active" : "tab"}
                onClick={() => setRoleFilter(r)}
                type="button"
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="page-hint">Loading users…</p>
        ) : filtered.length === 0 ? (
          <p className="page-hint">No users match.</p>
        ) : (
          <div className="table-scroll">
          <table className="data-table admin-users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Profile</th>
                <th>Jobs</th>
                <th>Applications</th>
                <th>Joined</th>
                <th>Last login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className={`admin-row${u.is_active ? "" : " admin-row-inactive"}`}
                  onClick={() => setSelectedUserId(u.id)}
                >
                  <td>
                    <div className="admin-user-cell">
                      <span className="admin-user-avatar">{(u.full_name || u.email).slice(0, 2).toUpperCase()}</span>
                      <div>
                        <div className="admin-user-name">{u.full_name || "—"}</div>
                        <div className="admin-user-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`role-badge role-${u.role}`}>{u.role}</span>
                  </td>
                  <td>
                    {u.has_profile ? (
                      <span className="pill pill-success">Created</span>
                    ) : (
                      <span className="pill pill-muted">None</span>
                    )}
                  </td>
                  <td>{u.jobs_count}</td>
                  <td>{u.applications_count}</td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="btn-ghost" onClick={() => handleToggleActive(u.id)} type="button">
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>

      {selectedUserId ? (
        <UserDetailPanel userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      ) : null}
    </DashboardShell>
  );
}
