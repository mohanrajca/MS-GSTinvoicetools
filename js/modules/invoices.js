// js/modules/invoices.js
(function () {

  let _invoices = [];

  async function render(container) {
    const session = auth.getSession();
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <div></div>
        <button class="btn btn--primary" id="newInvoiceBtnLocal">+ New Invoice</button>
      </div>
      <div class="card">
        <div class="card__header">
          <span class="card__title">Invoices — FY ${router.currentFY()}</span>
          <input type="text" id="invoiceSearch" placeholder="Search invoice…" style="padding:.35rem .7rem;border:1.5px solid var(--border);border-radius:7px;font-size:.82rem;width:200px">
        </div>
        <div class="card__body" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Invoice No</th><th>Date</th><th>Customer</th>
                <th>Taxable</th>
                ${session.gstRegistered ? '<th>GST</th>' : ''}
                <th>Total</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody id="invoicesBody">
                <tr><td colspan="8"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="modal-backdrop" id="invoiceFormModal">
        <div class="modal modal--wide">
          <div class="modal__header">
            <span class="modal__title" id="invoiceFormTitle">New Invoice</span>
            <button class="modal__close" onclick="document.getElementById('invoiceFormModal').classList.remove('open')">×</button>
          </div>
          <div class="modal__body" id="invoice-form-container">
            <div class="loading-spinner"><div class="spinner"></div> Loading form…</div>
          </div>
        </div>
      </div>`;

    document.getElementById('newInvoiceBtnLocal').addEventListener('click', () => openNewInvoice());
    document.addEventListener('openNewInvoice', e => openNewInvoice(e.detail), { once: true });
    document.getElementById('invoiceSearch').addEventListener('input', e => _filterTable(e.target.value));
    _loadList(session);
  }

  async function _loadList(session) {
    let data;
    try { data = await api.callClientScript('get_invoices', { fy: router.currentFY() }); }
    catch { document.getElementById('invoicesBody').innerHTML = '<tr><td colspan="8" style="color:var(--danger);padding:1rem">Failed to load.</td></tr>'; return; }

    _invoices = data.invoices || [];
    _renderTable(_invoices, session);
  }

  function _renderTable(invoices, session) {
    const tbody = document.getElementById('invoicesBody');
    if (!tbody) return;
    if (!invoices.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state__icon">🧾</div><div class="empty-state__text">No invoices for this period.</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = invoices.map(inv => {
      const statusBadge = {
        'paid':    '<span class="badge badge--green">Paid</span>',
        'partial': '<span class="badge badge--amber">Partial</span>',
        'unpaid':  '<span class="badge badge--red">Unpaid</span>',
      }[inv.status] || '<span class="badge badge--gray">—</span>';

      return `<tr>
        <td><strong>${inv.invoice_no}</strong></td>
        <td>${inv.date}</td>
        <td>${inv.customer_name}</td>
        <td>₹${Number(inv.taxable||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
        ${session.gstRegistered ? `<td>₹${Number(inv.gst_amount||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</td>` : ''}
        <td><strong>₹${Number(inv.total||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</strong></td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn--outline btn--sm" onclick='openEditInvoice(${JSON.stringify(inv)})'>Edit</button>
        </td>
      </tr>`;
    }).join('');
  }

  function _filterTable(q) {
    const session = auth.getSession();
    const filtered = q
      ? _invoices.filter(i => (i.invoice_no+i.customer_name+i.date).toLowerCase().includes(q.toLowerCase()))
      : _invoices;
    _renderTable(filtered, session);
  }

  function openNewInvoice(detail) {
    const modal = document.getElementById('invoiceFormModal');
    document.getElementById('invoiceFormTitle').textContent = 'New Invoice';
    modal.classList.add('open');
    invoiceFormat.renderInvoiceForm('invoice-form-container', null, detail);
  }
  window.openEditInvoice = function(inv) {
    const modal = document.getElementById('invoiceFormModal');
    document.getElementById('invoiceFormTitle').textContent = 'Edit Invoice';
    modal.classList.add('open');
    invoiceFormat.renderInvoiceForm('invoice-form-container', inv, null);
  };

  router.register('invoices', render);
})();
