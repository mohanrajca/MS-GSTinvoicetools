// js/modules/payments.js
(function () {

  async function render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card__header">
          <span class="card__title">Payments — FY ${router.currentFY()}</span>
          <button class="btn btn--primary btn--sm" id="addPaymentBtn">+ Add Payment</button>
        </div>
        <div class="card__body" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Payment No</th><th>Date</th><th>Supplier/Payee</th><th>Purpose</th><th>Amount</th><th>Mode</th><th>Actions</th></tr></thead>
              <tbody id="pmtBody"><tr><td colspan="7"><div class="loading-spinner"><div class="spinner"></div></div></td></tr></tbody>
              <tfoot id="pmtFoot"></tfoot>
            </table>
          </div>
        </div>
      </div>
      ${_modalHTML()}`;

    document.getElementById('addPaymentBtn').addEventListener('click', () => openPmtModal(null));
    _load();
  }

  async function _load() {
    let data;
    try { data = await api.callClientScript('get_payments', { fy: router.currentFY() }); }
    catch { document.getElementById('pmtBody').innerHTML = '<tr><td colspan="7" style="color:var(--danger);padding:1rem">Failed to load.</td></tr>'; return; }

    const rows = data.payments || [];
    const tbody = document.getElementById('pmtBody');
    const tfoot = document.getElementById('pmtFoot');
    const f = n => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});

    if (!rows.length) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state__icon">$</div><div class="empty-state__text">No payments recorded.</div></div></td></tr>`; tfoot.innerHTML=''; return; }

    tbody.innerHTML = rows.map(p => `<tr>
      <td><strong>${p.payment_no}</strong></td>
      <td>${p.date}</td>
      <td>${p.payee}</td>
      <td>${p.purpose||'—'}</td>
      <td><strong>₹${f(p.amount)}</strong></td>
      <td><span class="badge badge--blue">${p.mode||'—'}</span></td>
      <td><button class="btn btn--outline btn--sm" onclick='openPmtModal(${JSON.stringify(p)})'>Edit</button></td>
    </tr>`).join('');

    const tot = rows.reduce((a,r)=>a+Number(r.amount||0),0);
    tfoot.innerHTML = `<tr style="font-weight:700;background:#f8fafc"><td colspan="4">Total</td><td>₹${f(tot)}</td><td colspan="2"></td></tr>`;
  }

  function openPmtModal(pmt) {
    ['payment_no','date','payee','purpose','amount','mode'].forEach(f=>{
      const el = document.getElementById('pmt_'+f);
      if(el) el.value = pmt ? (pmt[f]||'') : (f==='date'?new Date().toISOString().split('T')[0]:'');
    });
    document.getElementById('pmt_id').value = pmt ? (pmt.payment_id||'') : '';
    document.getElementById('pmtModal').classList.add('open');
  }
  window.openPmtModal = openPmtModal;

  document.addEventListener('click', async e => {
    if (e.target.id !== 'savePmtBtn') return;
    const btn = e.target; btn.disabled=true; btn.textContent='Saving…';
    const payment = {
      payment_id: document.getElementById('pmt_id').value||null,
      payment_no: document.getElementById('pmt_payment_no').value.trim(),
      date:       document.getElementById('pmt_date').value,
      payee:      document.getElementById('pmt_payee').value.trim(),
      purpose:    document.getElementById('pmt_purpose').value.trim(),
      amount:     Number(document.getElementById('pmt_amount').value)||0,
      mode:       document.getElementById('pmt_mode').value,
    };
    try {
      await api.callClientScript('save_payment',{payment});
      document.getElementById('pmtModal').classList.remove('open');
      api.showToast('Payment saved');
      _load();
    } catch(err) { api.showToast('Save failed: '+err.message,'error'); }
    btn.disabled=false; btn.textContent='Save';
  });

  function _modalHTML() {
    return `<div class="modal-backdrop" id="pmtModal">
      <div class="modal">
        <div class="modal__header"><span class="modal__title">Payment</span>
          <button class="modal__close" onclick="document.getElementById('pmtModal').classList.remove('open')">×</button></div>
        <div class="modal__body">
          <input type="hidden" id="pmt_id">
          <div class="form-row">
            <div class="form-field"><label>Payment No</label><input id="pmt_payment_no" placeholder="e.g. PAY-001"></div>
            <div class="form-field"><label>Date</label><input type="date" id="pmt_date"></div>
          </div>
          <div class="form-row">
            <div class="form-field"><label>Supplier / Payee</label><input id="pmt_payee" placeholder="Payee name"></div>
            <div class="form-field"><label>Purpose</label><input id="pmt_purpose" placeholder="e.g. Raw material"></div>
          </div>
          <div class="form-row">
            <div class="form-field"><label>Amount (₹)</label><input type="number" id="pmt_amount" step="0.01"></div>
            <div class="form-field"><label>Payment Mode</label>
              <select id="pmt_mode"><option>Cash</option><option>NEFT</option><option>RTGS</option><option>UPI</option><option>Cheque</option></select>
            </div>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" onclick="document.getElementById('pmtModal').classList.remove('open')">Cancel</button>
          <button class="btn btn--primary" id="savePmtBtn">Save</button>
        </div>
      </div>
    </div>`;
  }

  router.register('payments', render);
})();
