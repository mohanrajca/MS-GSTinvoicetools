// MasterScript.js
// Deploy as Google Apps Script Web App:
//   Extensions → Apps Script → Deploy → New Deployment
//   Type: Web App | Execute as: Me | Access: Anyone
// Copy the deployment URL into js/config.js → MASTER_SCRIPT_URL

// ── Sheet tab names ──────────────────────────────────────────────────────────
const SHEET = {
  CLIENTS:  'CLIENTS',
  USERS:    'USERS',
  ADMIN:    'ADMIN',
  TOKENS:   'TOKENS',
  LOCKOUTS: 'LOCKOUTS'
};

// ── Main entry point ─────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result;

    switch (action) {
      case 'login':              result = handleLogin(data);           break;
      case 'admin_login':        result = handleAdminLogin(data);      break;
      case 'validate_token':     result = handleValidateToken(data);   break;
      case 'get_client_script':  result = handleGetClientScript(data); break;
      case 'get_clients':        result = handleGetClients(data);      break;
      case 'save_client':        result = handleSaveClient(data);      break;
      case 'get_users':          result = handleGetUsers(data);        break;
      case 'save_user':          result = handleSaveUser(data);        break;
      case 'toggle_user':        result = handleToggleUser(data);      break;
      case 'toggle_client':      result = handleToggleClient(data);    break;
      default:
        result = { ok: false, error: 'Unknown action: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function sheetToObjects(sheetName) {
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => h.toString().trim().toLowerCase().replace(/ /g,'_'));
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function getSecret() {
  const admin = getSheet(SHEET.ADMIN);
  // Secret is in column C (index 2), row 2 (index 1)
  return admin.getRange(2, 3).getValue().toString();
}

function generateToken(clientId, username) {
  const raw = clientId + '|' + username + '|' + getSecret() + '|' + Date.now();
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    raw,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function storeToken(token, clientId, username) {
  const sheet = getSheet(SHEET.TOKENS);
  const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
  sheet.appendRow([token, clientId, username, expiresAt]);
}

function isTokenValid(token) {
  const tokens = sheetToObjects(SHEET.TOKENS);
  const record = tokens.find(t => t.token === token);
  if (!record) return null;
  if (new Date(record.expires_at) < new Date()) return null;
  return record;
}

function requireSuperAdmin(data) {
  const record = isTokenValid(data.token);
  if (!record || record.client_id !== 'ADMIN') return false;
  return true;
}

// ── Lockout helpers ──────────────────────────────────────────────────────────

function checkLockout(username) {
  const sheet = getSheet(SHEET.LOCKOUTS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      const count      = data[i][1];
      const lockedUntil = data[i][2] ? new Date(data[i][2]) : null;
      if (count >= 5 && lockedUntil && lockedUntil > new Date()) {
        const mins = Math.ceil((lockedUntil - new Date()) / 60000);
        return { locked: true, minutesLeft: mins };
      }
      return { locked: false, row: i + 1, count };
    }
  }
  return { locked: false, row: null, count: 0 };
}

function recordFailedLogin(username, currentCount, row) {
  const sheet = getSheet(SHEET.LOCKOUTS);
  const newCount = currentCount + 1;
  const lockedUntil = newCount >= 5
    ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
    : '';
  if (row) {
    sheet.getRange(row, 2, 1, 2).setValues([[newCount, lockedUntil]]);
  } else {
    sheet.appendRow([username, newCount, lockedUntil]);
  }
}

function clearLockout(username) {
  const sheet = getSheet(SHEET.LOCKOUTS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      sheet.getRange(i + 1, 2, 1, 2).setValues([[0, '']]);
      break;
    }
  }
}

// ── Action handlers ──────────────────────────────────────────────────────────

function handleLogin(data) {
  const { username, password_hash } = data;

  // Lockout check
  const lockStatus = checkLockout(username);
  if (lockStatus.locked) {
    return { ok: false, error: 'Account locked. Try again in ' + lockStatus.minutesLeft + ' minute(s).' };
  }

  const users = sheetToObjects(SHEET.USERS);
  const user  = users.find(u =>
    u.username === username &&
    u.password_hash === password_hash &&
    String(u.active).toUpperCase() === 'TRUE'
  );

  if (!user) {
    recordFailedLogin(username, lockStatus.count, lockStatus.row);
    return { ok: false, error: 'Invalid username or password.' };
  }

  const clients = sheetToObjects(SHEET.CLIENTS);
  const client  = clients.find(c =>
    c.client_id === user.client_id &&
    String(c.active).toUpperCase() === 'TRUE'
  );

  if (!client) {
    return { ok: false, error: 'Your account is not associated with an active client.' };
  }

  clearLockout(username);
  const token = generateToken(user.client_id, username);
  storeToken(token, user.client_id, username);

  return {
    ok:              true,
    token,
    clientScriptUrl: client.script_url,
    clientId:        client.client_id,
    clientName:      client.client_name,
    userName:        user.username,
    role:            user.role,
    invoiceType:     client.invoice_type   || 'standard',
    gstRegistered:   String(client.gst_registered).toUpperCase() === 'TRUE'
  };
}

function handleAdminLogin(data) {
  const { username, password_hash } = data;

  const lockStatus = checkLockout(username);
  if (lockStatus.locked) {
    return { ok: false, error: 'Account locked. Try again in ' + lockStatus.minutesLeft + ' minute(s).' };
  }

  const admin = getSheet(SHEET.ADMIN);
  const adminUsername = admin.getRange(2, 1).getValue().toString();
  const adminHash     = admin.getRange(2, 2).getValue().toString();

  if (username !== adminUsername || password_hash !== adminHash) {
    recordFailedLogin(username, lockStatus.count, lockStatus.row);
    return { ok: false, error: 'Invalid admin credentials.' };
  }

  clearLockout(username);
  const token = generateToken('ADMIN', username);
  storeToken(token, 'ADMIN', username);

  return { ok: true, token, role: 'superadmin', userName: username };
}

function handleValidateToken(data) {
  const record = isTokenValid(data.token);
  if (!record) return { ok: false };
  return { ok: true, clientId: record.client_id, userName: record.username };
}

function handleGetClientScript(data) {
  const record = isTokenValid(data.token);
  if (!record || record.client_id === 'ADMIN') return { ok: false };

  const clients = sheetToObjects(SHEET.CLIENTS);
  const client  = clients.find(c => c.client_id === record.client_id);
  if (!client) return { ok: false };

  return { ok: true, clientScriptUrl: client.script_url };
}

function handleGetClients(data) {
  if (!requireSuperAdmin(data)) return { ok: false, error: 'Unauthorized' };
  const clients = sheetToObjects(SHEET.CLIENTS).map(c => ({
    client_id:      c.client_id,
    client_name:    c.client_name,
    script_url:     c.script_url,
    invoice_type:   c.invoice_type   || 'standard',
    gst_registered: String(c.gst_registered).toUpperCase() === 'TRUE',
    active:         String(c.active).toUpperCase() === 'TRUE',
    created_date:   c.created_date
  }));
  return { ok: true, clients };
}

function handleSaveClient(data) {
  if (!requireSuperAdmin(data)) return { ok: false, error: 'Unauthorized' };
  const { client } = data;
  const sheet = getSheet(SHEET.CLIENTS);
  const rows  = sheet.getDataRange().getValues();

  if (client.client_id) {
    // Update existing
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === client.client_id) {
        sheet.getRange(i + 1, 1, 1, 7).setValues([[
          client.client_id,
          client.client_name,
          client.script_url,
          client.invoice_type   || 'standard',
          client.gst_registered ? 'TRUE' : 'FALSE',
          client.active ? 'TRUE' : 'FALSE',
          rows[i][6] // preserve created_date
        ]]);
        return { ok: true, client_id: client.client_id };
      }
    }
  }

  // New client
  const newId = 'C' + String(rows.length).padStart(3, '0');
  sheet.appendRow([
    newId,
    client.client_name,
    client.script_url,
    client.invoice_type   || 'standard',
    client.gst_registered ? 'TRUE' : 'FALSE',
    'TRUE',
    new Date().toISOString().split('T')[0]
  ]);
  return { ok: true, client_id: newId };
}

function handleGetUsers(data) {
  if (!requireSuperAdmin(data)) return { ok: false, error: 'Unauthorized' };
  const { client_id } = data;
  const users = sheetToObjects(SHEET.USERS)
    .filter(u => u.client_id === client_id)
    .map(u => ({
      user_id:   u.user_id,
      client_id: u.client_id,
      username:  u.username,
      role:      u.role,
      active:    String(u.active).toUpperCase() === 'TRUE'
      // password_hash intentionally excluded
    }));
  return { ok: true, users };
}

function handleSaveUser(data) {
  if (!requireSuperAdmin(data)) return { ok: false, error: 'Unauthorized' };
  const { user } = data;
  const sheet = getSheet(SHEET.USERS);
  const rows  = sheet.getDataRange().getValues();
  const SENTINEL = '__UNCHANGED__';

  if (user.user_id) {
    // Update existing
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === user.user_id) {
        const existingHash = rows[i][3];
        // If password_hash is sentinel, keep existing hash
        const newHash = (user.password_hash === SENTINEL) ? existingHash : user.password_hash;
        sheet.getRange(i + 1, 1, 1, 6).setValues([[
          user.user_id,
          user.client_id,
          user.username,
          newHash,
          user.role,
          user.active ? 'TRUE' : 'FALSE'
        ]]);
        return { ok: true, user_id: user.user_id };
      }
    }
  }

  // New user — password_hash must be provided
  if (!user.password_hash || user.password_hash === SENTINEL) {
    return { ok: false, error: 'Password required for new user.' };
  }
  const newId = 'U' + String(rows.length).padStart(3, '0');
  sheet.appendRow([
    newId,
    user.client_id,
    user.username,
    user.password_hash,
    user.role || 'accountant',
    'TRUE'
  ]);
  return { ok: true, user_id: newId };
}

function handleToggleUser(data) {
  if (!requireSuperAdmin(data)) return { ok: false, error: 'Unauthorized' };
  const sheet = getSheet(SHEET.USERS);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.user_id) {
      const newActive = String(rows[i][5]).toUpperCase() === 'TRUE' ? 'FALSE' : 'TRUE';
      sheet.getRange(i + 1, 6).setValue(newActive);
      return { ok: true, active: newActive === 'TRUE' };
    }
  }
  return { ok: false, error: 'User not found' };
}

function handleToggleClient(data) {
  if (!requireSuperAdmin(data)) return { ok: false, error: 'Unauthorized' };
  const sheet = getSheet(SHEET.CLIENTS);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.client_id) {
      const newActive = String(rows[i][5]).toUpperCase() === 'TRUE' ? 'FALSE' : 'TRUE';
      sheet.getRange(i + 1, 6).setValue(newActive);
      return { ok: true, active: newActive === 'TRUE' };
    }
  }
  return { ok: false, error: 'Client not found' };
}
