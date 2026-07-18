"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import EmailAlert from "@/components/EmailAlert";
import { api } from "@/lib/api";

const GMAIL_QUERY_MESSAGES = {
  connected: { tone: "success", text: "Gmail connected." },
  denied: { tone: "error", text: "Gmail connection was cancelled." },
  error: { tone: "error", text: "Something went wrong connecting Gmail. Try again." },
};

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="shell-loading">Loading…</div>}>
      <InboxContent />
    </Suspense>
  );
}

function InboxContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState("recent");
  const [recent, setRecent] = useState([]);
  const [inbound, setInbound] = useState([]);
  const [gmailStatus, setGmailStatus] = useState(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const gmailQueryFlag = searchParams.get("gmail");
  const queryMessage = gmailQueryFlag ? GMAIL_QUERY_MESSAGES[gmailQueryFlag] : null;

  async function load() {
    try {
      const [status, r, i] = await Promise.all([
        api.getGmailStatus(),
        api.getRecentEmails(),
        api.getInboundOpportunities(),
      ]);
      setGmailStatus(status);
      setRecent(r);
      setInbound(i);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the backend API, not derived state
    load();
  }, []);

  async function handleConnect() {
    setConnecting(true);
    setError("");
    try {
      await api.connectGmail(); // full-page redirect to Google
    } catch (err) {
      setError(err.message);
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await api.disconnectGmail();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleScan() {
    setScanning(true);
    setError("");
    try {
      await api.runEmailScan();
      setTimeout(load, 3000); // scan runs in the background; give it a moment
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }

  const list = tab === "recent" ? recent : inbound;
  const connected = gmailStatus?.connected;

  return (
    <DashboardShell
      title="Inbox"
      actions={
        connected ? (
          <button className="btn-secondary" onClick={handleScan} disabled={scanning}>
            {scanning ? "Starting scan…" : "Scan Gmail now"}
          </button>
        ) : null
      }
    >
      {error ? <p className="page-error">{error}</p> : null}
      {queryMessage ? <p className={queryMessage.tone === "error" ? "page-error" : "page-success"}>{queryMessage.text}</p> : null}

      <section className="panel gmail-connect-panel">
        {gmailStatus === null ? (
          <p className="page-hint">Checking Gmail connection…</p>
        ) : connected ? (
          <div className="gmail-connect-row">
            <div>
              <p className="gmail-connect-status gmail-connected">Connected</p>
              <p className="page-hint">{gmailStatus.email}</p>
            </div>
            <button className="btn-ghost" onClick={handleDisconnect} type="button">
              Disconnect
            </button>
          </div>
        ) : (
          <div className="gmail-connect-row">
            <div>
              <p className="gmail-connect-status gmail-disconnected">Not connected</p>
              <p className="page-hint">
                Connect your Gmail so the agent can scan for job alerts and application responses, and send cold
                emails to recruiters on your behalf from the Outreach page. Grants read + send access only &mdash;
                never deletes, modifies, or manages your existing mail. Runs locally, disconnect anytime.
              </p>
            </div>
            <button className="btn-primary" onClick={handleConnect} disabled={connecting} type="button">
              {connecting ? "Redirecting…" : "Connect Gmail"}
            </button>
          </div>
        )}
      </section>

      {connected ? (
        <>
          <div className="tabs">
            <button className={tab === "recent" ? "tab active" : "tab"} onClick={() => setTab("recent")}>
              Recent scans ({recent.length})
            </button>
            <button className={tab === "inbound" ? "tab active" : "tab"} onClick={() => setTab("inbound")}>
              Inbound opportunities ({inbound.length})
            </button>
          </div>

          {list.length === 0 ? (
            <p className="page-hint">Nothing here yet. Try &quot;Scan Gmail now&quot; above.</p>
          ) : (
            <div className="email-list">
              {list.map((scan) => (
                <EmailAlert key={scan.id} scan={scan} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </DashboardShell>
  );
}
