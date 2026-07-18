"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="shell-loading">Loading…</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message || "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-hero">
        <div className="auth-hero-inner">
          <div className="auth-hero-mark">AA</div>
          <h1>Set a new password</h1>
          <p>Choose a strong password you haven&apos;t used before.</p>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-card">
          <h2 className="auth-title">New password</h2>

          {!token ? (
            <p className="auth-error">This link is missing its token. Request a new one from the login page.</p>
          ) : done ? (
            <>
              <p className="page-success">Password updated. You can sign in with your new password now.</p>
              <button className="auth-btn" onClick={() => router.push("/login")} type="button">
                Go to sign in
              </button>
            </>
          ) : (
            <>
              <p className="auth-subtitle">Enter and confirm your new password.</p>
              <form onSubmit={handleSubmit} className="auth-form">
                <label>
                  New password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                  />
                  <small>At least 8 characters.</small>
                </label>
                <label>
                  Confirm password
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                </label>
                {error ? <p className="auth-error">{error}</p> : null}
                <button className="auth-btn" type="submit" disabled={loading}>
                  {loading ? "Saving…" : "Set new password"}
                </button>
              </form>
            </>
          )}

          <p className="auth-switch">
            <Link href="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
