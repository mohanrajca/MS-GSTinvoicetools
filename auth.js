// js/auth.js
// Handles: hashPassword, login, adminLogin, logout, getSession, validateSession
// Depends on: config.js (must be loaded first)

const auth = (() => {

  const SESSION_KEY = 'gst_session';

  // ── SHA-256 hex hash ────────────────────────────────────────────────────
  async function hashPassword(plaintext) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── Internal: POST to Master Script ─────────────────────────────────────
  async function _postMaster(payload) {
    const res = await fetch(config.MASTER_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain' }
    });
    return res.json();
  }

  // ── Login (client user) ──────────────────────────────────────────────────
  async function login(username, password) {
    const password_hash = await hashPassword(password);
    const response = await _postMaster({ action: 'login', username, password_hash });
    if (response.ok) {
      const session = {
        token:           response.token,
        clientScriptUrl: response.clientScriptUrl,
        clientId:        response.clientId,
        clientName:      response.clientName,
        userName:        response.userName,
        role:            response.role,
        invoiceType:     response.invoiceType,     // 'standard' | 'commission'
        gstRegistered:   response.gstRegistered,   // true | false
        expiresAt:       Date.now() + config.TOKEN_EXPIRY_HOURS * 3600 * 1000
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    return response;
  }

  // ── Admin login (Mohan only) ─────────────────────────────────────────────
  async function adminLogin(username, password) {
    const password_hash = await hashPassword(password);
    const response = await _postMaster({ action: 'admin_login', username, password_hash });
    if (response.ok) {
      const session = {
        token:     response.token,
        userName:  username,
        role:      'superadmin',
        expiresAt: Date.now() + config.TOKEN_EXPIRY_HOURS * 3600 * 1000
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    return response;
  }

  // ── Get current session (null if missing/expired) ────────────────────────
  function getSession() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw);
      if (!session.expiresAt || session.expiresAt < Date.now()) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  // ── Validate token with Master Script ───────────────────────────────────
  async function validateSession() {
    const session = getSession();
    if (!session) return false;
    try {
      const response = await _postMaster({ action: 'validate_token', token: session.token });
      return response.ok === true;
    } catch {
      return false;
    }
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
  }

  return { hashPassword, login, adminLogin, getSession, validateSession, logout };

})();
