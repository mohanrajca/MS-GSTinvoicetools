// js/admin/user-manager.js
const userManager = (() => {

  let _currentClientId   = null;
  let _currentClientName = null;

  async function render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card__header">
          <span class="card__title">Users</span>
        </div>
        <div class="card__body">
          <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem">
            <div class="form-field" style="flex:1;margin:0">
              <label style="font-size:.75rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:.3rem;display:block">Select Client</label>
              <select id="userClientPicker" style="width:100%;padding:.5rem .75rem;border:1.5px solid var(--border);border-radius:7px;font-size:.88rem">
                <option value="">— Select a client —</option>
              </select>
            </div>
            <button class="btn btn--primary btn--sm" id="addUserBtn" style="margin-top:1.4rem" disabled>+ Add User</button>
          </div>
          <div id="usersTableArea">
            <div class="empty-state"><div class="empty-state__text">Select a client to manage their users.</div></div>
          </div>
        </div>
      </div>
      ${_modalHTML()}`;

    // Load clients into picker
    const session = auth.getSession();
    try {
      const data = await api.callMasterScript('get_clients', { token: session.token });
      const sel = document.getElementById('userClientPicker');
      (data.clients || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.client_id;
        opt.textContent = c.client_name + ' (' + c.client_id + ')';
        sel.appendChild(opt);
      });
    } catch { /* ignore */ }

    document.getElementById('userClientPicker').addEventListener('change', function() {
      const id = this.value;
      const name = this.options[this.selectedIndex]?.text || '';
      if (id) renderForClient(id, name);
      document.getElementById('addUserBtn').disabled = !id;
    });

    document.getElementById('addUserBtn').addEventListener('click', () => openUserModal(null));
  }

  async function renderForClient(clientId, clientName) {
    _currentClientId   = clientId;
    _currentClientName = clientName;

    // If we're on the users tab, update picker
    const picker = document.getElementById('userClientPicker');
    if (picker) picker.value = clientId;
    document.getElementById('addUserBtn') && (document.getElementById('addUserBtn').disabled = false);

    const area = document.getElementById('usersTableArea');
    if (!area) return;
    area.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    const session = auth.getSession();
    let data;
    try { data = await api.callMasterScript('get_users', { token: session.token, client_id: clientId }); }
    catch { area.innerHTML = '<p style="color:var(--danger)">Failed to load users.</p>'; return; }

    const rows = data.users || [];
    if (!rows.length) {
      area.innerHTML = `<div class="empty-state"><div class="empty-state__text">No users for this client yet.</div></div>`;
      return;
    }
    area.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${rows.map(u => `<tr>
              <td><strong>${u.username}</strong></td>
              <td><span class="badge badge--blue">${u.role}</span></td>
              <td><span class="badge ${u.active?'badge--green':'badge--red'}">${u.active?'Active':'Disabled'}</span></td>
              <td style="display:flex;gap:.4rem">
                <button class="btn btn--outline btn--sm" onclick='openUserModal(${JSON.stringify(u)})'>Edit</button>
                <button class="btn btn--outline btn--sm" onclick="toggleUser('${u.user_id}')">${u.active?'Disable':'Enable'}</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
  window.userManager = { renderForClient };

  function openUserModal(user) {
    document.getElementById('usr_id').value       = user ? (user.user_id  || '') : '';
    document.getElementById('usr_username').value = user ? (user.username || '') : '';
    document.getElementById('usr_password').value = '';
    document.getElementById('usr_role').value     = user ? (user.role     || 'accountant') : 'accountant';
    document.getElementById('usr_active').checked = !user || user.active;
    document.getElementById('usrPwdHint').style.display = user ? 'block' : 'none';
    document.getElementById('userModal').classList.add('open');
  }
  window.openUserModal = openUserModal;

  window.toggleUser = async function(userId) {
    const session = auth.getSession();
    try {
      await api.callMasterScript('toggle_user', { token: session.token, user_id: userId });
      api.showToast('User status updated');
      renderForClient(_currentClientId, _currentClientName);
    } catch(err) { api.showToast('Failed: '+err.message,'error'); }
  };

  document.addEventListener('click', async e => {
    if (e.target.id !== 'saveUserBtn') return;
    const btn = e.target; btn.disabled=true; btn.textContent='Saving…';
    const session = auth.getSession();
    const rawPass = document.getElementById('usr_password').value;
    const userId  = document.getElementById('usr_id').value;

    let password_hash = '__UNCHANGED__'; // Sentinel = keep existing
    if (rawPass) {
      password_hash = await auth.hashPassword(rawPass);
    } else if (!userId) {
      api.showToast('Password is required for new users','error');
      btn.disabled=false; btn.textContent='Save User'; return;
    }

    const user = {
      user_id:       userId || null,
      client_id:     _currentClientId,
      username:      document.getElementById('usr_username').value.trim(),
      password_hash,
      role:          document.getElementById('usr_role').value,
      active:        document.getElementById('usr_active').checked,
    };
    if (!user.username)  { api.showToast('Username required','error'); btn.disabled=false; btn.textContent='Save User'; return; }
    if (!user.client_id) { api.showToast('No client selected','error'); btn.disabled=false; btn.textContent='Save User'; return; }

    try {
      await api.callMasterScript('save_user', { token: session.token, user });
      document.getElementById('userModal').classList.remove('open');
      api.showToast('User saved');
      renderForClient(_currentClientId, _currentClientName);
    } catch(err) { api.showToast('Save failed: '+err.message,'error'); }
    btn.disabled=false; btn.textContent='Save User';
  });

  function _modalHTML() {
    return `
    <div class="modal-backdrop" id="userModal">
      <div class="modal">
        <div class="modal__header">
          <span class="modal__title">User</span>
          <button class="modal__close" onclick="document.getElementById('userModal').classList.remove('open')">×</button>
        </div>
        <div class="modal__body">
          <input type="hidden" id="usr_id">
          <div class="form-row">
            <div class="form-field"><label>Username *</label><input id="usr_username" placeholder="e.g. srowner" autocomplete="off"></div>
            <div class="form-field"><label>Role</label>
              <select id="usr_role"><option value="owner">Owner</option><option value="accountant">Accountant</option></select>
            </div>
          </div>
          <div class="form-row--1 form-field" style="margin-bottom:.4rem">
            <label>Password <span style="color:var(--text-muted);font-weight:400">(min 8 characters)</span></label>
            <input type="password" id="usr_password" autocomplete="new-password" placeholder="Enter password">
          </div>
          <div id="usrPwdHint" style="font-size:.75rem;color:var(--text-muted);margin-bottom:.9rem;display:none">
            Leave blank to keep the existing password.
          </div>
          <label style="display:inline-flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.85rem">
            <input type="checkbox" id="usr_active" checked> Active
          </label>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" onclick="document.getElementById('userModal').classList.remove('open')">Cancel</button>
          <button class="btn btn--primary" id="saveUserBtn">Save User</button>
        </div>
      </div>
    </div>`;
  }

  return { render, renderForClient };
})();
