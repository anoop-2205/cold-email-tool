const CLASSIFICATION_LABELS = {
  JOB_ALERT: "Job alert",
  ACKNOWLEDGMENT: "Acknowledgment",
  REJECTION: "Rejection",
  INTERVIEW_INVITE: "Interview invite",
  ASSESSMENT: "Assessment",
  OFFER: "Offer",
  RECRUITER_OUTREACH: "Recruiter outreach",
  IRRELEVANT: "Irrelevant",
};

export default function EmailAlert({ scan }) {
  const data = scan.extracted_data || {};
  return (
    <div className={`email-alert email-${scan.classification.toLowerCase()}`}>
      <div className="email-alert-top">
        <span className="email-alert-badge">{CLASSIFICATION_LABELS[scan.classification] || scan.classification}</span>
        <span className="email-alert-from">{scan.from_address}</span>
      </div>
      <p className="email-alert-subject">{scan.subject}</p>
      {(data.job_title || data.company) && (
        <p className="email-alert-meta">
          {data.job_title} {data.company ? `· ${data.company}` : ""}
        </p>
      )}
      {data.link ? (
        <a href={data.link} target="_blank" rel="noreferrer" className="email-alert-link">
          Open link
        </a>
      ) : null}
    </div>
  );
}
