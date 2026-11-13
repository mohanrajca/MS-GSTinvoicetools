// js/modules/settings.js
(function () {

  async function render(container) {
    const session = auth.getSession();
    const cfg = await invoiceFormat.getConfig();
    const opt = cfg.optionalColumns || {};
    const isOwner = session.role === 'owner' || session.role === 'admin-user';
    const isStandard = cfg.invoiceType !== 'commission';

    container.innerHTML = `
      <div style="max-width:600px">

        <!-- Invoice Format — only for standard clients, only for owner role -->
        ${isStandard && isOwner ? `
        <div class="card" style="margin-bottom:1rem">
          <div class="card__header">
            <span class="card__title">Invoice Format</span>
            <span class="badge badge--blue">${cfg.invoiceType === 'standard' ? 'Standard Invoice' : 'Commission Invoice'}</span>
          </div>
          <div class="card__body">
            <p style="font-size:.82rem;color:var(--text-secondary);margin-bottom:1rem">
              Toggle optional columns for your invoices. Changes apply immediately to new invoices.
            </p>

            <div class="toggle-row">
              <div class="toggle-label">
                Discount Column
                <small>Show a per-line discount (%) column on invoices</small>
              </div>
              <label class="toggle">
                <input type="checkbox" id="col_discount" ${opt.discount ? 'checked' : ''}>
                <span class="toggle__track"></span>
              </label>
            </div>

            <div class="toggle-row">
              <div class="toggle-label">
                Tonnage / MT Quantity
                <small>Relabel Qty column as "Qty (MT)" for commodity trading</small>
              </div>
              <label class="toggle">
                <input type="checkbox" id="col_tonnage" ${opt.tonnage ? 'checked' : ''}>
                <span class="toggle__track"></span>
              </label>
            </div>

            <div class="toggle-row">
              <div class="toggle-label">
                Narration Column
                <small>Free-text note per line item</small>
              </div>
              <label class="toggle">
                <input type="checkbox" id="col_narration" ${opt.narration ? 'checked' : ''}>
                <span class="toggle__track"></span>
              </label>
            </div>

            <div class="toggle-row">
              <div class="toggle-label">
                PO Reference
                <small>Buyer's purchase order number on invoice header</small>
              </div>
              <label class="toggle">
                <input type="checkbox" id="col_po_ref" ${opt.po_ref ? 'checked' : ''}>
                <span class="toggle__track"></span>
              </label>
            </div>

            <div class="toggle-row" style="border-bottom:none">
              <div class="toggle-label">
                Vehicle Number
                <small>Vehicle no. on invoice header (transport/logistics)</small>
              </div>
              <label class="toggle">
                <input type="checkbox" id="col_vehicle_no" ${opt.vehicle_no ? 'checked' : ''}>
                <span class="toggle__track"></span>
              </label>
            </div>

            <div style="margin-top:1.25rem">
              <button class="btn btn--primary" id="saveFormatBtn">Save Format</button>
            </div>
          </div>
        </div>` : (cfg.invoiceType === 'commission' ? `
        <div class="card" style="margin-bottom:1rem">
          <div class="card__header"><span class="card__title">Invoice Format</span></div>
          <div class="card__body">
            <p style="font-size:.85rem;color:var(--text-secondary)">
              Your account uses <strong>Commission Invoice</strong> format. The format is fixed and managed by your administrator.
            </p>
          </div>
        </div>` : '')}

        <!-- Firm Details -->
        <div class="card">
          <div class="card__header"><span class="card__title">Firm Details</span>
            <span style="font-size:.75rem;color:var(--text-muted)">Shown on invoices</span>
          </div>
          <div class="card__body">
            <div class="form-row--1 form-field" style="margin-bottom:.9rem">
              <label>Firm / Business Name</label>
              <input id="firm_name" placeholder="Your business name" value="">
            </div>
            <div class="form-row--1 form-field" style="margin-bottom:.9rem">
              <label>Address</label>
              <textarea id="firm_address" rows="3" placeholder="Full address for invoices"></textarea>
            </div>
            <div class="form-row">
              <div class="form-field"><label>GSTIN</label><input id="firm_gstin" placeholder="Your GSTIN" style="text-transform:uppercase"></div>
              <div class="form-field"><label>Phone</label><input id="firm_phone" placeholder="Contact number"></div>
            </div>
            <div class="form-row--1 form-field" style="margin-bottom:.9rem">
              <label>Email</label>
              <input type="email" id="firm_email" placeholder="contact@yourfirm.com">
            </div>
            <button class="btn btn--primary" id="saveFirmBtn">Save Details</button>
          </div>
        </div>

        <!-- Account Info -->
        <div class="card" style="margin-top:1rem">
          <div class="card__header"><span class="card__title">Account</span></div>
          <div class="card__body">
            <div style="display:flex;justify-content:space-between;padding:.5rem 0;font-size:.85rem;border-bottom:1px solid #f1f5f9">
              <span style="color:var(--text-secondary)">Username</span>
              <strong>${session.userName}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:.5rem 0;font-size:.85rem;border-bottom:1px solid #f1f5f9">
              <span style="color:var(--text-secondary)">Role</span>
              <span class="badge badge--blue">${session.role}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:.5rem 0;font-size:.85rem;border-bottom:1px solid #f1f5f9">
              <span style="color:var(--text-secondary)">Client</span>
              <strong>${session.clientName}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:.5rem 0;font-size:.85rem">
              <span style="color:var(--text-secondary)">GST Status</span>
              <span class="badge ${session.gstRegistered ? 'badge--green':'badge--gray'}">${session.gstRegistered ? 'Registered' : 'Unregistered'}</span>
            </div>
            <div style="margin-top:1rem">
              <button class="btn btn--outline" onclick="if(confirm('Sign out?')) auth.logout()">Sign Out</button>
            </div>
          </div>
        </div>
      </div>`;

    // Load firm details
    _loadFirmDetails();

    // Save format
    const saveFormatBtn = document.getElementById('saveFormatBtn');
    if (saveFormatBtn) {
      saveFormatBtn.addEventListener('click', async () => {
        saveFormatBtn.disabled = true; saveFormatBtn.textContent = 'Saving…';
        const columns = {
          discount:   document.getElementById('col_discount')?.checked  || false,
          tonnage:    document.getElementById('col_tonnage')?.checked   || false,
          narration:  document.getElementById('col_narration')?.checked || false,
          po_ref:     document.getElementById('col_po_ref')?.checked    || false,
          vehicle_no: document.getElementById('col_vehicle_no')?.checked|| false,
        };
        try {
          await invoiceFormat.saveColumnConfig(columns);
          api.showToast('Invoice format saved');
        } catch(err) { api.showToast('Save failed: '+err.message,'error'); }
        saveFormatBtn.disabled = false; saveFormatBtn.textContent = 'Save Format';
      });
    }

    // Save firm details
    document.getElementById('saveFirmBtn').addEventListener('click', async () => {
      const btn = document.getElementById('saveFirmBtn');
      btn.disabled = true; btn.textContent = 'Saving…';
      const firm = {
        name:    document.getElementById('firm_name').value.trim(),
        address: document.getElementById('firm_address').value.trim(),
        gstin:   document.getElementById('firm_gstin').value.trim().toUpperCase(),
        phone:   document.getElementById('firm_phone').value.trim(),
        email:   document.getElementById('firm_email').value.trim(),
      };
      try {
        await api.callClientScript('save_firm_details', { firm });
        api.showToast('Firm details saved');
      } catch(err) { api.showToast('Save failed: '+err.message,'error'); }
      btn.disabled = false; btn.textContent = 'Save Details';
    });
  }

  async function _loadFirmDetails() {
    try {
      const res = await api.callClientScript('get_firm_details', {});
      if (res.firm) {
        const f = res.firm;
        document.getElementById('firm_name').value    = f.name    || '';
        document.getElementById('firm_address').value = f.address || '';
        document.getElementById('firm_gstin').value   = f.gstin   || '';
        document.getElementById('firm_phone').value   = f.phone   || '';
        document.getElementById('firm_email').value   = f.email   || '';
      }
    } catch { /* ignore */ }
  }

  router.register('settings', render);
})();
