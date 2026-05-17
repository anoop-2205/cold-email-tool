'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { initUsers, getCurrentUser, clearSession, saveResumeData } from './lib/auth';

const SunIcon = () => (
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
);

export default function Home() {
  const router = useRouter();

  // ── Auth ────────────────────────────────────────────────────────────────────
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // ── Credentials ─────────────────────────────────────────────────────────────
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [emails, setEmails]     = useState('');

  // ── Templates ───────────────────────────────────────────────────────────────
  const [templates, setTemplates]           = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState('direct');
  const [fields, setFields] = useState({
    companyName: '', managerName: '', recipientName: '', roleTitle: '', jobSource: 'LinkedIn',
  });

  // ── Custom override ──────────────────────────────────────────────────────────
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  // ── Compiled output ──────────────────────────────────────────────────────────
  const [activeSubject, setActiveSubject] = useState('');
  const [activeMessage, setActiveMessage] = useState('');

  // ── Misc ─────────────────────────────────────────────────────────────────────
  const [resume, setResume]     = useState(null);
  const [status, setStatus]     = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [theme, setTheme]       = useState('light');

  // ── On mount: auth check + hydrate state from user profile ──────────────────
  useEffect(() => {
    initUsers();
    const user = getCurrentUser();
    if (!user || !user.profileComplete) {
      router.push('/login');
      return;
    }

    setCurrentUser(user);
    setTemplates(user.templates || {});
    setSmtpUser(user.profile?.smtpUser || '');

    // Theme
    const saved = localStorage.getItem('theme');
    const pref  = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(pref);
    document.documentElement.setAttribute('data-theme', pref);

    // Restore saved resume (stored as base64)
    if (user.resumeData) {
      try {
        const arr  = user.resumeData.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        const u8   = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
        setResume(new File([u8], user.resumeName, { type: mime }));
      } catch {}
    }

    setAuthLoading(false);
  }, [router]);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }, [theme]);

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  // ── Compile subject + message whenever template/fields change ────────────────
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

    if (selectedTemplate === 'direct') {
      msg = msg.replaceAll('[Hiring Manager Name]', fields.managerName  || '[Hiring Manager Name]')
               .replaceAll('[Company Name]',         fields.companyName  || '[Company Name]');
    } else if (selectedTemplate === 'referral') {
      sub = sub.replaceAll('[Company Name]',  fields.companyName   || '[Company Name]');
      msg = msg.replaceAll('[Recipient Name]', fields.recipientName || '[Recipient Name]')
               .replaceAll('[Company Name]',  fields.companyName   || '[Company Name]');
    } else if (selectedTemplate === 'specific') {
      sub = sub.replaceAll('[Role Title]', fields.roleTitle || '[Role Title]');
      msg = msg.replaceAll('[Hiring Manager Name]',           fields.managerName  || '[Hiring Manager Name]')
               .replaceAll('[Role Title]',                    fields.roleTitle    || '[Role Title]')
               .replaceAll('[Company Name]',                  fields.companyName  || '[Company Name]')
               .replaceAll('[LinkedIn / Company Careers Page]', fields.jobSource  || '[LinkedIn / Company Careers Page]');
    }

    setActiveSubject(sub);
    setActiveMessage(msg);
  }, [selectedTemplate, fields, customSubject, customMessage, templates]);

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
    const file = e.target.files[0];
    if (!file) return;
    setResume(file);
    // Persist resume to user's profile (base64, max ~5 MB raw)
    const reader = new FileReader();
    reader.onload = () => {
      saveResumeData(currentUser.username, file.name, reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resume) { alert('Please upload your resume first.'); return; }

    const emailList = emails.split(/[\n,]+/).map(e => e.trim()).filter(Boolean);
    if (emailList.length === 0) { alert('Please enter at least one HR email address.'); return; }

    if (selectedTemplate === 'direct' && (!fields.companyName || !fields.managerName)) {
      alert('Please fill all mandatory template fields (Company Name & Hiring Manager Name).');
      return;
    }
    if (selectedTemplate === 'referral' && (!fields.companyName || !fields.recipientName)) {
      alert('Please fill all mandatory template fields (Company Name & Recipient Name).');
      return;
    }
    if (selectedTemplate === 'specific' && (!fields.companyName || !fields.managerName || !fields.roleTitle || !fields.jobSource)) {
      alert('Please fill all mandatory template fields.');
      return;
    }

    setIsSending(true);
    setStatus(emailList.map(email => ({ email, state: 'pending' })));

    const body = new FormData();
    body.append('smtpUser', smtpUser);
    body.append('smtpPass', smtpPass);
    body.append('subject',  activeSubject);
    body.append('message',  activeMessage);
    body.append('emails',   emailList.join(','));
    body.append('resume',   resume);

    try {
      setStatus(emailList.map(email => ({ email, state: 'sending' })));
      const response = await fetch('/api/send-emails', { method: 'POST', body });
      const data = await response.json();

      if (data.success) {
        const loginError = data.results.find(r =>
          r.message?.includes('535') || r.message?.toLowerCase().includes('invalid login'));
        if (loginError) {
          alert('Login Failed: Your email/password was rejected by Google.\n\nIMPORTANT: You MUST use a "Google App Password", not your regular Gmail password.');
        }
        setStatus(data.results.map(r => ({ email: r.email, state: r.status })));
      } else {
        alert('Failed to send emails: ' + (data.error || 'Unknown error'));
        setStatus(emailList.map(email => ({ email, state: 'error' })));
      }
    } catch (err) {
      console.error('Submission error:', err);
      alert('An error occurred while sending emails.');
      setStatus(emailList.map(email => ({ email, state: 'error' })));
    } finally {
      setIsSending(false);
    }
  };

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="auth-loading">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div className="container">

      {/* ── Header ── */}
      <div className="page-header">
        <div className="header-text">
          <h1>Cold Email Tool</h1>
          <p className="subtitle">Send personalized job applications to multiple HRs individually.</p>
        </div>
        <div className="header-actions">
          <span className="user-badge">@{currentUser?.username}</span>
          <button className="btn-logout" type="button" onClick={handleLogout}>Sign Out</button>
          <button className="theme-toggle" type="button" onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-grid">

        {/* ── Credentials ── */}
        <div className="input-group">
          <label>Your Gmail Address <span className="required-star">*</span></label>
          <input type="email" value={smtpUser} onChange={e => setSmtpUser(e.target.value)}
            placeholder="e.g. you@gmail.com" required />
        </div>

        <div className="input-group">
          <label>Gmail App Password <span className="required-star">*</span></label>
          <input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)}
            placeholder="Enter 16-character App Password" required />
          <small>Enter your 16-character code: e.g. <code>uvyx pajx uifl etxz</code></small>
        </div>

        {/* ── Recipients ── */}
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label>
            HR Email Addresses <span className="required-star">*</span>{' '}
            <span style={{ textTransform: 'none', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              (one per line or comma separated)
            </span>
          </label>
          <textarea value={emails} onChange={e => setEmails(e.target.value)}
            placeholder={'hr1@company.com\nhr2@startup.io\nrecruiter@tech.com'} required />
        </div>

        {/* ── Variant tabs ── */}
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label>Select Email Variant</label>
          <div className="variant-tabs">
            {['direct', 'referral', 'specific'].map((key, i) => (
              <button key={key} type="button"
                className={`variant-tab ${selectedTemplate === key ? 'active' : ''}`}
                onClick={() => setSelectedTemplate(key)}>
                <span className="tab-badge">{String.fromCharCode(65 + i)}</span>
                {templates[key]?.name || key}
              </button>
            ))}
          </div>
          {selectedTemplate !== 'custom' && (
            <p className="tab-description">{templates[selectedTemplate]?.description}</p>
          )}
        </div>

        {/* ── Mandatory placeholder fields ── */}
        {selectedTemplate !== 'custom' && (
          <div className="placeholder-fields-container" style={{ gridColumn: '1 / -1' }}>
            <h3>Fill Mandatory Template Fields</h3>
            <div className="placeholder-grid">
              <div className="input-group">
                <label>Company Name <span className="required-star">*</span></label>
                <input type="text" name="companyName" value={fields.companyName}
                  onChange={handleFieldChange} placeholder="e.g. Google" required />
              </div>

              {(selectedTemplate === 'direct' || selectedTemplate === 'specific') && (
                <div className="input-group">
                  <label>Hiring Manager Name <span className="required-star">*</span></label>
                  <input type="text" name="managerName" value={fields.managerName}
                    onChange={handleFieldChange} placeholder="e.g. Jane Doe" required />
                </div>
              )}

              {selectedTemplate === 'referral' && (
                <div className="input-group">
                  <label>Recipient Name <span className="required-star">*</span></label>
                  <input type="text" name="recipientName" value={fields.recipientName}
                    onChange={handleFieldChange} placeholder="e.g. John Doe" required />
                </div>
              )}

              {selectedTemplate === 'specific' && (
                <>
                  <div className="input-group">
                    <label>Role Title <span className="required-star">*</span></label>
                    <input type="text" name="roleTitle" value={fields.roleTitle}
                      onChange={handleFieldChange} placeholder="e.g. Senior Frontend Engineer" required />
                  </div>
                  <div className="input-group">
                    <label>Job Source <span className="required-star">*</span></label>
                    <input type="text" name="jobSource" value={fields.jobSource}
                      onChange={handleFieldChange} placeholder="e.g. LinkedIn" required />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Subject ── */}
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label>
            Email Subject <span className="required-star">*</span>{' '}
            <span style={{ textTransform: 'none', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              (Edit directly to customize)
            </span>
          </label>
          <input type="text" value={activeSubject} onChange={handleSubjectChange}
            placeholder="Type your custom email subject..." required />
        </div>

        {/* ── Message body ── */}
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label>
            Message Body <span className="required-star">*</span>{' '}
            <span style={{ textTransform: 'none', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              (Edit directly to customize)
            </span>
          </label>
          <textarea value={activeMessage} onChange={handleMessageChange}
            style={{ minHeight: '350px' }} required />
        </div>

        {/* ── Resume ── */}
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label>
            Attach Resume <span className="required-star">*</span>{' '}
            <span style={{ textTransform: 'none', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              (PDF/DOCX — auto-saved per account)
            </span>
          </label>
          <div className="file-upload">
            <input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
            {resume
              ? <p style={{ color: 'var(--success)', fontWeight: 600 }}>Selected: {resume.name}</p>
              : <p>Drag &amp; drop or click to upload your resume</p>}
          </div>
        </div>

        {/* ── Send button ── */}
        <button type="submit" className="btn-send" disabled={isSending}>
          {isSending
            ? <><div className="loader"></div> Sending Emails...</>
            : '🚀 Send Separate Emails to All'}
        </button>
      </form>

      {/* ── Sending status ── */}
      {status.length > 0 && (
        <div className="status-list">
          <h3>Sending Status</h3>
          {status.map((item, i) => (
            <div key={i} className="status-item">
              <span className="status-email">{item.email}</span>
              <span className={`status-badge ${item.state}`}>{item.state.toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Gmail help accordion ── */}
      <details className="help-details">
        <summary className="help-summary">
          <span>💡 Need help setting up Gmail? (App Password Guide)</span>
        </summary>
        <div className="help-content">
          <p>Google requires a secure <strong>App Password</strong> rather than your standard account password:</p>
          <ol>
            <li>Go to <a href="https://myaccount.google.com/" target="_blank" rel="noreferrer">Google Account Settings</a>.</li>
            <li>Enable <strong>2-Step Verification</strong> under Security.</li>
            <li>Search for <strong>"App Passwords"</strong> in the search bar.</li>
            <li>Create a new password named &quot;Cold Email Tool&quot; and copy the 16-character code.</li>
            <li>Paste that code into the <strong>Gmail App Password</strong> field above.</li>
          </ol>
        </div>
      </details>
    </div>
  );
}
