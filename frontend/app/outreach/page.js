"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api } from "@/lib/api";

const EMPTY_FORM = { jobId: "", company: "", roleTitle: "", recruiterEmails: "", subject: "", body: "", attachResume: true };

// "Jane Recruiter <jane@company.com>" -> "jane@company.com"
function extractEmailAddress(fromHeader) {
  const match = (fromHeader || "").match(/<([^>]+)>/);
  return match ? match[1] : fromHeader || "";
}

// Splits the freeform "one per line or comma-separated" recipients box into a clean, deduped list.
function parseEmailList(raw) {
  const seen = new Set();
  return (raw || "")
    .split(/[,\n;]/)
    .map((e) => e.trim())
    .filter((e) => e && !seen.has(e) && seen.add(e));
}

// Canned starting points for outreach that isn't tied to a job listing (referrals, cold intros).
// {name}/{company}/{role} get filled in from the current form + candidate profile before use.
const TEMPLATES = [
  {
    id: "referral",
    label: "Referral request",
    subject: "Quick referral request — {role} at {company}",
    body: `Hi,

I'm interested in the {role} role at {company}, and thought you'd be a great person to ask given your position there.

Would you be open to referring me, or pointing me to the right person? Happy to share my resume and background.

Thanks so much,
{name}`,
  },
  {
    id: "cold_intro",
    label: "Cold introduction",
    subject: "Interested in opportunities at {company}",
    body: `Hi,

I'm {name}. I've been following {company}'s work and wanted to reach out directly in case there's a fit for a {role} role, or anything similar on your team.

I've attached my resume — would love to connect if there's a good fit.

Best,
{name}`,
  },
  {
    id: "follow_up",
    label: "Follow-up (no response)",
    subject: "Following up — {role} at {company}",
    body: `Hi,

Just wanted to follow up on my note about the {role} role at {company} in case it got buried. Still very interested — happy to share more or jump on a quick call whenever works.

Thanks,
{name}`,
  },
];

function fillTemplate(text, { name, company, role }) {
  return text
    .replaceAll("{name}", name || "there")
    .replaceAll("{company}", company || "your company")
    .replaceAll("{role}", role || "the role");
}

export default function OutreachPage() {
  const [jobs, setJobs] = useState([]);
  const [sent, setSent] = useState([]);
  const [inbound, setInbound] = useState([]);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    try {
      const [jobList, outreachList, inboundList, profileData] = await Promise.all([
        api.getJobs(),
        api.getOutreach(),
        api.getInboundOpportunities(),
        api.getProfile(),
      ]);
      setJobs(jobList);
      setSent(outreachList);
      setInbound(inboundList);
      setProfile(profileData);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the backend API, not derived state
    load();
  }, []);

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleJobSelect(jobId) {
    const job = jobs.find((j) => String(j.id) === jobId);
    setForm((prev) => ({
      ...prev,
      jobId,
      company: job ? job.company : prev.company,
      roleTitle: job ? job.title : prev.roleTitle,
    }));
  }

  function handleInboundSelect(scanId) {
    const scan = inbound.find((s) => String(s.id) === scanId);
    if (!scan) return;
    const data = scan.extracted_data || {};
    const email = extractEmailAddress(scan.from_address);
    setForm((prev) => {
      const existing = parseEmailList(prev.recruiterEmails);
      const recruiterEmails = existing.includes(email) ? existing : [...existing, email];
      return {
        ...prev,
        jobId: scan.linked_job_id ? String(scan.linked_job_id) : prev.jobId,
        recruiterEmails: recruiterEmails.join("\n"),
        company: data.company || prev.company,
        roleTitle: data.job_title || prev.roleTitle,
      };
    });
  }

  function handleTemplateSelect(templateId) {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const vars = { name: profile?.full_name?.split(" ")[0], company: form.company, role: form.roleTitle };
    setForm((prev) => ({
      ...prev,
      subject: fillTemplate(template.subject, vars),
      body: fillTemplate(template.body, vars),
    }));
  }

  async function handleDraft() {
    if (!form.company) {
      setError("Pick a job or enter a company name first.");
      return;
    }
    setError("");
    setDrafting(true);
    try {
      const draft = await api.draftOutreach({
        job_id: form.jobId ? Number(form.jobId) : null,
        company: form.company,
        role_title: form.roleTitle,
      });
      setForm((prev) => ({ ...prev, subject: draft.subject, body: draft.body }));
    } catch (err) {
      setError(err.message);
    } finally {
      setDrafting(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const recipients = parseEmailList(form.recruiterEmails);
    if (recipients.length === 0) {
      setError("Enter at least one recruiter email.");
      return;
    }
    setSending(true);
    try {
      const result = await api.sendOutreach({
        job_id: form.jobId ? Number(form.jobId) : null,
        recruiter_emails: recipients,
        company: form.company,
        role_title: form.roleTitle,
        subject: form.subject,
        body: form.body,
        attach_resume: form.attachResume,
      });
      const sentCount = result.sent.length;
      const failedCount = result.failed.length;
      if (failedCount === 0) {
        setSuccess(sentCount === 1 ? "Email sent." : `${sentCount} emails sent.`);
        setForm(EMPTY_FORM);
      } else {
        setError(
          `Failed for: ${result.failed.map((f) => `${f.recruiter_email} (${f.error})`).join(", ")}` +
            (sentCount ? ` — ${sentCount} sent successfully.` : "")
        );
        // Leave the failed addresses in the box so the candidate can retry without re-typing everything.
        setForm((prev) => ({ ...prev, recruiterEmails: result.failed.map((f) => f.recruiter_email).join("\n") }));
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <DashboardShell title="Outreach">
      {error ? <p className="page-error">{error}</p> : null}
      {success ? <p className="page-success">{success}</p> : null}

      <section className="panel">
        <h2>Send a cold email</h2>
        <p className="page-hint">
          Sends from your own connected Gmail (see Inbox to connect). Draft with AI, review, edit, then send.
        </p>

        <form onSubmit={handleSend} className="outreach-form">
          <div className="profile-form">
            <label>
              From a job in your feed (optional)
              <select value={form.jobId} onChange={(e) => handleJobSelect(e.target.value)}>
                <option value="">— Freeform —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} · {j.company}
                  </option>
                ))}
              </select>
            </label>
            {inbound.length > 0 ? (
              <label>
                From an inbound recruiter email (optional)
                <select defaultValue="" onChange={(e) => handleInboundSelect(e.target.value)}>
                  <option value="">— Pick from Inbox —</option>
                  {inbound.map((s) => (
                    <option key={s.id} value={s.id}>
                      {extractEmailAddress(s.from_address)} · {s.subject}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="span-2">
              Recruiter email(s)
              <textarea
                rows={2}
                placeholder="One per line or comma-separated — sent individually, not CC'd"
                value={form.recruiterEmails}
                onChange={(e) => updateForm("recruiterEmails", e.target.value)}
                required
              />
            </label>
            <label>
              Company
              <input value={form.company} onChange={(e) => updateForm("company", e.target.value)} required />
            </label>
            <label>
              Role
              <input value={form.roleTitle} onChange={(e) => updateForm("roleTitle", e.target.value)} />
            </label>

            <div className="span-2 outreach-draft-row">
              <button className="btn-secondary" type="button" onClick={handleDraft} disabled={drafting}>
                {drafting ? "Drafting…" : "Generate draft with AI"}
              </button>
              <select defaultValue="" onChange={(e) => e.target.value && handleTemplateSelect(e.target.value)}>
                <option value="">— Or use a template —</option>
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="span-2">
              Subject
              <input value={form.subject} onChange={(e) => updateForm("subject", e.target.value)} required />
            </label>
            <label className="span-2">
              Body
              <textarea rows={8} value={form.body} onChange={(e) => updateForm("body", e.target.value)} required />
            </label>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.attachResume}
              onChange={(e) => updateForm("attachResume", e.target.checked)}
            />
            Attach my resume
          </label>

          <button className="btn-primary" type="submit" disabled={sending || !form.subject || !form.body}>
            {sending ? "Sending…" : "Send email"}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Sent history</h2>
        {sent.length === 0 ? (
          <p className="page-hint">No outreach emails sent yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>To</th>
                  <th>Company / Role</th>
                  <th>Subject</th>
                  <th>Resume</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {sent.map((o) => (
                  <tr key={o.id}>
                    <td>{o.recruiter_email}</td>
                    <td>
                      {o.company} {o.role_title ? `· ${o.role_title}` : ""}
                    </td>
                    <td>{o.subject}</td>
                    <td>{o.resume_attached ? "✓" : "—"}</td>
                    <td>{new Date(o.sent_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
