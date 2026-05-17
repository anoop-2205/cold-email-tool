const USERS_KEY   = 'cem_users_v1';
const SESSION_KEY = 'cem_session_v1';

// Anoop's exact original templates — preserved verbatim
const ANOOP_TEMPLATES = {
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
  },
};

// ─── Storage helpers ──────────────────────────────────────────────────────────

function getUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveUsers(users) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return true;
  } catch { return false; }
}

// ─── Initialization (call once on app start) ──────────────────────────────────

export function initUsers() {
  if (typeof window === 'undefined') return;
  try {
    const users = getUsers();
    if (!users['Anoop2205']) {
      users['Anoop2205'] = {
        password: 'Anoop2205',
        profileComplete: true,
        profile: {
          name: 'Anoop Singh',
          phone: '+91 6389641509',
          smtpUser: 'anoopvns2022@gmail.com',
          company: 'Centricity Wealth Tech',
          role: 'Software Engineer',
          experience: '2.5+',
          primarySkill: 'Angular',
          skills: 'Angular 19, TypeScript, Node.js, SCSS',
          portfolio: 'https://anoop-2205.github.io/Personal_Protfolio_anoop/',
          github: 'https://github.com/anoop-2205',
          linkedin: 'https://www.linkedin.com/in/-anoop-singh/',
        },
        templates: ANOOP_TEMPLATES,
        resumeName: null,
        resumeData: null,
      };
      saveUsers(users);
    }
  } catch {}
}

// ─── Session ──────────────────────────────────────────────────────────────────

export function getSession() {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}

export function setSession(username) {
  try { localStorage.setItem(SESSION_KEY, username); } catch {}
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

// ─── Auth actions ─────────────────────────────────────────────────────────────

export function login(username, password) {
  const users = getUsers();
  const user = users[username];
  if (!user) return { success: false, error: 'User not found. Please register first.' };
  if (user.password !== password) return { success: false, error: 'Incorrect password.' };
  setSession(username);
  return { success: true, user };
}

export function register(username, password) {
  if (!username || username.trim().length < 3)
    return { success: false, error: 'Username must be at least 3 characters.' };
  if (!password || password.length < 6)
    return { success: false, error: 'Password must be at least 6 characters.' };
  const users = getUsers();
  if (users[username]) return { success: false, error: 'Username already taken. Try another.' };
  users[username] = {
    password,
    profileComplete: false,
    profile: {},
    templates: null,
    resumeName: null,
    resumeData: null,
  };
  if (!saveUsers(users)) return { success: false, error: 'Storage error. Please try again.' };
  setSession(username);
  return { success: true };
}

// ─── Profile & templates ──────────────────────────────────────────────────────

export function saveUserData(username, profile, templates) {
  const users = getUsers();
  if (!users[username]) return false;
  users[username].profile = profile;
  users[username].templates = templates;
  users[username].profileComplete = true;
  return saveUsers(users);
}

export function saveResumeData(username, name, dataUrl) {
  try {
    const users = getUsers();
    if (!users[username]) return false;
    users[username].resumeName = name;
    users[username].resumeData = dataUrl;
    return saveUsers(users);
  } catch { return false; }
}

export function getCurrentUser() {
  const username = getSession();
  if (!username) return null;
  const users = getUsers();
  if (!users[username]) return null;
  return { username, ...users[username] };
}

// ─── Template generator for new users ────────────────────────────────────────

export function generateTemplates(p) {
  const links = [
    p.portfolio ? `Portfolio: ${p.portfolio}` : '',
    p.github    ? `GitHub: ${p.github}`        : '',
    p.linkedin  ? `LinkedIn: ${p.linkedin}`    : '',
  ].filter(Boolean).join('\n');

  return {
    direct: {
      name: 'Direct & concise',
      description: 'Best when applying directly to an advertised opening.',
      subject: `${p.role} Application – ${p.name} (${p.experience}+ yrs, ${p.primarySkill})`,
      message: `Hi [Hiring Manager Name],

I came across the **${p.role}** opening at **[Company Name]** and would love to be considered for the role.

I'm currently a **${p.role}** at **${p.company}**, with ${p.experience}+ years of experience building applications using **${p.skills}**.

I'd be glad to discuss how I can contribute to your team. My resume is attached for your reference.

Resume: [attached]
${links}

Thank you for your time.

Best regards,
${p.name}
${p.phone}`,
    },
    referral: {
      name: 'Referral-friendly',
      description: 'Softer tone for recruiters or engineers, asking about openings or referrals.',
      subject: `Exploring ${p.role} opportunities at [Company Name]`,
      message: `Hi [Recipient Name],

I hope you're doing well. I'm ${p.name}, a **${p.role}** with ${p.experience}+ years of experience, and I'm reaching out about **${p.role}** roles at **[Company Name]**.

At **${p.company}**, I work with **${p.skills}**. I've delivered production features and would love to bring that experience to your team.

If there are open roles or a referral path you could point me to, I'd really appreciate it.

Resume: [attached]
${links}

Thanks so much,
${p.name}
${p.phone}`,
    },
    specific: {
      name: 'Specific role application',
      description: 'Formal application mirroring a specific job title posted on a job board.',
      subject: `Application for [Role Title] – ${p.name}`,
      message: `Hi [Hiring Manager Name],

I'm writing to apply for the **[Role Title]** position at **[Company Name]** that I came across on **[LinkedIn / Company Careers Page]**.

A quick snapshot of my background:

- ${p.experience}+ years as a **${p.role}** at **${p.company}**
- Strong experience with **${p.skills}**

I believe my background aligns well with what you're looking for. My resume is attached.

Resume: [attached]
${links}

Looking forward to hearing from you.

Best regards,
${p.name}
${p.phone}`,
    },
  };
}
