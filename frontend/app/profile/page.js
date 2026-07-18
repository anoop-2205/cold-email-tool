"use client";

import { useEffect, useRef, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api } from "@/lib/api";

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api
      .getProfile()
      .then(setProfile)
      .catch((err) => setError(err.message));
  }, []);

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const updated = await api.uploadResume(file);
      setProfile(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateProfile({
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        location: profile.location,
        summary: profile.summary,
        skills: profile.skills,
      });
      setProfile(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateField(field, value) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <DashboardShell title="Profile">
      {error ? <p className="page-error">{error}</p> : null}

      <section
        className={`upload-dropzone${dragOver ? " drag-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {uploading ? (
          <p>Parsing resume with AI…</p>
        ) : (
          <p>
            Drag &amp; drop your resume PDF here, or <span className="upload-link">browse</span>.
            {profile?.resume_pdf_path ? " (Uploading again replaces your current profile.)" : ""}
          </p>
        )}
      </section>

      {profile ? (
        <section className="panel">
          <h2>Parsed profile</h2>
          <div className="profile-form">
            <label>
              Full name
              <input value={profile.full_name || ""} onChange={(e) => updateField("full_name", e.target.value)} />
            </label>
            <label>
              Email
              <input value={profile.email || ""} onChange={(e) => updateField("email", e.target.value)} />
            </label>
            <label>
              Phone
              <input value={profile.phone || ""} onChange={(e) => updateField("phone", e.target.value)} />
            </label>
            <label>
              Location
              <input value={profile.location || ""} onChange={(e) => updateField("location", e.target.value)} />
            </label>
            <label className="span-2">
              Summary
              <textarea rows={3} value={profile.summary || ""} onChange={(e) => updateField("summary", e.target.value)} />
            </label>
          </div>

          <div className="tag-list">
            {(profile.skills || []).map((skill, i) => (
              <span key={i} className="tag">
                {skill}
              </span>
            ))}
          </div>

          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>

          {(profile.experience || []).length > 0 && (
            <>
              <h3>Experience</h3>
              {profile.experience.map((exp, i) => (
                <div key={i} className="experience-card">
                  <strong>
                    {exp.role} — {exp.company}
                  </strong>
                  <span className="experience-duration">{exp.duration}</span>
                  <ul>{(exp.bullets || []).map((b, j) => <li key={j}>{b}</li>)}</ul>
                </div>
              ))}
            </>
          )}

          {(profile.projects || []).length > 0 && (
            <>
              <h3>Projects</h3>
              {profile.projects.map((proj, i) => (
                <div key={i} className="experience-card">
                  <strong>{proj.name}</strong>
                  <p>{proj.description}</p>
                  <span className="experience-duration">{(proj.tech || []).join(", ")}</span>
                </div>
              ))}
            </>
          )}
        </section>
      ) : (
        <p className="page-hint">No profile yet — upload a resume to get started.</p>
      )}
    </DashboardShell>
  );
}
