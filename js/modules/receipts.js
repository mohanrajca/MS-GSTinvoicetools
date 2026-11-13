// js/modules/receipts.js
(function () {

  async function render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card__header">
          <span class="card__title">Receipts — FY ${router.currentFY()}</span>
          <button class="btn btn--primary btn--sm" id="addReceiptBtn">+ Add Receipt</button>
        </div>
        <div class="card__body" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Receipt No</th><th>Date</th><th>Customer</th><th>Invoice Ref</th><th>Amount</th><th>Mode</th><th>Actions</th></tr></thead>
              <tbody id="rcptBody"><tr><td colspan="7"><div class="loading-spinner"><div class="spinner"></div></div></td></tr></tbody>
              <tfoot id="rcptFoot"></tfoot>
            </table>
          </div>
        </div>
      </div>
      ${_modalHTML()}`;

    document.getElementById('addReceiptBtn').addEventListener('click', () => openRcptModal(null));
    _load();
  }

  async function _load() {
    let data;
    try { data = await api.callClientScript('get_receipts', { fy: router.currentFY() }); }
    catch { document.getElementById('rcptBody').innerHTML = '<tr><td colspan="7" style="color:var(--danger);padding:1rem">Failed to load.</td></tr>'; return; }

    const rows = data.receipts || [];
    const tbody = document.getElementById('rcptBody');
    const tfoot = document.getElementById('rcptFoot');
    const f = n => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});

    if (!rows.length) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state__icon">🧾</div><div class="empty-state__text">No receipts recorded.</div></div></td></tr>`; tfoot.innerHTML=''; return; }

    tbody.innerHTML = rows.map(r => `<tr>
      <td><strong>${r.receipt_no}</strong></td>
      <td>${r.date}</td>
      <td>${r.customer_name}</td>
      <td>${r.invoice_no||'—'}</td>
      <td><strong>₹${f(r.amount)}</strong></td>
      <td><span class="badge badge--blue">${r.mode||'—'}</span></td>
      <td><button class="btn btn--outline btn--sm" onclick='openRcptModal(${JSON.stringify(r)})'>Edit</button></td>
    </tr>`).join('');

    const tot = rows.reduce((a,r)=>a+Number(r.amount||0),0);
    tfoot.innerHTML = `<tr style="font-weight:700;background:#f8fafc"><td colspan="4">Total</td><td>₹${f(tot)}</td><td colspan="2"></td></tr>`;
  }

  function openRcptModal(rcpt) {
    ['receipt_no','date','customer_name','invoice_no','amount','mode'].forEach(f=>{
      const el = document.getElementById('rc_'+f);
      if(el) el.value = rcpt ? (rcpt[f]||'') : (f==='date'?new Date().toISOString().split('T')[0]:'');
    });
    document.getElementById('rc_id').value = rcpt ? (rcpt.receipt_id||'') : '';
    document.getElementById('rcptModal').classList.add('open');
  }
  window.openRcptModal = openRcptModal;

  document.addEventListener('click', async e => {
    if (e.target.id !== 'saveRcptBtn') return;
    const btn = e.target; btn.disabled=true; btn.textContent='Saving…';
    const receipt = {
      receipt_id:    document.getElementById('rc_id').value||null,
      receipt_no:    document.getElementById('rc_receipt_no').value.trim(),
      date:          document.getElementById('rc_date').value,
      customer_name: document.getElementById('rc_customer_name').value.trim(),
      invoice_no:    document.getElementById('rc_invoice_no').value.trim(),
      amount:        Number(document.getElementById('rc_amount').value)||0,
      mode:          document.getElementById('rc_mode').value,
    };
    try {
      await api.callClientScript('save_receipt',{receipt});
      document.getElementById('rcptModal').classList.remove('open');
      api.showToast('Receipt saved');
      _load();
    } catch(err) { api.showToast('Save failed: '+err.message,'error'); }
    btn.disabled=false; btn.textContent='Save';
  });

  function _modalHTML() {
    return `<div class="modal-backdrop" id="rcptModal">
      <div class="modal">
        <div class="modal__header"><span class="modal__title">Receipt</span>
          <button class="modal__close" onclick="document.getElementById('rcptModal').classList.remove('open')">×</button></div>
        <div class="modal__body">
          <input type="hidden" id="rc_id">
          <div class="form-row">
            <div class="form-field"><label>Receipt No</label><input id="rc_receipt_no" placeholder="e.g. RCP-001"></div>
            <div class="form-field"><label>Date</label><input type="date" id="rc_date"></div>
          </div>
          <div class="form-row">
            <div class="form-field"><label>Customer</label><input id="rc_customer_name" placeholder="Customer name"></div>
            <div class="form-field"><label>Invoice Ref</label><input id="rc_invoice_no" placeholder="e.g. INV-001"></div>
          </div>
          <div class="form-row">
            <div class="form-field"><label>Amount (₹)</label><input type="number" id="rc_amount" step="0.01"></div>
            <div class="form-field"><label>Payment Mode</label>
              <select id="rc_mode"><option>Cash</option><option>NEFT</option><option>RTGS</option><option>UPI</option><option>Cheque</option></select>
            </div>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" onclick="document.getElementById('rcptModal').classList.remove('open')">Cancel</button>
          <button class="btn btn--primary" id="saveRcptBtn">Save</button>
        </div>
      </div>
    </div>`;
  }

  router.register('receipts', render);
})();
