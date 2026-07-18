"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api } from "@/lib/api";

// Ported from the original single-page cold-email tool's canned templates.
// Placeholders (e.g. [Company Name]) get filled from the fields below and
// left as-is wherever the candidate hasn't filled that field in yet.
const TEMPLATES = {
  direct: {
    name: "Direct & concise",
    description: "Best when applying directly to an advertised opening. Highlights fintech accomplishments.",
    subject: "Frontend Engineer Application – Anoop Singh (2.5+ yrs, Angular)",
    message: `Hi [Hiring Manager Name],

I came across the **Frontend Engineer** opening at **[Company Name]** and would love to be considered for the role.

I'm currently a **Software Engineer** at **Centricity Wealth Tech**, where I've spent the last 2+ years building responsive financial web applications with **Angular 19**, **TypeScript**, **Node.js**, and **SCSS**. Some highlights from my work:

- Built an end-to-end **Mutual Fund onboarding and transaction flow (SIP, STP, SWP)** integrated with payment gateways and OTP validation
- Led the frontend for the **Partner & Agency Empanelment journey** and integrated the **NSE Invest platform**
- Implemented real-time communication using **SignalR** and worked with **Highcharts**, **PrimeNG**, **DevExtreme**, and **ExcelJS**

I'd be glad to share more about my work and discuss how I can contribute to your team. My resume is attached for your reference.

Resume: [attached]
Portfolio: https://anoop-2205.github.io/Personal_Protfolio_anoop/
GitHub: https://github.com/anoop-2205
LinkedIn: https://www.linkedin.com/in/-anoop-singh/

Thank you for your time.

Best regards,
Anoop Singh
+91 6389641509`,
  },
  referral: {
    name: "Referral-friendly",
    description: "Softer tone for recruiters or engineers, asking about openings or referrals.",
    subject: "Exploring Frontend Engineer opportunities at [Company Name]",
    message: `Hi [Recipient Name],

I hope you're doing well. I'm Anoop, a **Frontend Engineer** with 2.5+ years of experience building production-grade web applications in the fintech space, and I'm reaching out to express my interest in **Frontend Engineer** roles at **[Company Name]**.

At **Centricity Wealth Tech**, I work primarily with **Angular (12 & 19)**, **TypeScript**, and **Node.js**. I've delivered features like complete **Mutual Fund transaction flows (SIP/STP/SWP)**, real-time data modules using **SignalR**, **dynamic PDF generation APIs**, and integrations with platforms like **NSE Invest**.

If there are open roles or a referral path you could point me to, I'd really appreciate it. Happy to share more details or a quick call at your convenience.

Resume: [attached]
Portfolio: https://anoop-2205.github.io/Personal_Protfolio_anoop/

Thanks so much,
Anoop Singh
+91 6389641509`,
  },
  specific: {
    name: "Specific role application",
    description: "Formal application mirroring a specific job title posted on a job board.",
    subject: "Application for [Role Title] – Anoop Singh",
    message: `Hi [Hiring Manager Name],

I'm writing to apply for the **[Role Title]** position at **[Company Name]** that I came across on **[LinkedIn / Company Careers Page]**.

A quick snapshot of my background:

- 2.5+ years as a **Software Engineer** at **Centricity Wealth Tech**, building financial web applications
- Strong hands-on experience with **Angular 19**, **TypeScript**, **Node.js**, **HTML**, **SCSS**, and **Agile workflows**
- Delivered key modules: **Mutual Fund onboarding & transactions**, **Partner Empanelment journey**, **NSE Invest integration**, real-time updates with **SignalR**, and **dynamic PDF generation**
- Comfortable with libraries like **Highcharts**, **PrimeNG**, **DevExtreme**, **ExcelJS**, and **jsPDF**

I believe my experience aligns well with what you're looking for, and I'd love the opportunity to contribute to **[Company Name]**. My resume is attached, and you can find more of my work at the links below.

Resume: [attached]
Portfolio: https://anoop-2205.github.io/Personal_Protfolio_anoop/
GitHub: https://github.com/anoop-2205

Looking forward to hearing from you.

Best regards,
Anoop Singh
+91 6389641509`,
  },
};

// Splits the freeform "one per line or comma-separated" recipients box into a clean, deduped list.
function parseEmailList(raw) {
  const seen = new Set();
  return (raw || "")
    .split(/[,\n;]/)
    .map((e) => e.trim())
    .filter((e) => e && !seen.has(e) && seen.add(e));
}

export default function ColdEmailPage() {
  const [sent, setSent] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sending, setSending] = useState(false);
  const [batchStatus, setBatchStatus] = useState([]);

  const [recruiterEmails, setRecruiterEmails] = useState("");
  const [attachResume, setAttachResume] = useState(true);

  const [selectedTemplate, setSelectedTemplate] = useState("direct"); // direct | referral | specific | custom
  const [fields, setFields] = useState({
    companyName: "",
    managerName: "",
    recipientName: "",
    roleTitle: "",
    jobSource: "LinkedIn",
  });
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  async function load() {
    try {
      setSent(await api.getColdEmails());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the backend API, not derived state
    load();
  }, []);

  // Derived from template + fields on every render -- unless the candidate
  // has started editing the compiled text directly, in which case that edit
  // wins (selectedTemplate flips to "custom").
  function compile() {
    if (selectedTemplate === "custom") {
      return { subject: customSubject, message: customMessage };
    }

    const t = TEMPLATES[selectedTemplate];
    if (!t) return { subject: "", message: "" };

    let subject = t.subject;
    let message = t.message;

    if (selectedTemplate === "direct") {
      message = message
        .replaceAll("[Hiring Manager Name]", fields.managerName || "[Hiring Manager Name]")
        .replaceAll("[Company Name]", fields.companyName || "[Company Name]");
    } else if (selectedTemplate === "referral") {
      subject = subject.replaceAll("[Company Name]", fields.companyName || "[Company Name]");
      message = message
        .replaceAll("[Recipient Name]", fields.recipientName || "[Recipient Name]")
        .replaceAll("[Company Name]", fields.companyName || "[Company Name]");
    } else if (selectedTemplate === "specific") {
      subject = subject.replaceAll("[Role Title]", fields.roleTitle || "[Role Title]");
      message = message
        .replaceAll("[Hiring Manager Name]", fields.managerName || "[Hiring Manager Name]")
        .replaceAll("[Role Title]", fields.roleTitle || "[Role Title]")
        .replaceAll("[Company Name]", fields.companyName || "[Company Name]")
        .replaceAll("[LinkedIn / Company Careers Page]", fields.jobSource || "[LinkedIn / Company Careers Page]");
    }

    return { subject, message };
  }

  const { subject: activeSubject, message: activeMessage } = compile();

  function handleFieldChange(e) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubjectChange(e) {
    setSelectedTemplate("custom");
    setCustomSubject(e.target.value);
  }

  function handleMessageChange(e) {
    setSelectedTemplate("custom");
    setCustomMessage(e.target.value);
  }

  function selectTemplate(id) {
    setSelectedTemplate(id);
  }

  async function handleSend(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBatchStatus([]);

    const recipients = parseEmailList(recruiterEmails);
    if (recipients.length === 0) {
      setError("Enter at least one recruiter email.");
      return;
    }
    if (selectedTemplate === "direct" && !fields.companyName) {
      setError("Fill in Company Name for this template.");
      return;
    }
    if (selectedTemplate === "referral" && (!fields.companyName || !fields.recipientName)) {
      setError("Fill in Company Name and Recipient Name for this template.");
      return;
    }
    if (selectedTemplate === "specific" && (!fields.companyName || !fields.roleTitle)) {
      setError("Fill in Company Name and Role Title for this template.");
      return;
    }

    setSending(true);
    setBatchStatus(recipients.map((email) => ({ email, state: "sending" })));
    try {
      const result = await api.sendColdEmail({
        recruiter_emails: recipients,
        template: selectedTemplate,
        subject: activeSubject,
        body: activeMessage,
        attach_resume: attachResume,
      });
      const statusByEmail = new Map();
      result.sent.forEach((r) => statusByEmail.set(r.recruiter_email, "sent"));
      result.failed.forEach((f) => statusByEmail.set(f.recruiter_email, "failed"));
      setBatchStatus(recipients.map((email) => ({ email, state: statusByEmail.get(email) || "failed" })));

      if (result.failed.length === 0) {
        setSuccess(result.sent.length === 1 ? "Email sent." : `${result.sent.length} emails sent.`);
        setRecruiterEmails("");
      } else {
        setError(
          `Failed for: ${result.failed.map((f) => `${f.recruiter_email} (${f.error})`).join(", ")}` +
            (result.sent.length ? ` — ${result.sent.length} sent successfully.` : "")
        );
        setRecruiterEmails(result.failed.map((f) => f.recruiter_email).join("\n"));
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <DashboardShell title="Cold Email">
      {error ? <p className="page-error">{error}</p> : null}
      {success ? <p className="page-success">{success}</p> : null}

      <section className="panel">
        <h2>Send a custom cold email</h2>
        <p className="page-hint">
          Sends from your own connected Gmail (see Inbox to connect) to any number of recruiters at once — one email
          per address, not CC&apos;d. For a single AI-drafted email tied to a specific job listing, use{" "}
          <a href="/outreach">Outreach</a> instead.
        </p>

        <form onSubmit={handleSend} className="outreach-form">
          <div className="profile-form">
            <label className="span-2">
              Recruiter / HR email(s)
              <textarea
                rows={2}
                placeholder="hr1@company.com&#10;hr2@startup.io&#10;recruiter@tech.com"
                value={recruiterEmails}
                onChange={(e) => setRecruiterEmails(e.target.value)}
                required
              />
            </label>

            <div className="span-2">
              <label>Select email variant</label>
              <div className="variant-tabs">
                {Object.entries(TEMPLATES).map(([id, t]) => (
                  <button
                    key={id}
                    type="button"
                    className={`variant-tab${selectedTemplate === id ? " active" : ""}`}
                    onClick={() => selectTemplate(id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              {selectedTemplate !== "custom" ? (
                <p className="page-hint">{TEMPLATES[selectedTemplate]?.description}</p>
              ) : (
                <p className="page-hint">Editing directly — pick a variant above to reload a template.</p>
              )}
            </div>

            {selectedTemplate !== "custom" ? (
              <>
                <label>
                  Company name
                  <input name="companyName" value={fields.companyName} onChange={handleFieldChange} placeholder="e.g. Google" />
                </label>
                {(selectedTemplate === "direct" || selectedTemplate === "specific") && (
                  <label>
                    Hiring manager name
                    <input name="managerName" value={fields.managerName} onChange={handleFieldChange} placeholder="e.g. Jane Doe" />
                  </label>
                )}
                {selectedTemplate === "referral" && (
                  <label>
                    Recipient name
                    <input name="recipientName" value={fields.recipientName} onChange={handleFieldChange} placeholder="e.g. John Doe" />
                  </label>
                )}
                {selectedTemplate === "specific" && (
                  <label>
                    Role title
                    <input name="roleTitle" value={fields.roleTitle} onChange={handleFieldChange} placeholder="e.g. Senior Frontend Engineer" />
                  </label>
                )}
                {selectedTemplate === "specific" && (
                  <label>
                    Job source
                    <input name="jobSource" value={fields.jobSource} onChange={handleFieldChange} placeholder="e.g. LinkedIn" />
                  </label>
                )}
              </>
            ) : null}

            <label className="span-2">
              Subject <span className="page-hint">(edit directly to customize)</span>
              <input value={activeSubject} onChange={handleSubjectChange} required />
            </label>
            <label className="span-2">
              Body <span className="page-hint">(edit directly to customize — **bold** renders as bold)</span>
              <textarea rows={12} value={activeMessage} onChange={handleMessageChange} required />
            </label>
          </div>

          <label className="checkbox-row">
            <input type="checkbox" checked={attachResume} onChange={(e) => setAttachResume(e.target.checked)} />
            Attach my resume
          </label>

          <button className="btn-primary" type="submit" disabled={sending || !activeSubject || !activeMessage}>
            {sending ? "Sending…" : "Send to all"}
          </button>
        </form>

        {batchStatus.length > 0 ? (
          <div className="status-list">
            <h3>Sending status</h3>
            {batchStatus.map((item) => (
              <div key={item.email} className="status-item">
                <span>{item.email}</span>
                <span className={`badge badge-${item.state === "sent" ? "success" : item.state === "failed" ? "error" : "pending"}`}>
                  {item.state}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Sent history</h2>
        {sent.length === 0 ? (
          <p className="page-hint">No cold emails sent yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>To</th>
                  <th>Template</th>
                  <th>Subject</th>
                  <th>Resume</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {sent.map((o) => (
                  <tr key={o.id}>
                    <td>{o.recruiter_email}</td>
                    <td>{TEMPLATES[o.template]?.name || o.template || "custom"}</td>
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
