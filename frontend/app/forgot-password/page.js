"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.forgotPassword(email);
      setResult(res);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-hero">
        <div className="auth-hero-inner">
          <div className="auth-hero-mark">AA</div>
          <h1>Forgot your password?</h1>
          <p>No worries. Enter the email on your account and we&apos;ll send you a link to set a new one.</p>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-card">
          <h2 className="auth-title">Reset password</h2>
          {result ? (
            <>
              <p className="page-success">{result.message}</p>
              {result.dev_reset_link ? (
                <div className="dev-reset-box">
                  <p className="page-hint">
                    SMTP isn&apos;t configured yet, so here&apos;s the reset link directly (dev-mode only — once
                    SMTP is set up this box disappears and the link only goes out by email):
                  </p>
                  <a href={result.dev_reset_link} className="dev-reset-link">
                    {result.dev_reset_link}
                  </a>
                </div>
              ) : null}
              <p className="auth-switch">
                <Link href="/login">Back to sign in</Link>
              </p>
            </>
          ) : (
            <>
              <p className="auth-subtitle">Enter your account email.</p>
              <form onSubmit={handleSubmit} className="auth-form">
                <label>
                  Email
                  <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </label>
                {error ? <p className="auth-error">{error}</p> : null}
                <button className="auth-btn" type="submit" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
              <p className="auth-switch">
                <Link href="/login">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
