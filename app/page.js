'use client';

import { useState, useEffect } from 'react';

const templates = {
  direct: {
    name: 'Direct & concise',
    description: 'Best when applying directly to an advertised opening. Highlights fintech accomplishments.',
    subject: 'Frontend Engineer Application – Anoop Singh (2.5+ yrs, Angular)',
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
    name: 'Referral-friendly',
    description: 'Softer tone for recruiters or engineers, asking about openings or referrals.',
    subject: 'Exploring Frontend Engineer opportunities at [Company Name]',
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
    name: 'Specific role application',
    description: 'Formal application mirroring a specific job title posted on a job board.',
    subject: 'Application for [Role Title] – Anoop Singh',
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
  }
};

export default function Home() {
  const [smtpUser, setSmtpUser] = useState('anoopvns2022@gmail.com');
  const [smtpPass, setSmtpPass] = useState('');
  const [emails, setEmails] = useState('');
  
  // Template States
  const [selectedTemplate, setSelectedTemplate] = useState('direct'); // direct | referral | specific | custom
  const [fields, setFields] = useState({
    companyName: '',
    managerName: '',
    recipientName: '',
    roleTitle: '',
    jobSource: 'LinkedIn',
  });

  // Custom Override States
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  
  // Active Compiled Subject & Message
  const [activeSubject, setActiveSubject] = useState('');
  const [activeMessage, setActiveMessage] = useState('');

  const [resume, setResume] = useState(null);
  const [status, setStatus] = useState([]);
  const [isSending, setIsSending] = useState(false);

  // Compile Subject & Message on template or field changes
  useEffect(() => {
    if (selectedTemplate === 'custom') {
      setActiveSubject(customSubject);
      setActiveMessage(customMessage);
      return;
    }

    const t = templates[selectedTemplate];
    if (!t) return;

    let sub = t.subject;
    let msg = t.message;

    // Fill Placeholders
    if (selectedTemplate === 'direct') {
      msg = msg.replaceAll('[Hiring Manager Name]', fields.managerName || '[Hiring Manager Name]')
               .replaceAll('[Company Name]', fields.companyName || '[Company Name]');
    } else if (selectedTemplate === 'referral') {
      sub = sub.replaceAll('[Company Name]', fields.companyName || '[Company Name]');
      msg = msg.replaceAll('[Recipient Name]', fields.recipientName || '[Recipient Name]')
               .replaceAll('[Company Name]', fields.companyName || '[Company Name]');
    } else if (selectedTemplate === 'specific') {
      sub = sub.replaceAll('[Role Title]', fields.roleTitle || '[Role Title]');
      msg = msg.replaceAll('[Hiring Manager Name]', fields.managerName || '[Hiring Manager Name]')
               .replaceAll('[Role Title]', fields.roleTitle || '[Role Title]')
               .replaceAll('[Company Name]', fields.companyName || '[Company Name]')
               .replaceAll('[LinkedIn / Company Careers Page]', fields.jobSource || '[LinkedIn / Company Careers Page]');
    }

    setActiveSubject(sub);
    setActiveMessage(msg);
  }, [selectedTemplate, fields, customSubject, customMessage]);

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setFields(prev => ({ ...prev, [name]: value }));
  };

  const handleSubjectChange = (e) => {
    setSelectedTemplate('custom');
    setCustomSubject(e.target.value);
  };

  const handleMessageChange = (e) => {
    setSelectedTemplate('custom');
    setCustomMessage(e.target.value);
  };

  const handleFileChange = (e) => {
    setResume(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resume) {
      alert('Please upload your resume first.');
      return;
    }

    const emailList = emails.split(/[\n,]+/).map(e => e.trim()).filter(e => e);
    if (emailList.length === 0) {
      alert('Please enter at least one HR email address.');
      return;
    }

    // Verify dynamic fields are filled for templates
    if (selectedTemplate === 'direct') {
      if (!fields.companyName || !fields.managerName) {
        alert('Please fill all mandatory template fields (Company Name & Hiring Manager Name).');
        return;
      }
    } else if (selectedTemplate === 'referral') {
      if (!fields.companyName || !fields.recipientName) {
        alert('Please fill all mandatory template fields (Company Name & Recipient Name).');
        return;
      }
    } else if (selectedTemplate === 'specific') {
      if (!fields.companyName || !fields.managerName || !fields.roleTitle || !fields.jobSource) {
        alert('Please fill all mandatory template fields.');
        return;
      }
    }

    setIsSending(true);
    setStatus(emailList.map(email => ({ email, state: 'pending' })));

    const body = new FormData();
    body.append('smtpUser', smtpUser);
    body.append('smtpPass', smtpPass);
    body.append('subject', activeSubject);
    body.append('message', activeMessage);
    body.append('emails', emailList.join(','));
    body.append('resume', resume);

    try {
      setStatus(emailList.map(email => ({ email, state: 'sending' })));

      const response = await fetch('/api/send-emails', {
        method: 'POST',
        body: body,
      });

      const data = await response.json();

      if (data.success) {
        const loginError = data.results.find(r => r.message?.includes('535') || r.message?.toLowerCase().includes('invalid login'));
        if (loginError) {
          alert('Login Failed: Your email/password was rejected by Google. \n\nIMPORTANT: You MUST use a "Google App Password", not your regular Gmail password.');
        }
        setStatus(data.results.map(r => ({ email: r.email, state: r.status })));
      } else {
        alert('Failed to send emails: ' + (data.error || 'Unknown error'));
        setStatus(emailList.map(email => ({ email, state: 'error' })));
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert('An error occurred while sending emails.');
      setStatus(emailList.map(email => ({ email, state: 'error' })));
    } finally {
      setIsSending(false);
    }
  };

  const loadCustomTemplate = () => {
    setSelectedTemplate('custom');
    setCustomSubject(activeSubject);
    setCustomMessage(activeMessage);
  };

  return (
    <div className="container">
      <h1>Cold Email Tool</h1>
      <p className="subtitle font-medium">Send personalized job applications to multiple HRs individually.</p>

      <form onSubmit={handleSubmit} className="form-grid">
        {/* Credentials */}
        <div className="input-group">
          <label>Your Gmail Address <span className="required-star">*</span></label>
          <input 
            type="email" 
            value={smtpUser} 
            onChange={(e) => setSmtpUser(e.target.value)} 
            placeholder="e.g. anoopvns2022@gmail.com"
            required 
          />
        </div>

        <div className="input-group">
          <label>Gmail App Password <span className="required-star">*</span></label>
          <input 
            type="password" 
            value={smtpPass} 
            onChange={(e) => setSmtpPass(e.target.value)} 
            placeholder="Enter 16-character App Password"
            required 
          />
          <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '4px' }}>
            Enter your 16-character code: e.g. <code>uvyx pajx uifl etxz</code>
          </small>
        </div>

        {/* Recipients */}
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label>HR Email Addresses <span className="required-star">*</span> <span style={{ textTransform: 'none', fontSize: '0.8rem', color: 'var(--text-muted)' }}>(one per line or comma separated)</span></label>
          <textarea 
            value={emails} 
            onChange={(e) => setEmails(e.target.value)} 
            placeholder="hr1@company.com&#10;hr2@startup.io&#10;recruiter@tech.com"
            required 
          />
        </div>

        {/* Template Segmented Control */}
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label>Select Email Variant</label>
          <div className="variant-tabs">
            <button 
              type="button" 
              className={`variant-tab ${selectedTemplate === 'direct' ? 'active' : ''}`}
              onClick={() => setSelectedTemplate('direct')}
            >
              <span className="tab-badge">A</span> Direct & concise
            </button>
            <button 
              type="button" 
              className={`variant-tab ${selectedTemplate === 'referral' ? 'active' : ''}`}
              onClick={() => setSelectedTemplate('referral')}
            >
              <span className="tab-badge">B</span> Referral-friendly
            </button>
            <button 
              type="button" 
              className={`variant-tab ${selectedTemplate === 'specific' ? 'active' : ''}`}
              onClick={() => setSelectedTemplate('specific')}
            >
              <span className="tab-badge">C</span> Specific role application
            </button>
          </div>
          {selectedTemplate !== 'custom' && (
            <p className="tab-description">{templates[selectedTemplate]?.description}</p>
          )}
        </div>

        {/* Dynamic Mandatory Inputs */}
        {selectedTemplate !== 'custom' && (
          <div className="placeholder-fields-container" style={{ gridColumn: '1 / -1' }}>
            <h3>Fill Mandatory Template Fields</h3>
            <div className="placeholder-grid">
              {/* Company Name (Used in all templates) */}
              <div className="input-group">
                <label>Company Name <span className="required-star">*</span></label>
                <input 
                  type="text" 
                  name="companyName"
                  value={fields.companyName}
                  onChange={handleFieldChange}
                  placeholder="e.g. Google"
                  required
                />
              </div>

              {/* Hiring Manager Name (Direct & Concise / Specific) */}
              {(selectedTemplate === 'direct' || selectedTemplate === 'specific') && (
                <div className="input-group">
                  <label>Hiring Manager Name <span className="required-star">*</span></label>
                  <input 
                    type="text" 
                    name="managerName"
                    value={fields.managerName}
                    onChange={handleFieldChange}
                    placeholder="e.g. Jane Doe"
                    required
                  />
                </div>
              )}

              {/* Recipient Name (Referral-friendly) */}
              {selectedTemplate === 'referral' && (
                <div className="input-group">
                  <label>Recipient Name <span className="required-star">*</span></label>
                  <input 
                    type="text" 
                    name="recipientName"
                    value={fields.recipientName}
                    onChange={handleFieldChange}
                    placeholder="e.g. John Doe"
                    required
                  />
                </div>
              )}

              {/* Role Title (Specific Application) */}
              {selectedTemplate === 'specific' && (
                <div className="input-group">
                  <label>Role Title <span className="required-star">*</span></label>
                  <input 
                    type="text" 
                    name="roleTitle"
                    value={fields.roleTitle}
                    onChange={handleFieldChange}
                    placeholder="e.g. Senior Frontend Engineer"
                    required
                  />
                </div>
              )}

              {/* Job Source (Specific Application) */}
              {selectedTemplate === 'specific' && (
                <div className="input-group">
                  <label>Job Source <span className="required-star">*</span></label>
                  <input 
                    type="text" 
                    name="jobSource"
                    value={fields.jobSource}
                    onChange={handleFieldChange}
                    placeholder="e.g. LinkedIn"
                    required
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Subject Preview */}
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label>Email Subject <span className="required-star">*</span> <span style={{ textTransform: 'none', fontSize: '0.8rem', color: 'var(--text-muted)' }}>(Edit directly to customize)</span></label>
          <input 
            type="text" 
            value={activeSubject} 
            onChange={handleSubjectChange} 
            placeholder="Type your custom email subject..."
            required 
          />
        </div>

        {/* Live Message Preview */}
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label>Message Body <span className="required-star">*</span> <span style={{ textTransform: 'none', fontSize: '0.8rem', color: 'var(--text-muted)' }}>(Edit directly to customize)</span></label>
          <textarea 
            value={activeMessage} 
            onChange={handleMessageChange} 
            style={{ minHeight: '350px' }}
            required 
          />
        </div>

        {/* Attachments */}
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label>Attach Resume <span className="required-star">*</span> <span style={{ textTransform: 'none', fontSize: '0.8rem', color: 'var(--text-muted)' }}>(PDF/DOCX)</span></label>
          <div className="file-upload">
            <input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
            {resume ? (
              <p style={{ color: 'var(--success)' }}>Selected: {resume.name}</p>
            ) : (
              <p>Drag & drop or click to upload your resume</p>
            )}
          </div>
        </div>

        {/* Submit */}
        <button type="submit" className="btn-send" disabled={isSending}>
          {isSending ? (
            <>
              <div className="loader"></div>
              Sending Emails...
            </>
          ) : (
            '🚀 Send Separate Emails to All'
          )}
        </button>
      </form>

      {/* Sending Status */}
      {status.length > 0 && (
        <div className="status-list">
          <h3>Sending Status</h3>
          {status.map((item, index) => (
            <div key={index} className="status-item">
              <span className="status-email">{item.email}</span>
              <span className={`status-badge ${item.state}`}>
                {item.state.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Help Accordion */}
      <details className="help-details">
        <summary className="help-summary">
          <span>💡 Need help setting up Gmail? (App Password Guide)</span>
        </summary>
        <div className="help-content">
          <p style={{ marginBottom: '1rem' }}>
            Google requires a secure <strong>App Password</strong> rather than your standard account password:
          </p>
          <ol style={{ marginLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>Go to <a href="https://myaccount.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>Google Account Settings</a>.</li>
            <li>Enable <strong>2-Step Verification</strong> under Security.</li>
            <li>Search for <strong>"App Passwords"</strong> in the search bar.</li>
            <li>Create a new password named "Cold Email Tool" and copy the 16-character code.</li>
            <li>Paste that code into the <strong>Gmail App Password</strong> field above.</li>
          </ol>
        </div>
      </details>
    </div>
  );
}
