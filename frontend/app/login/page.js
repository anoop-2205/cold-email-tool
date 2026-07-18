"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await api.login(email, password);
      router.push(session.role === "admin" ? "/admin" : "/");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-hero">
        <div className="auth-hero-inner">
          <div className="auth-hero-mark">AA</div>
          <h1>AutoApply Agent</h1>
          <p>Discover, match, tailor, and apply to jobs with AI &mdash; while you keep full control and your data stays yours.</p>
          <ul className="auth-hero-list">
            <li>AI resume parsing &amp; job matching</li>
            <li>Tailored resumes + cover letters per role</li>
            <li>Application tracking &amp; email intelligence</li>
          </ul>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-card">
          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-subtitle">Sign in to continue your job search.</p>
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              Email or username
              <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <Link href="/forgot-password" className="auth-forgot-link">
              Forgot password?
            </Link>
            {error ? <p className="auth-error">{error}</p> : null}
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="auth-switch">
            New here? <Link href="/signup">Create a candidate account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
