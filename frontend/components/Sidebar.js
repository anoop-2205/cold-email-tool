"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getCurrentUser } from "@/lib/api";

const CANDIDATE_NAV = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/profile", label: "Profile", icon: "▤" },
  { href: "/jobs", label: "Jobs", icon: "⌘" },
  { href: "/applications", label: "Applications", icon: "✓" },
  { href: "/outreach", label: "Outreach", icon: "➤" },
  { href: "/cold-email", label: "Cold Email", icon: "✎" },
  { href: "/inbox", label: "Inbox", icon: "✉" },
  { href: "/analytics", label: "Analytics", icon: "≡" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

const ADMIN_NAV = [{ href: "/admin", label: "Users", icon: "▦" }];

function initials(name, email) {
  const source = (name || email || "?").trim();
  if (!source) return "?";
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function Sidebar({ variant = "candidate" }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getCurrentUser();
  const items = variant === "admin" ? ADMIN_NAV : CANDIDATE_NAV;
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  return (
    <aside className={`sidebar${variant === "admin" ? " sidebar-admin" : ""}`}>
      <div className="sidebar-topbar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">AA</span>
          <div>
            <span className="sidebar-brand-name">AutoApply Agent</span>
            {variant === "admin" ? <span className="sidebar-brand-tag">Admin</span> : null}
          </div>
        </div>
        <button
          className="sidebar-menu-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      <div className={`sidebar-menu${menuOpen ? " sidebar-menu-open" : ""}`}>
        <nav className="sidebar-nav">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${pathname === item.href ? " active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          {user ? (
            <div className="sidebar-user">
              <span className="sidebar-avatar">{initials(user.fullName, user.email)}</span>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user.fullName || user.email}</span>
                <span className="sidebar-user-role">{user.role}</span>
              </div>
            </div>
          ) : null}
          <button className="sidebar-theme-btn" onClick={toggleTheme} type="button">
            Toggle theme
          </button>
          <button className="sidebar-logout-btn" onClick={handleLogout} type="button">
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
