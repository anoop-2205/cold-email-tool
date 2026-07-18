"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.register(email, password, fullName);
      router.push("/");
    } catch (err) {
      setError(err.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-hero">
        <div className="auth-hero-inner">
          <div className="auth-hero-mark">AA</div>
          <h1>Join as a candidate</h1>
          <p>Create your free account and let the agent build your profile, find matching roles, and track every application.</p>
          <ul className="auth-hero-list">
            <li>Upload your resume once, AI does the rest</li>
            <li>Approve jobs yourself &mdash; nothing auto-applies without you</li>
            <li>Your own private dashboard, not a shared feed</li>
          </ul>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-card">
          <h2 className="auth-title">Create your account</h2>
          <p className="auth-subtitle">Takes less than a minute.</p>
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              Full name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <small>At least 8 characters.</small>
            </label>
            {error ? <p className="auth-error">{error}</p> : null}
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
          <p className="auth-switch">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
