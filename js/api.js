// js/api.js
// Two call paths: Master Script (auth/config) and Client Script (data).
// Depends on: config.js, auth.js (must be loaded first)

const api = (() => {

  // ── Call Master Apps Script ──────────────────────────────────────────────
  async function callMasterScript(action, payload = {}) {
    const body = JSON.stringify({ action, ...payload });
    const res = await fetch(config.MASTER_SCRIPT_URL, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'text/plain' }
    });
    return res.json();
  }

  // ── Call Client Apps Script ──────────────────────────────────────────────
  // Client Script URL is held in memory only (never written to storage).
  // Every call includes the session token for the client Script to validate.
  async function callClientScript(action, payload = {}) {
    const session = auth.getSession();
    if (!session || !session.clientScriptUrl) {
      throw new Error('No active client session');
    }
    const body = JSON.stringify({ action, token: session.token, ...payload });
    const res = await fetch(session.clientScriptUrl, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'text/plain' }
    });
    return res.json();
  }

  // ── Refresh session on page load ─────────────────────────────────────────
  // Called by app.html and admin.html on DOMContentLoaded.
  // If session is missing/expired/invalid → redirect to login.
  // If clientScriptUrl missing (page refresh lost it) → re-fetch from Master.
  async function refreshSession() {
    const session = auth.getSession();
    if (!session) {
      window.location.href = 'index.html';
      return;
    }

    // Validate token with Master Script
    const valid = await auth.validateSession();
    if (!valid) {
      auth.logout();
      return;
    }

    // If clientScriptUrl was lost (superadmin has none, that is fine)
    if (!session.clientScriptUrl && session.role !== 'superadmin') {
      try {
        const response = await callMasterScript('get_client_script', {
          token: session.token
        });
        if (response.ok && response.clientScriptUrl) {
          // Update session in storage with recovered URL
          const updated = { ...session, clientScriptUrl: response.clientScriptUrl };
          sessionStorage.setItem('gst_session', JSON.stringify(updated));
        } else {
          auth.logout();
        }
      } catch {
        auth.logout();
      }
    }
  }

  // ── Show toast notification ──────────────────────────────────────────────
  function showToast(message, type = 'success') {
    const existing = document.getElementById('gst-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'gst-toast';
    toast.className = `gst-toast gst-toast--${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('gst-toast--visible'));
    setTimeout(() => {
      toast.classList.remove('gst-toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  return { callMasterScript, callClientScript, refreshSession, showToast };

})();
