import MatchBadge from "@/components/MatchBadge";

export default function JobCard({ job, onApprove, onReject, onApply }) {
  return (
    <div className="job-card">
      <div className="job-card-top">
        <div>
          <h3 className="job-title">{job.title}</h3>
          <p className="job-meta">
            {job.company} · {job.location || "Location N/A"} · <span className="job-source">{job.source}</span>
          </p>
        </div>
        <MatchBadge score={job.match_score} />
      </div>
      {job.match_reasons?.length ? (
        <ul className="job-reasons">
          {job.match_reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      ) : null}
      <div className="job-card-actions">
        <span className={`job-status job-status-${job.status}`}>{job.status}</span>
        <div className="job-card-buttons">
          {job.status === "new" ? (
            <>
              <button onClick={() => onReject(job.id)} className="btn-ghost">
                Reject
              </button>
              <button onClick={() => onApprove(job.id)} className="btn-primary-sm">
                Approve
              </button>
            </>
          ) : null}
          {job.status === "approved" ? (
            <button onClick={() => onApply(job.id)} className="btn-primary-sm">
              Apply now
            </button>
          ) : null}
          {job.source_url ? (
            <a href={job.source_url} target="_blank" rel="noreferrer" className="btn-ghost">
              View listing
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
