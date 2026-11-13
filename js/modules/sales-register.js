// js/modules/sales-register.js
(function () {

  async function render(container) {
    const session = auth.getSession();
    const gst = session.gstRegistered;

    container.innerHTML = `
      <div class="card">
        <div class="card__header">
          <span class="card__title">Sales Register — FY ${router.currentFY()}</span>
          <div style="display:flex;gap:.5rem;align-items:center">
            <select id="srMonthFilter" class="fy-selector" style="font-size:.8rem">
              <option value="">All Months</option>
              ${['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'].map(m=>`<option value="${m}">${m}</option>`).join('')}
            </select>
            ${gst ? `
            <div class="dropdown" id="exportDropdown">
              <button class="btn btn--outline btn--sm" id="exportBtn">↓ Export ▾</button>
              <div class="dropdown__menu" id="exportMenu">
                <div class="dropdown__item" data-export="sr-excel">📊 Sales Register Excel</div>
                <div class="dropdown__item" data-export="sr-json">{ } Sales Register JSON</div>
                <div class="dropdown__divider"></div>
                <div class="dropdown__item" data-export="b2b-excel">📊 GSTR-1 B2B Excel</div>
                <div class="dropdown__item" data-export="b2b-json">{ } GSTR-1 B2B JSON</div>
                <div class="dropdown__item" data-export="b2cs-excel">📊 GSTR-1 B2CS Excel</div>
                <div class="dropdown__item" data-export="b2cs-json">{ } GSTR-1 B2CS JSON</div>
                <div class="dropdown__item" data-export="doc-excel">📊 Doc Summary Excel</div>
                <div class="dropdown__item" data-export="doc-json">{ } Doc Summary JSON</div>
                <div class="dropdown__item" data-export="hsn-excel">📊 HSN Summary Excel</div>
                <div class="dropdown__item" data-export="hsn-json">{ } HSN Summary JSON</div>
                <div class="dropdown__divider"></div>
                <div class="dropdown__item" data-export="all">📦 Export All</div>
              </div>
            </div>` : ''}
          </div>
        </div>
        <div class="card__body" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Invoice No</th><th>Date</th><th>Customer</th>
                ${gst ? '<th>GSTIN</th>' : ''}
                <th>Taxable</th>
                ${gst ? '<th>CGST</th><th>SGST</th><th>IGST</th>' : ''}
                <th>Total</th><th>Status</th>
              </tr></thead>
              <tbody id="srBody">
                <tr><td colspan="10"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
              </tbody>
              <tfoot id="srFoot"></tfoot>
            </table>
          </div>
        </div>
      </div>`;

    // Export dropdown toggle
    if (gst) {
      document.getElementById('exportBtn').addEventListener('click', e => {
        e.stopPropagation();
        document.getElementById('exportMenu').classList.toggle('open');
      });
      document.addEventListener('click', () => {
        const m = document.getElementById('exportMenu');
        if (m) m.classList.remove('open');
      });
      document.getElementById('exportMenu').addEventListener('click', async e => {
        const item = e.target.closest('[data-export]');
        if (!item) return;
        const type = item.dataset.export;
        const invoices = window._srInvoices || [];
        const fy = router.currentFY();
        const exportFns = {
          'sr-excel':  () => excelExport.salesRegister(invoices, fy),
          'sr-json':   () => jsonExport.salesRegister(invoices, fy),
          'b2b-excel': () => gstr1Export.b2bExcel(invoices, fy),
          'b2b-json':  () => gstr1Export.b2bJson(invoices, fy),
          'b2cs-excel':() => gstr1Export.b2csExcel(invoices, fy),
          'b2cs-json': () => gstr1Export.b2csJson(invoices, fy),
          'doc-excel': () => gstr1Export.docSummaryExcel(invoices, fy),
          'doc-json':  () => gstr1Export.docSummaryJson(invoices, fy),
          'hsn-excel': () => gstr1Export.hsnExcel(invoices, fy),
          'hsn-json':  () => gstr1Export.hsnJson(invoices, fy),
          'all':       async () => {
            const fns = ['sr-excel','sr-json','b2b-excel','b2b-json','b2cs-excel','b2cs-json','doc-excel','doc-json','hsn-excel','hsn-json'];
            for (const k of fns) { exportFns[k](); await new Promise(r=>setTimeout(r,250)); }
          },
        };
        if (exportFns[type]) { exportFns[type](); api.showToast('Export started'); }
      });
    }

    document.getElementById('srMonthFilter').addEventListener('change', e => _renderSR(window._srInvoices||[], e.target.value, gst));
    _loadSR(gst);
  }

  async function _loadSR(gst) {
    let data;
    try { data = await api.callClientScript('get_invoices', { fy: router.currentFY() }); }
    catch { document.getElementById('srBody').innerHTML = '<tr><td colspan="10" style="color:var(--danger);padding:1rem">Failed to load.</td></tr>'; return; }
    window._srInvoices = data.invoices || [];
    _renderSR(window._srInvoices, '', gst);
  }

  function _renderSR(invoices, monthFilter, gst) {
    const filtered = monthFilter
      ? invoices.filter(i => (i.date||'').includes(monthFilter))
      : invoices;

    const tbody = document.getElementById('srBody');
    const tfoot = document.getElementById('srFoot');
    if (!tbody) return;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="empty-state__text">No invoices for this period.</div></div></td></tr>`;
      tfoot.innerHTML = '';
      return;
    }

    const f = n => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});
    tbody.innerHTML = filtered.map(inv => `
      <tr>
        <td><strong>${inv.invoice_no}</strong></td>
        <td>${inv.date}</td>
        <td>${inv.customer_name}</td>
        ${gst ? `<td><code style="font-size:.75rem">${inv.customer_gstin||'—'}</code></td>` : ''}
        <td>₹${f(inv.taxable)}</td>
        ${gst ? `<td>₹${f(inv.cgst)}</td><td>₹${f(inv.sgst)}</td><td>₹${f(inv.igst)}</td>` : ''}
        <td><strong>₹${f(inv.total)}</strong></td>
        <td><span class="badge ${inv.status==='paid'?'badge--green':inv.status==='partial'?'badge--amber':'badge--red'}">${inv.status||'—'}</span></td>
      </tr>`).join('');

    // Totals row
    const totals = filtered.reduce((acc,inv) => {
      acc.taxable += Number(inv.taxable||0);
      acc.cgst    += Number(inv.cgst||0);
      acc.sgst    += Number(inv.sgst||0);
      acc.igst    += Number(inv.igst||0);
      acc.total   += Number(inv.total||0);
      return acc;
    }, {taxable:0,cgst:0,sgst:0,igst:0,total:0});

    tfoot.innerHTML = `<tr style="background:#f8fafc;font-weight:700">
      <td colspan="${gst?3:3}">Total (${filtered.length} invoices)</td>
      ${gst ? '<td></td>' : ''}
      <td>₹${f(totals.taxable)}</td>
      ${gst ? `<td>₹${f(totals.cgst)}</td><td>₹${f(totals.sgst)}</td><td>₹${f(totals.igst)}</td>` : ''}
      <td>₹${f(totals.total)}</td><td></td>
    </tr>`;
  }

  router.register('sales-register', render);
})();
