const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("autoapply_token");
}

function storeSession({ access_token, role, full_name, email }) {
  localStorage.setItem("autoapply_token", access_token);
  localStorage.setItem("autoapply_role", role);
  localStorage.setItem("autoapply_full_name", full_name || "");
  localStorage.setItem("autoapply_email", email || "");
}

export function clearToken() {
  localStorage.removeItem("autoapply_token");
  localStorage.removeItem("autoapply_role");
  localStorage.removeItem("autoapply_full_name");
  localStorage.removeItem("autoapply_email");
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export function getRole() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("autoapply_role");
}

export function isAdmin() {
  return getRole() === "admin";
}

export function getCurrentUser() {
  if (typeof window === "undefined") return null;
  return {
    role: localStorage.getItem("autoapply_role"),
    fullName: localStorage.getItem("autoapply_full_name"),
    email: localStorage.getItem("autoapply_email"),
  };
}

async function request(path, { method = "GET", body, isFormData = false } = {}) {
  const token = getToken();
  const headers = {};
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Not authenticated");
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  async login(email, password) {
    const session = await request("/api/auth/login", { method: "POST", body: { email, password } });
    storeSession(session);
    return session;
  },
  async register(email, password, fullName) {
    const session = await request("/api/auth/register", {
      method: "POST",
      body: { email, password, full_name: fullName },
    });
    storeSession(session);
    return session;
  },
  forgotPassword: (email) => request("/api/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token, newPassword) =>
    request("/api/auth/reset-password", { method: "POST", body: { token, new_password: newPassword } }),

  getProfile: () => request("/api/profile"),
  updateProfile: (data) => request("/api/profile", { method: "PUT", body: data }),
  uploadResume: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/api/profile/upload", { method: "POST", body: form, isFormData: true });
  },

  getJobs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/jobs${qs ? `?${qs}` : ""}`);
  },
  approveJob: (id) => request(`/api/jobs/${id}/approve`, { method: "POST" }),
  rejectJob: (id) => request(`/api/jobs/${id}/reject`, { method: "POST" }),
  applyToJob: (id) => request(`/api/jobs/${id}/apply`, { method: "POST" }),

  getApplications: () => request("/api/applications"),
  updateApplication: (id, data) => request(`/api/applications/${id}`, { method: "PUT", body: data }),

  runScraper: () => request("/api/agent/run-scraper", { method: "POST" }),
  runMatcher: () => request("/api/agent/run-matcher", { method: "POST" }),
  runEmailScan: () => request("/api/agent/run-email-scan", { method: "POST" }),

  getRecentEmails: () => request("/api/email/recent"),
  getInboundOpportunities: () => request("/api/email/inbound"),

  getAnalyticsSummary: () => request("/api/analytics/summary"),

  getSettings: () => request("/api/settings"),
  updateSetting: (key, value) => request("/api/settings", { method: "PUT", body: { key, value } }),

  getAdminUsers: () => request("/api/admin/users"),
  getAdminUserDetail: (id) => request(`/api/admin/users/${id}`),
  toggleUserActive: (id) => request(`/api/admin/users/${id}/toggle-active`, { method: "POST" }),

  getGmailStatus: () => request("/api/gmail/status"),
  async connectGmail() {
    const { auth_url } = await request("/api/gmail/connect");
    window.location.href = auth_url;
  },
  disconnectGmail: () => request("/api/gmail/disconnect", { method: "POST" }),

  draftOutreach: (data) => request("/api/outreach/draft", { method: "POST", body: data }),
  sendOutreach: (data) => request("/api/outreach/send", { method: "POST", body: data }),
  getOutreach: () => request("/api/outreach"),

  getNaukriStatus: () => request("/api/naukri/status"),
  setNaukriCredentials: (username, password) =>
    request("/api/naukri/credentials", { method: "PUT", body: { username, password } }),
  clearNaukriCredentials: () => request("/api/naukri/credentials", { method: "DELETE" }),
};

export function agentStatusSocket(onMessage) {
  if (typeof window === "undefined") return () => {};
  const wsUrl = API_URL.replace(/^http/, "ws") + "/ws/agent-status";
  const socket = new WebSocket(wsUrl);
  socket.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // ignore malformed frames
    }
  };
  return () => socket.close();
}
