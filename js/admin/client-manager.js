// js/admin/client-manager.js
const clientManager = (() => {

  async function render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card__header">
          <span class="card__title">Clients</span>
          <button class="btn btn--primary btn--sm" id="addClientBtn">+ Add Client</button>
        </div>
        <div class="card__body" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Client ID</th><th>Name</th><th>Invoice Type</th><th>GST</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody id="clientsBody">
                <tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ${_modalHTML()}`;

    document.getElementById('addClientBtn').addEventListener('click', () => openClientModal(null));
    _load();
  }

  async function _load() {
    const session = auth.getSession();
    let data;
    try { data = await api.callMasterScript('get_clients', { token: session.token }); }
    catch { document.getElementById('clientsBody').innerHTML = '<tr><td colspan="6" style="color:var(--danger);padding:1rem">Failed to load.</td></tr>'; return; }

    const rows = data.clients || [];
    const tbody = document.getElementById('clientsBody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state__text">No clients yet. Add your first client.</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(c => `
      <tr>
        <td><code style="font-size:.78rem">${c.client_id}</code></td>
        <td><strong>${c.client_name}</strong></td>
        <td><span class="badge ${c.invoice_type==='commission'?'badge--amber':'badge--blue'}">${c.invoice_type==='commission'?'Commission':'Standard'}</span></td>
        <td><span class="badge ${c.gst_registered?'badge--green':'badge--gray'}">${c.gst_registered?'Registered':'Unregistered'}</span></td>
        <td><span class="badge ${c.active?'badge--green':'badge--red'}">${c.active?'Active':'Disabled'}</span></td>
        <td style="display:flex;gap:.4rem">
          <button class="btn btn--outline btn--sm" onclick='openClientModal(${JSON.stringify(c)})'>Edit</button>
          <button class="btn btn--outline btn--sm" onclick="userManager.renderForClient('${c.client_id}','${c.client_name}')">Users</button>
          <button class="btn btn--outline btn--sm" onclick="toggleClient('${c.client_id}')">${c.active?'Disable':'Enable'}</button>
        </td>
      </tr>`).join('');
  }

  function openClientModal(client) {
    document.getElementById('cl_id').value           = client ? (client.client_id || '') : '';
    document.getElementById('cl_name').value         = client ? (client.client_name || '') : '';
    document.getElementById('cl_script_url').value   = client ? (client.script_url || '') : '';
    document.getElementById('cl_invoice_standard').checked  = !client || client.invoice_type !== 'commission';
    document.getElementById('cl_invoice_commission').checked = client && client.invoice_type === 'commission';
    document.getElementById('cl_gst_yes').checked = !client || client.gst_registered;
    document.getElementById('cl_gst_no').checked  = client && !client.gst_registered;
    document.getElementById('cl_active').checked  = !client || client.active;
    document.getElementById('clientModal').classList.add('open');
  }
  window.openClientModal = openClientModal;

  window.toggleClient = async function(clientId) {
    const session = auth.getSession();
    try {
      await api.callMasterScript('toggle_client', { token: session.token, client_id: clientId });
      api.showToast('Client status updated');
      _load();
    } catch(err) { api.showToast('Failed: '+err.message,'error'); }
  };

  document.addEventListener('click', async e => {
    if (e.target.id !== 'saveClientBtn') return;
    const btn = e.target; btn.disabled=true; btn.textContent='Saving…';
    const session = auth.getSession();
    const client = {
      client_id:      document.getElementById('cl_id').value || null,
      client_name:    document.getElementById('cl_name').value.trim(),
      script_url:     document.getElementById('cl_script_url').value.trim(),
      invoice_type:   document.getElementById('cl_invoice_commission').checked ? 'commission' : 'standard',
      gst_registered: document.getElementById('cl_gst_yes').checked,
      active:         document.getElementById('cl_active').checked,
    };
    if (!client.client_name) { api.showToast('Client name required','error'); btn.disabled=false; btn.textContent='Save'; return; }
    if (!client.script_url)  { api.showToast('Script URL required','error');  btn.disabled=false; btn.textContent='Save'; return; }
    try {
      await api.callMasterScript('save_client', { token: session.token, client });
      document.getElementById('clientModal').classList.remove('open');
      api.showToast('Client saved');
      _load();
    } catch(err) { api.showToast('Save failed: '+err.message,'error'); }
    btn.disabled=false; btn.textContent='Save';
  });

  function _modalHTML() {
    return `
    <div class="modal-backdrop" id="clientModal">
      <div class="modal">
        <div class="modal__header">
          <span class="modal__title">Client</span>
          <button class="modal__close" onclick="document.getElementById('clientModal').classList.remove('open')">×</button>
        </div>
        <div class="modal__body">
          <input type="hidden" id="cl_id">
          <div class="form-row--1 form-field" style="margin-bottom:.9rem"><label>Client Name *</label><input id="cl_name" placeholder="e.g. SR Consultancy"></div>
          <div class="form-row--1 form-field" style="margin-bottom:.9rem"><label>Apps Script URL *</label><input id="cl_script_url" placeholder="https://script.google.com/macros/s/…/exec"></div>
          <div style="margin-bottom:.9rem">
            <div style="font-size:.75rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem">Invoice Type</div>
            <label style="display:inline-flex;align-items:center;gap:.4rem;margin-right:1.5rem;cursor:pointer;font-size:.85rem">
              <input type="radio" name="invoiceType" id="cl_invoice_standard" value="standard" checked> Standard
            </label>
            <label style="display:inline-flex;align-items:center;gap:.4rem;cursor:pointer;font-size:.85rem">
              <input type="radio" name="invoiceType" id="cl_invoice_commission" value="commission"> Commission (Tonnage)
            </label>
          </div>
          <div style="margin-bottom:.9rem">
            <div style="font-size:.75rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem">GST Registration</div>
            <label style="display:inline-flex;align-items:center;gap:.4rem;margin-right:1.5rem;cursor:pointer;font-size:.85rem">
              <input type="radio" name="gstReg" id="cl_gst_yes" value="yes" checked> Registered (shows GST on invoices)
            </label>
            <label style="display:inline-flex;align-items:center;gap:.4rem;cursor:pointer;font-size:.85rem">
              <input type="radio" name="gstReg" id="cl_gst_no" value="no"> Unregistered (Bill of Supply, no GSTR-1)
            </label>
          </div>
          <label style="display:inline-flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.85rem">
            <input type="checkbox" id="cl_active" checked> Active
          </label>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" onclick="document.getElementById('clientModal').classList.remove('open')">Cancel</button>
          <button class="btn btn--primary" id="saveClientBtn">Save Client</button>
        </div>
      </div>
    </div>`;
  }

  return { render };
})();
