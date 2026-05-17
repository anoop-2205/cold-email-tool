'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { initUsers, getSession, login, register, saveUserData, generateTemplates } from '../lib/auth';

const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const SETUP_FIELDS = [
  { key: 'name',         label: 'Full Name',           placeholder: 'e.g. John Smith',            required: true  },
  { key: 'phone',        label: 'Phone Number',         placeholder: 'e.g. +91 9876543210',        required: true  },
  { key: 'smtpUser',     label: 'Gmail Address',        placeholder: 'you@gmail.com',              required: true, type: 'email' },
  { key: 'company',      label: 'Current Company',      placeholder: 'e.g. TechCorp Pvt Ltd',      required: true  },
  { key: 'role',         label: 'Current Role / Title', placeholder: 'e.g. Frontend Developer',    required: true  },
  { key: 'experience',   label: 'Years of Experience',  placeholder: 'e.g. 2  or  3.5',            required: true  },
  { key: 'primarySkill', label: 'Primary Skill',        placeholder: 'e.g. React, Angular, Vue',   required: true  },
  { key: 'skills',       label: 'All Key Skills',       placeholder: 'React, TypeScript, Node.js', required: true  },
  { key: 'portfolio',    label: 'Portfolio URL',        placeholder: 'https://yoursite.com',       required: false },
  { key: 'github',       label: 'GitHub URL',           placeholder: 'https://github.com/you',    required: false },
  { key: 'linkedin',     label: 'LinkedIn URL',         placeholder: 'https://linkedin.com/in/you', required: false },
];

const EMPTY_PROFILE = {
  name: '', phone: '', smtpUser: '', company: '', role: '',
  experience: '', primarySkill: '', skills: '',
  portfolio: '', github: '', linkedin: '',
};

export default function LoginPage() {
  const router = useRouter();

  const [view, setView]           = useState('login'); // 'login' | 'register' | 'setup'
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [profile, setProfile]     = useState(EMPTY_PROFILE);
  const [error, setError]         = useState('');
  const [theme, setTheme]         = useState('light');
  const [newUser, setNewUser]     = useState('');   // username of just-registered user

  useEffect(() => {
    initUsers();
    if (getSession()) { router.push('/'); return; }
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    const pref  = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(pref);
    document.documentElement.setAttribute('data-theme', pref);
  }, [router]);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }, [theme]);

  const switchView = (v) => { setView(v); setError(''); };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    const result = login(username.trim(), password);
    if (!result.success) { setError(result.error); return; }
    router.push('/');
  };

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegister = (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPw) { setError('Passwords do not match.'); return; }
    const result = register(username.trim(), password);
    if (!result.success) { setError(result.error); return; }
    setNewUser(username.trim());
    setView('setup');
  };

  // ── Profile setup ──────────────────────────────────────────────────────────
  const handleSetup = (e) => {
    e.preventDefault();
    setError('');
    for (const f of SETUP_FIELDS.filter(f => f.required)) {
      if (!profile[f.key]?.trim()) {
        setError(`${f.label} is required.`);
        return;
      }
    }
    const templates = generateTemplates(profile);
    const saved = saveUserData(newUser, profile, templates);
    if (!saved) { setError('Failed to save. Storage may be full.'); return; }
    router.push('/');
  };

  const handleProfileChange = (key, value) =>
    setProfile(prev => ({ ...prev, [key]: value }));

  return (
    <div className="auth-wrapper">
      <div className="auth-card">

        {/* ── Brand header ── */}
        <div className="auth-header">
          <div className="auth-brand">
            <div className="auth-logo">✉</div>
            <div>
              <h1 className="auth-title">Cold Email Tool</h1>
              <p className="auth-subtitle">
                {view === 'setup'
                  ? 'Set up your profile — one time only'
                  : 'Personalized job application emailer'}
              </p>
            </div>
          </div>
          <button className="theme-toggle" type="button" onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>

        {/* ── Tab switcher (not shown during setup) ── */}
        {view !== 'setup' && (
          <div className="auth-tabs">
            <button type="button" className={`auth-tab ${view === 'login' ? 'active' : ''}`}
              onClick={() => switchView('login')}>Sign In</button>
            <button type="button" className={`auth-tab ${view === 'register' ? 'active' : ''}`}
              onClick={() => switchView('register')}>Create Account</button>
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        {/* ── Login form ── */}
        {view === 'login' && (
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="input-group">
              <label>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username" required autoFocus />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password" required />
            </div>
            <button type="submit" className="auth-btn">Sign In</button>
            <p className="auth-hint">
              New here?{' '}
              <button type="button" className="auth-link" onClick={() => switchView('register')}>
                Create an account
              </button>
            </p>
          </form>
        )}

        {/* ── Register form ── */}
        {view === 'register' && (
          <form className="auth-form" onSubmit={handleRegister}>
            <div className="input-group">
              <label>Username <span className="required-star">*</span></label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Choose a username (min 3 chars)" required autoFocus />
            </div>
            <div className="input-group">
              <label>Password <span className="required-star">*</span></label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Choose a password (min 6 chars)" required />
            </div>
            <div className="input-group">
              <label>Confirm Password <span className="required-star">*</span></label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat your password" required />
            </div>
            <button type="submit" className="auth-btn">Continue to Profile Setup →</button>
            <p className="auth-hint">
              Already have an account?{' '}
              <button type="button" className="auth-link" onClick={() => switchView('login')}>
                Sign in
              </button>
            </p>
          </form>
        )}

        {/* ── Profile setup form ── */}
        {view === 'setup' && (
          <form className="auth-form" onSubmit={handleSetup}>
            <p className="setup-intro">
              Fill in your details once — they will be pre-filled every time you log in and
              automatically generate your email templates.
            </p>
            <div className="setup-grid">
              {SETUP_FIELDS.map(f => (
                <div key={f.key} className="input-group">
                  <label>
                    {f.label}
                    {f.required && <span className="required-star"> *</span>}
                  </label>
                  <input
                    type={f.type || 'text'}
                    value={profile[f.key]}
                    onChange={e => handleProfileChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                  />
                </div>
              ))}
            </div>
            <button type="submit" className="auth-btn">Save Profile &amp; Start Using the Tool →</button>
          </form>
        )}

      </div>
    </div>
  );
}
