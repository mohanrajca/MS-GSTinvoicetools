// js/modules/customers.js
(function () {

  async function render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card__header">
          <span class="card__title">Customers</span>
          <button class="btn btn--primary btn--sm" id="addCustomerBtn">+ Add Customer</button>
        </div>
        <div class="card__body" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Name</th><th>GSTIN</th><th>State</th><th>Contact</th><th>Type</th><th>Actions</th>
              </tr></thead>
              <tbody id="customersBody">
                <tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ${_modalHTML()}`;

    document.getElementById('addCustomerBtn').addEventListener('click', () => openModal(null));
    _loadList();
  }

  async function _loadList() {
    let data;
    try { data = await api.callClientScript('get_customers', {}); }
    catch { document.getElementById('customersBody').innerHTML = '<tr><td colspan="6" style="color:var(--danger);padding:1rem">Failed to load customers.</td></tr>'; return; }

    const tbody = document.getElementById('customersBody');
    if (!data.customers || !data.customers.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state__icon">👥</div><div class="empty-state__text">No customers yet. Add your first customer.</div></div></td></tr>';
      return;
    }
    tbody.innerHTML = data.customers.map(c => `
      <tr>
        <td><strong>${c.name}</strong><div style="font-size:.73rem;color:var(--text-muted)">${c.email||''}</div></td>
        <td><code style="font-size:.78rem">${c.gstin || '—'}</code></td>
        <td>${c.state || '—'}</td>
        <td>${c.phone || '—'}</td>
        <td><span class="badge ${c.gstin ? 'badge--blue' : 'badge--gray'}">${c.gstin ? 'Registered' : 'Unregistered'}</span></td>
        <td>
          <button class="btn btn--outline btn--sm" onclick='openCustomerModal(${JSON.stringify(c)})'>Edit</button>
        </td>
      </tr>`).join('');
  }

  function openModal(customer) {
    const modal = document.getElementById('customerModal');
    const title = document.getElementById('customerModalTitle');
    title.textContent = customer ? 'Edit Customer' : 'Add Customer';
    ['name','gstin','address','state','phone','email'].forEach(f => {
      const el = document.getElementById('cust_' + f);
      if (el) el.value = customer ? (customer[f] || '') : '';
    });
    document.getElementById('cust_id').value = customer ? (customer.customer_id || '') : '';
    modal.classList.add('open');
  }
  window.openCustomerModal = openModal;

  function _modalHTML() {
    return `
    <div class="modal-backdrop" id="customerModal">
      <div class="modal">
        <div class="modal__header">
          <span class="modal__title" id="customerModalTitle">Add Customer</span>
          <button class="modal__close" onclick="document.getElementById('customerModal').classList.remove('open')">×</button>
        </div>
        <div class="modal__body">
          <input type="hidden" id="cust_id">
          <div class="form-row">
            <div class="form-field"><label>Name *</label><input id="cust_name" placeholder="Customer name"></div>
            <div class="form-field"><label>GSTIN <span style="color:var(--text-muted);font-weight:400">(leave blank if unregistered)</span></label><input id="cust_gstin" placeholder="15-digit GSTIN" maxlength="15" style="text-transform:uppercase"></div>
          </div>
          <div class="form-row--1 form-field" style="margin-bottom:.9rem"><label>Address</label><textarea id="cust_address" rows="2" placeholder="Billing address"></textarea></div>
          <div class="form-row">
            <div class="form-field"><label>State</label><input id="cust_state" placeholder="e.g. Tamil Nadu"></div>
            <div class="form-field"><label>Phone</label><input id="cust_phone" placeholder="Contact number"></div>
          </div>
          <div class="form-row--1 form-field" style="margin-bottom:0"><label>Email</label><input id="cust_email" type="email" placeholder="Email address"></div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" onclick="document.getElementById('customerModal').classList.remove('open')">Cancel</button>
          <button class="btn btn--primary" id="saveCustomerBtn">Save Customer</button>
        </div>
      </div>
    </div>`;
  }

  document.addEventListener('click', async e => {
    if (e.target.id !== 'saveCustomerBtn') return;
    const btn = e.target;
    btn.disabled = true; btn.textContent = 'Saving…';
    const customer = {
      customer_id: document.getElementById('cust_id').value || null,
      name:    document.getElementById('cust_name').value.trim(),
      gstin:   document.getElementById('cust_gstin').value.trim().toUpperCase(),
      address: document.getElementById('cust_address').value.trim(),
      state:   document.getElementById('cust_state').value.trim(),
      phone:   document.getElementById('cust_phone').value.trim(),
      email:   document.getElementById('cust_email').value.trim(),
    };
    if (!customer.name) { api.showToast('Customer name is required', 'error'); btn.disabled=false; btn.textContent='Save Customer'; return; }
    try {
      await api.callClientScript('save_customer', { customer });
      document.getElementById('customerModal').classList.remove('open');
      api.showToast('Customer saved');
      _loadList();
    } catch (err) {
      api.showToast('Save failed: ' + err.message, 'error');
    }
    btn.disabled=false; btn.textContent='Save Customer';
  });

  router.register('customers', render);
})();
