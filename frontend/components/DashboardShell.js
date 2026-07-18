"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRole, isLoggedIn } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

export default function DashboardShell({ title, actions, children, variant = "candidate" }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    const role = getRole();
    if (variant === "admin" && role !== "admin") {
      router.replace("/");
      return;
    }
    if (variant === "candidate" && role === "admin") {
      router.replace("/admin");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time auth/role check on mount, not derived state
    setChecked(true);
  }, [router, variant]);

  if (!checked) {
    return <div className="shell-loading">Loading…</div>;
  }

  return (
    <div className="dashboard-shell">
      <Sidebar variant={variant} />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>{title}</h1>
          {actions ? <div className="dashboard-actions">{actions}</div> : null}
        </header>
        <div className="dashboard-content">{children}</div>
      </main>
    </div>
  );
}
