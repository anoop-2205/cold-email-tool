"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api } from "@/lib/api";

const EMPTY_FORM = { jobId: "", company: "", roleTitle: "", recruiterEmail: "", subject: "", body: "", attachResume: true };

// "Jane Recruiter <jane@company.com>" -> "jane@company.com"
function extractEmailAddress(fromHeader) {
  const match = (fromHeader || "").match(/<([^>]+)>/);
  return match ? match[1] : fromHeader || "";
}

export default function OutreachPage() {
  const [jobs, setJobs] = useState([]);
  const [sent, setSent] = useState([]);
  const [inbound, setInbound] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    try {
      const [jobList, outreachList, inboundList] = await Promise.all([
        api.getJobs(),
        api.getOutreach(),
        api.getInboundOpportunities(),
      ]);
      setJobs(jobList);
      setSent(outreachList);
      setInbound(inboundList);
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
    setForm((prev) => ({
      ...prev,
      jobId: scan.linked_job_id ? String(scan.linked_job_id) : prev.jobId,
      recruiterEmail: extractEmailAddress(scan.from_address),
      company: data.company || prev.company,
      roleTitle: data.job_title || prev.roleTitle,
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
    setSending(true);
    try {
      await api.sendOutreach({
        job_id: form.jobId ? Number(form.jobId) : null,
        recruiter_email: form.recruiterEmail,
        company: form.company,
        role_title: form.roleTitle,
        subject: form.subject,
        body: form.body,
        attach_resume: form.attachResume,
      });
      setSuccess("Email sent.");
      setForm(EMPTY_FORM);
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
          Sends from your own connected Gmail (see Inbox to connect). Draft with AI, review, edit, then send. Looking
          to email several recruiters at once with a canned template instead? Use the <a href="/cold-email">Cold Email</a>{" "}
          page.
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
            <label>
              Recruiter email
              <input
                type="email"
                value={form.recruiterEmail}
                onChange={(e) => updateForm("recruiterEmail", e.target.value)}
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

            <div className="span-2">
              <button className="btn-secondary" type="button" onClick={handleDraft} disabled={drafting}>
                {drafting ? "Drafting…" : "Generate draft with AI"}
              </button>
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
