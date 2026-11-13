// js/modules/expenses.js
(function () {

  async function render(container) {
    const session = auth.getSession();
    container.innerHTML = `
      <div class="card">
        <div class="card__header">
          <span class="card__title">Expenses — FY ${router.currentFY()}</span>
          <button class="btn btn--primary btn--sm" id="addExpenseBtn">+ Add Expense</button>
        </div>
        <div class="card__body" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Date</th><th>Category</th><th>Description</th>
                ${session.gstRegistered ? '<th>GST</th>' : ''}
                <th>Amount</th><th>Actions</th>
              </tr></thead>
              <tbody id="expBody">
                <tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
              </tbody>
              <tfoot id="expFoot"></tfoot>
            </table>
          </div>
        </div>
      </div>
      ${_modalHTML(session.gstRegistered)}`;

    document.getElementById('addExpenseBtn').addEventListener('click', () => openExpModal(null));
    _load(session.gstRegistered);
  }

  async function _load(gst) {
    let data;
    try { data = await api.callClientScript('get_expenses', { fy: router.currentFY() }); }
    catch { document.getElementById('expBody').innerHTML = '<tr><td colspan="6" style="color:var(--danger);padding:1rem">Failed to load.</td></tr>'; return; }

    const rows = data.expenses || [];
    const tbody = document.getElementById('expBody');
    const tfoot = document.getElementById('expFoot');
    const f = n => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});

    if (!rows.length) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state__icon">↓</div><div class="empty-state__text">No expenses recorded.</div></div></td></tr>`; tfoot.innerHTML = ''; return; }

    tbody.innerHTML = rows.map(e => `<tr>
      <td>${e.date}</td>
      <td><span class="badge badge--gray">${e.category||'—'}</span></td>
      <td>${e.description}</td>
      ${gst ? `<td>₹${f(e.gst_amount)}</td>` : ''}
      <td><strong>₹${f(e.amount)}</strong></td>
      <td><button class="btn btn--outline btn--sm" onclick='openExpModal(${JSON.stringify(e)})'>Edit</button></td>
    </tr>`).join('');

    const tot = rows.reduce((a,r)=>a+Number(r.amount||0),0);
    tfoot.innerHTML = `<tr style="font-weight:700;background:#f8fafc"><td colspan="${gst?3:3}">Total</td>${gst?'<td></td>':''}<td>₹${f(tot)}</td><td></td></tr>`;
  }

  function openExpModal(exp) {
    document.getElementById('exp_id').value          = exp ? (exp.expense_id||'') : '';
    document.getElementById('exp_date').value        = exp ? (exp.date||'') : new Date().toISOString().split('T')[0];
    document.getElementById('exp_category').value    = exp ? (exp.category||'') : '';
    document.getElementById('exp_description').value = exp ? (exp.description||'') : '';
    document.getElementById('exp_amount').value      = exp ? (exp.amount||'') : '';
    const gEl = document.getElementById('exp_gst');
    if (gEl) gEl.value = exp ? (exp.gst_amount||'') : '';
    document.getElementById('expModal').classList.add('open');
  }
  window.openExpModal = openExpModal;

  document.addEventListener('click', async e => {
    if (e.target.id !== 'saveExpBtn') return;
    const btn = e.target; btn.disabled=true; btn.textContent='Saving…';
    const gEl = document.getElementById('exp_gst');
    const expense = {
      expense_id:  document.getElementById('exp_id').value||null,
      date:        document.getElementById('exp_date').value,
      category:    document.getElementById('exp_category').value.trim(),
      description: document.getElementById('exp_description').value.trim(),
      amount:      Number(document.getElementById('exp_amount').value)||0,
      gst_amount:  gEl ? Number(gEl.value)||0 : 0,
    };
    if (!expense.description) { api.showToast('Description required','error'); btn.disabled=false; btn.textContent='Save'; return; }
    try {
      await api.callClientScript('save_expense',{expense});
      document.getElementById('expModal').classList.remove('open');
      api.showToast('Expense saved');
      _load(auth.getSession().gstRegistered);
    } catch(err) { api.showToast('Save failed: '+err.message,'error'); }
    btn.disabled=false; btn.textContent='Save';
  });

  function _modalHTML(gst) {
    return `<div class="modal-backdrop" id="expModal">
      <div class="modal">
        <div class="modal__header"><span class="modal__title">Expense</span>
          <button class="modal__close" onclick="document.getElementById('expModal').classList.remove('open')">×</button></div>
        <div class="modal__body">
          <input type="hidden" id="exp_id">
          <div class="form-row">
            <div class="form-field"><label>Date</label><input type="date" id="exp_date"></div>
            <div class="form-field"><label>Category</label><input id="exp_category" placeholder="e.g. Travel, Office"></div>
          </div>
          <div class="form-row--1 form-field" style="margin-bottom:.9rem"><label>Description *</label><input id="exp_description" placeholder="Expense description"></div>
          <div class="form-row">
            <div class="form-field"><label>Amount (₹)</label><input type="number" id="exp_amount" step="0.01" placeholder="0.00"></div>
            ${gst ? '<div class="form-field"><label>GST Amount (₹)</label><input type="number" id="exp_gst" step="0.01" placeholder="0.00"></div>' : '<div></div>'}
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" onclick="document.getElementById('expModal').classList.remove('open')">Cancel</button>
          <button class="btn btn--primary" id="saveExpBtn">Save</button>
        </div>
      </div>
    </div>`;
  }

  router.register('expenses', render);
})();
