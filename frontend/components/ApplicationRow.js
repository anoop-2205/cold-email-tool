const STATUS_OPTIONS = ["submitted", "pending", "acknowledged", "interview", "rejected", "offered", "dry_run", "failed"];

export default function ApplicationRow({ application, job, onStatusChange }) {
  return (
    <tr>
      <td>{job?.title || `Job #${application.job_id}`}</td>
      <td>{job?.company || "—"}</td>
      <td>{application.applied_at ? new Date(application.applied_at).toLocaleDateString() : "—"}</td>
      <td>
        <select
          value={application.status}
          onChange={(e) => onStatusChange(application.id, e.target.value)}
          className={`status-select status-${application.status}`}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="app-links">
        {application.tailored_resume_path ? <span title={application.tailored_resume_path}>Resume ✓</span> : "—"}
        {application.cover_letter_path ? <span title={application.cover_letter_path}> · Cover letter ✓</span> : null}
      </td>
    </tr>
  );
}
