// js/modules/commission-tracker.js — SR Consultancy only
(function () {

  async function render(container) {
    const fy = router.currentFY();
    container.innerHTML = `
      <div class="card">
        <div class="card__header">
          <span class="card__title">Commission Tracker — FY ${fy}</span>
        </div>
        <div class="card__body" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Supplier</th><th>Supplier Invoices</th><th>MT Traded</th>
                <th>Rate/MT (₹)</th><th>Total Commission</th>
                <th>Billed (Supplier)</th><th>Billed (Buyer)</th><th>Pending</th><th></th>
              </tr></thead>
              <tbody id="commBody">
                <tr><td colspan="9"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
              </tbody>
              <tfoot id="commFoot"></tfoot>
            </table>
          </div>
        </div>
      </div>`;

    let data;
    try { data = await api.callClientScript('get_commission_summary', { fy }); }
    catch { document.getElementById('commBody').innerHTML = '<tr><td colspan="9" style="color:var(--danger);padding:1rem">Failed to load.</td></tr>'; return; }

    const rows = data.commission || [];
    const tbody = document.getElementById('commBody');
    const tfoot = document.getElementById('commFoot');
    const f = n => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-state__icon">⚖️</div><div class="empty-state__text">No commission data for this period.</div></div></td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${r.supplier}</strong><div style="font-size:.73rem;color:var(--text-muted)">${r.buyer||''}</div></td>
        <td>${r.supplier_inv_count || 0}</td>
        <td>${(r.mt||0).toFixed(3)}</td>
        <td>₹${f(r.rate_per_mt)}</td>
        <td><strong>₹${f(r.total_commission)}</strong></td>
        <td>${r.billed_supplier ? '<span class="badge badge--green">Billed</span>' : '<span class="badge badge--gray">No</span>'}</td>
        <td>${r.billed_buyer   ? '<span class="badge badge--green">Billed</span>' : '<span class="badge badge--gray">No</span>'}</td>
        <td><span class="badge ${r.pending > 0 ? 'badge--amber':'badge--green'}">₹${f(r.pending)}</span></td>
        <td>
          ${r.pending > 0
            ? `<button class="btn btn--primary btn--sm" onclick="raiseCommissionInvoice('${r.supplier}')">Raise Invoice</button>`
            : ''}
        </td>
      </tr>`).join('');

    // Totals
    const tot = rows.reduce((a,r)=>({mt:a.mt+(r.mt||0), total:a.total+(r.total_commission||0), pending:a.pending+(r.pending||0)}),{mt:0,total:0,pending:0});
    tfoot.innerHTML = `<tr style="font-weight:700;background:#f8fafc">
      <td>Total</td><td></td>
      <td>${tot.mt.toFixed(3)}</td><td></td>
      <td>₹${f(tot.total)}</td><td></td><td></td>
      <td><span class="badge badge--amber">₹${f(tot.pending)}</span></td><td></td>
    </tr>`;
  }

  window.raiseCommissionInvoice = function(supplier) {
    router.loadModule('invoices');
    setTimeout(() => document.dispatchEvent(new CustomEvent('openNewInvoice', { detail: { commissionParty: supplier } })), 150);
  };

  router.register('commission-tracker', render);
})();
