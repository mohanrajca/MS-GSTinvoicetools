// js/invoice-format.js
// Invoice format engine: reads session flags + client config,
// renders the correct invoice form (Standard or Commission, GST or non-GST),
// applies optional column toggles for Standard type.

const invoiceFormat = (() => {

  // ── Config cache ─────────────────────────────────────────────────────────
  async function getConfig() {
    if (window._invoiceConfig) return window._invoiceConfig;
    const session = auth.getSession();
    let optionalColumns = { discount:false, tonnage:false, narration:false, po_ref:false, vehicle_no:false };
    try {
      const res = await api.callClientScript('get_invoice_config', {});
      if (res.ok && res.optionalColumns) optionalColumns = { ...optionalColumns, ...res.optionalColumns };
    } catch { /* use defaults */ }
    window._invoiceConfig = {
      invoiceType:     session.invoiceType   || 'standard',
      gstRegistered:   session.gstRegistered !== false,
      optionalColumns
    };
    return window._invoiceConfig;
  }

  // ── Save column config (client admin-user only) ──────────────────────────
  async function saveColumnConfig(columns) {
    await api.callClientScript('save_invoice_config', { columns });
    if (window._invoiceConfig) window._invoiceConfig.optionalColumns = { ...window._invoiceConfig.optionalColumns, ...columns };
  }

  // ── Render invoice form ───────────────────────────────────────────────────
  async function renderInvoiceForm(containerId, invoice, detail) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Building form…</div>';

    const cfg = await getConfig();

    // Load customers + products for pickers
    let customers = [], products = [];
    try {
      const [cr, pr] = await Promise.all([
        api.callClientScript('get_customers', {}),
        api.callClientScript('get_products', {})
      ]);
      customers = cr.customers || [];
      products  = pr.products  || [];
    } catch { /* continue with empty */ }

    if (cfg.invoiceType === 'commission') {
      _renderCommissionForm(container, invoice, customers, cfg, detail);
    } else {
      _renderStandardForm(container, invoice, customers, products, cfg, detail);
    }
  }

  // ── Standard invoice form ─────────────────────────────────────────────────
  function _renderStandardForm(container, invoice, customers, cfg, detail) {
    const inv = invoice || {};
    const opt = cfg.optionalColumns;
    const gst = cfg.gstRegistered;
    const today = new Date().toISOString().split('T')[0];

    container.innerHTML = `
      <div class="form-row">
        <div class="form-field"><label>Invoice No</label>
          <input id="if_inv_no" value="${inv.invoice_no||''}" placeholder="Auto-generated if blank"></div>
        <div class="form-field"><label>Date</label>
          <input type="date" id="if_date" value="${inv.date||today}"></div>
      </div>
      ${opt.po_ref ? `<div class="form-row--1 form-field" style="margin-bottom:.9rem"><label>PO Reference</label><input id="if_po_ref" value="${inv.po_ref||''}" placeholder="Buyer's PO number"></div>` : ''}
      ${opt.vehicle_no ? `<div class="form-row--1 form-field" style="margin-bottom:.9rem"><label>Vehicle No</label><input id="if_vehicle_no" value="${inv.vehicle_no||''}" placeholder="e.g. TN-01-AB-1234"></div>` : ''}

      <div class="form-row--1 form-field" style="margin-bottom:.9rem">
        <label>Customer *</label>
        <select id="if_customer">
          <option value="">— Select customer —</option>
          ${customers.map(c=>`<option value="${c.customer_id}" data-gstin="${c.gstin||''}" data-state="${c.state||''}" ${inv.customer_id===c.customer_id?'selected':''}>${c.name}${c.gstin?' ('+c.gstin+')':' (Unregistered)'}</option>`).join('')}
        </select>
      </div>
      ${gst ? `<div class="form-row" id="gstinRow">
        <div class="form-field"><label>Customer GSTIN</label><input id="if_customer_gstin" value="${inv.customer_gstin||''}" placeholder="Auto-filled from customer" readonly style="background:#f8fafc"></div>
        <div class="form-field"><label>Place of Supply</label><input id="if_pos" value="${inv.place_of_supply||''}" placeholder="State name"></div>
      </div>` : ''}

      <!-- Line items -->
      <div style="margin:1rem 0 .5rem;font-size:.8rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em">Line Items</div>
      <div class="table-wrap" style="margin-bottom:.75rem">
        <table>
          <thead><tr>
            <th>Description</th>
            <th>HSN/SAC</th>
            ${opt.narration ? '<th>Narration</th>' : ''}
            <th>${opt.tonnage ? 'Qty (MT)' : 'Qty'}</th>
            <th>UOM</th>
            <th>Rate (₹)</th>
            ${opt.discount ? '<th>Disc (%)</th>' : ''}
            <th>Amount (₹)</th>
            ${gst ? '<th>GST %</th><th>GST ₹</th>' : ''}
            <th></th>
          </tr></thead>
          <tbody id="if_items_body"></tbody>
        </table>
      </div>
      <button class="btn btn--outline btn--sm" id="if_add_line">+ Add Line</button>

      <!-- Totals -->
      <div style="display:flex;justify-content:flex-end;margin-top:1rem">
        <div style="width:280px">
          <div style="display:flex;justify-content:space-between;padding:.35rem 0;font-size:.85rem">
            <span>Subtotal (Taxable)</span>
            <strong id="if_subtotal">₹0.00</strong>
          </div>
          ${gst ? `
          <div style="display:flex;justify-content:space-between;padding:.35rem 0;font-size:.85rem" id="cgstRow">
            <span>CGST</span><strong id="if_cgst">₹0.00</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:.35rem 0;font-size:.85rem" id="sgstRow">
            <span>SGST</span><strong id="if_sgst">₹0.00</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:.35rem 0;font-size:.85rem;display:none" id="igstRow">
            <span>IGST</span><strong id="if_igst">₹0.00</strong>
          </div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:.5rem 0;font-size:1rem;font-weight:700;border-top:2px solid var(--border);margin-top:.35rem">
            <span>Grand Total</span>
            <strong id="if_total">₹0.00</strong>
          </div>
        </div>
      </div>

      <div class="modal__footer" style="padding:1rem 0 0;margin-top:.5rem">
        <button class="btn btn--outline" onclick="document.getElementById('invoiceFormModal').classList.remove('open')">Cancel</button>
        <button class="btn btn--outline" id="if_preview_btn">👁 Preview</button>
        <button class="btn btn--primary" id="if_save_btn">Save Invoice</button>
      </div>`;

    // ── Wire customer picker → auto-fill GSTIN ───────────────────────────
    if (gst) {
      document.getElementById('if_customer').addEventListener('change', function() {
        const opt = this.options[this.selectedIndex];
        document.getElementById('if_customer_gstin').value = opt.dataset.gstin || '';
        document.getElementById('if_pos').value = opt.dataset.state || '';
      });
    }

    // Existing line items or one blank row
    const items = (inv.items && inv.items.length) ? inv.items : [{}];
    items.forEach(item => _addLineRow(item, opt, gst));

    document.getElementById('if_add_line').addEventListener('click', () => _addLineRow({}, opt, gst));
    _recalcTotals(gst);

    // Save
    document.getElementById('if_save_btn').addEventListener('click', () => _saveInvoice(cfg));

    // Preview
    document.getElementById('if_preview_btn').addEventListener('click', () => {
      const inv = _collectInvoiceData(cfg);
      const preview = renderInvoicePreview(inv);
      _showPreviewModal(preview);
    });
  }

  function _addLineRow(item, opt, gst) {
    const tbody = document.getElementById('if_items_body');
    if (!tbody) return;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input class="li-desc" value="${item.description||''}" placeholder="Item description" style="width:140px;padding:.3rem .5rem;border:1.5px solid var(--border);border-radius:5px;font-size:.82rem"></td>
      <td><input class="li-hsn" value="${item.hsn_sac||''}" placeholder="HSN" style="width:70px;padding:.3rem .5rem;border:1.5px solid var(--border);border-radius:5px;font-size:.82rem"></td>
      ${opt.narration ? `<td><input class="li-narration" value="${item.narration||''}" placeholder="Note" style="width:100px;padding:.3rem .5rem;border:1.5px solid var(--border);border-radius:5px;font-size:.82rem"></td>` : ''}
      <td><input class="li-qty" type="number" value="${item.qty||''}" placeholder="0" style="width:60px;padding:.3rem .5rem;border:1.5px solid var(--border);border-radius:5px;font-size:.82rem"></td>
      <td><input class="li-uom" value="${item.uom||''}" placeholder="Nos" style="width:50px;padding:.3rem .5rem;border:1.5px solid var(--border);border-radius:5px;font-size:.82rem"></td>
      <td><input class="li-rate" type="number" step="0.01" value="${item.rate||''}" placeholder="0.00" style="width:80px;padding:.3rem .5rem;border:1.5px solid var(--border);border-radius:5px;font-size:.82rem"></td>
      ${opt.discount ? `<td><input class="li-disc" type="number" step="0.01" value="${item.discount||''}" placeholder="0" style="width:50px;padding:.3rem .5rem;border:1.5px solid var(--border);border-radius:5px;font-size:.82rem"></td>` : ''}
      <td><span class="li-amount" style="font-weight:600">₹0.00</span></td>
      ${gst ? `<td><select class="li-gst-rate" style="padding:.3rem .4rem;border:1.5px solid var(--border);border-radius:5px;font-size:.82rem"><option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18" selected>18%</option><option value="28">28%</option></select></td>
      <td><span class="li-gst-amt" style="font-weight:600">₹0.00</span></td>` : ''}
      <td><button type="button" class="btn btn--danger btn--sm li-del" style="padding:.2rem .4rem">×</button></td>`;

    // Set GST rate if provided
    if (gst && item.gst_rate) {
      const sel = row.querySelector('.li-gst-rate');
      if (sel) sel.value = String(item.gst_rate);
    }

    // Wire recalc
    row.querySelectorAll('input, select').forEach(el => el.addEventListener('input', () => _recalcTotals(gst)));
    row.querySelector('.li-del').addEventListener('click', () => { row.remove(); _recalcTotals(gst); });

    tbody.appendChild(row);
    _recalcRow(row, opt, gst);
  }

  function _recalcRow(row, opt, gst) {
    const qty  = Number(row.querySelector('.li-qty')?.value  || 0);
    const rate = Number(row.querySelector('.li-rate')?.value || 0);
    const disc = opt.discount ? Number(row.querySelector('.li-disc')?.value || 0) : 0;
    const amount = qty * rate * (1 - disc/100);
    const gstRate = gst ? Number(row.querySelector('.li-gst-rate')?.value || 0) : 0;
    const gstAmt  = amount * gstRate / 100;
    const amtEl = row.querySelector('.li-amount');
    const gstEl = row.querySelector('.li-gst-amt');
    if (amtEl) amtEl.textContent = '₹' + amount.toFixed(2);
    if (gstEl) gstEl.textContent = '₹' + gstAmt.toFixed(2);
    return { amount, gstAmt };
  }

  function _recalcTotals(gst) {
    const tbody = document.getElementById('if_items_body');
    if (!tbody) return;
    let subtotal = 0, totalGST = 0;
    const opt = window._invoiceConfig?.optionalColumns || {};
    tbody.querySelectorAll('tr').forEach(row => {
      const r = _recalcRow(row, opt, gst);
      subtotal  += r.amount;
      totalGST  += r.gstAmt;
    });
    const f = n => '₹' + n.toFixed(2);
    const sub = document.getElementById('if_subtotal'); if (sub) sub.textContent = f(subtotal);
    if (gst) {
      const cgst = document.getElementById('if_cgst'); if (cgst) cgst.textContent = f(totalGST/2);
      const sgst = document.getElementById('if_sgst'); if (sgst) sgst.textContent = f(totalGST/2);
    }
    const tot = document.getElementById('if_total'); if (tot) tot.textContent = f(subtotal + totalGST);
  }

  // ── Commission invoice form ───────────────────────────────────────────────
  function _renderCommissionForm(container, invoice, customers, cfg, detail) {
    const inv = invoice || {};
    const gst = cfg.gstRegistered;
    const today = new Date().toISOString().split('T')[0];
    const preSupplier = detail?.commissionParty || '';

    container.innerHTML = `
      <div class="form-row">
        <div class="form-field"><label>Invoice No</label><input id="if_inv_no" value="${inv.invoice_no||''}" placeholder="Auto-generated"></div>
        <div class="form-field"><label>Date</label><input type="date" id="if_date" value="${inv.date||today}"></div>
      </div>
      <div class="form-row--1 form-field" style="margin-bottom:.9rem">
        <label>Bill To (Customer) *</label>
        <select id="if_customer">
          <option value="">— Select —</option>
          ${customers.map(c=>`<option value="${c.customer_id}" ${inv.customer_id===c.customer_id?'selected':''}>${c.name}</option>`).join('')}
        </select>
      </div>

      <div style="margin:1rem 0 .5rem;font-size:.8rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em">Commission Lines</div>
      <div class="table-wrap" style="margin-bottom:.75rem">
        <table>
          <thead><tr>
            <th>Supplier Name</th><th>Supplier Invoice Ref</th>
            <th>MT Quantity</th><th>Rate/MT (₹)</th><th>Commission (₹)</th>
            <th>Billed Side</th><th></th>
          </tr></thead>
          <tbody id="if_comm_body"></tbody>
        </table>
      </div>
      <button class="btn btn--outline btn--sm" id="if_add_comm_line">+ Add Line</button>

      <div style="display:flex;justify-content:flex-end;margin-top:1rem">
        <div style="width:280px">
          <div style="display:flex;justify-content:space-between;padding:.35rem 0;font-size:.85rem">
            <span>Subtotal</span><strong id="if_subtotal">₹0.00</strong>
          </div>
          ${gst ? `
          <div style="display:flex;justify-content:space-between;padding:.35rem 0;font-size:.85rem">
            <span>CGST</span><strong id="if_cgst">₹0.00</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:.35rem 0;font-size:.85rem">
            <span>SGST</span><strong id="if_sgst">₹0.00</strong>
          </div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:.5rem 0;font-size:1rem;font-weight:700;border-top:2px solid var(--border);margin-top:.35rem">
            <span>Grand Total</span><strong id="if_total">₹0.00</strong>
          </div>
        </div>
      </div>

      <div class="modal__footer" style="padding:1rem 0 0;margin-top:.5rem">
        <button class="btn btn--outline" onclick="document.getElementById('invoiceFormModal').classList.remove('open')">Cancel</button>
        <button class="btn btn--outline" id="if_preview_btn">👁 Preview</button>
        <button class="btn btn--primary" id="if_save_btn">Save Invoice</button>
      </div>`;

    const preLines = (inv.items && inv.items.length) ? inv.items : [{ supplier: preSupplier }];
    preLines.forEach(line => _addCommLine(line, gst));
    document.getElementById('if_add_comm_line').addEventListener('click', () => _addCommLine({}, gst));
    document.getElementById('if_save_btn').addEventListener('click', () => _saveInvoice(cfg));
    document.getElementById('if_preview_btn').addEventListener('click', () => {
      _showPreviewModal(renderInvoicePreview(_collectInvoiceData(cfg)));
    });
  }

  function _addCommLine(line, gst) {
    const tbody = document.getElementById('if_comm_body');
    if (!tbody) return;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input class="ci-supplier" value="${line.supplier||''}" placeholder="Supplier name" style="width:130px;padding:.3rem .5rem;border:1.5px solid var(--border);border-radius:5px;font-size:.82rem"></td>
      <td><input class="ci-ref" value="${line.supplier_inv_ref||''}" placeholder="Inv ref" style="width:90px;padding:.3rem .5rem;border:1.5px solid var(--border);border-radius:5px;font-size:.82rem"></td>
      <td><input class="ci-mt" type="number" step="0.001" value="${line.mt||''}" placeholder="0.000" style="width:70px;padding:.3rem .5rem;border:1.5px solid var(--border);border-radius:5px;font-size:.82rem"></td>
      <td><input class="ci-rate" type="number" step="0.01" value="${line.rate_per_mt||''}" placeholder="0.00" style="width:70px;padding:.3rem .5rem;border:1.5px solid var(--border);border-radius:5px;font-size:.82rem"></td>
      <td><span class="ci-commission" style="font-weight:600">₹0.00</span></td>
      <td><select class="ci-billed-side" style="padding:.3rem .4rem;border:1.5px solid var(--border);border-radius:5px;font-size:.82rem">
        <option value="Supplier" ${line.billed_side==='Supplier'?'selected':''}>Supplier</option>
        <option value="Buyer"    ${line.billed_side==='Buyer'   ?'selected':''}>Buyer</option>
        <option value="Both"     ${line.billed_side==='Both'    ?'selected':''}>Both</option>
      </select></td>
      <td><button type="button" class="btn btn--danger btn--sm" style="padding:.2rem .4rem">×</button></td>`;

    row.querySelectorAll('input').forEach(el => el.addEventListener('input', () => _recalcCommTotals(gst)));
    row.querySelector('.btn--danger').addEventListener('click', () => { row.remove(); _recalcCommTotals(gst); });
    tbody.appendChild(row);
    _recalcCommTotals(gst);
  }

  function _recalcCommTotals(gst) {
    const tbody = document.getElementById('if_comm_body');
    if (!tbody) return;
    let subtotal = 0;
    tbody.querySelectorAll('tr').forEach(row => {
      const mt   = Number(row.querySelector('.ci-mt')?.value   || 0);
      const rate = Number(row.querySelector('.ci-rate')?.value || 0);
      const comm = mt * rate;
      const el = row.querySelector('.ci-commission');
      if (el) el.textContent = '₹' + comm.toFixed(2);
      subtotal += comm;
    });
    const f = n => '₹' + n.toFixed(2);
    const sub = document.getElementById('if_subtotal'); if (sub) sub.textContent = f(subtotal);
    if (gst) {
      // SR Consultancy: 18% GST on commission (intra-state → CGST+SGST)
      const gstAmt = subtotal * 0.18;
      const cgst = document.getElementById('if_cgst'); if (cgst) cgst.textContent = f(gstAmt/2);
      const sgst = document.getElementById('if_sgst'); if (sgst) sgst.textContent = f(gstAmt/2);
      const tot  = document.getElementById('if_total');  if (tot)  tot.textContent  = f(subtotal + gstAmt);
    } else {
      const tot = document.getElementById('if_total'); if (tot) tot.textContent = f(subtotal);
    }
  }

  // ── Collect invoice data from form ────────────────────────────────────────
  function _collectInvoiceData(cfg) {
    const opt = cfg.optionalColumns || {};
    const gst = cfg.gstRegistered;
    const base = {
      invoice_no:  document.getElementById('if_inv_no')?.value  || '',
      date:        document.getElementById('if_date')?.value    || '',
      customer_id: document.getElementById('if_customer')?.value || '',
      customer_name: document.getElementById('if_customer')?.options[document.getElementById('if_customer')?.selectedIndex]?.text || '',
    };
    if (gst) {
      base.customer_gstin    = document.getElementById('if_customer_gstin')?.value || '';
      base.place_of_supply   = document.getElementById('if_pos')?.value  || '';
    }
    if (opt.po_ref)     base.po_ref     = document.getElementById('if_po_ref')?.value     || '';
    if (opt.vehicle_no) base.vehicle_no = document.getElementById('if_vehicle_no')?.value || '';

    if (cfg.invoiceType === 'commission') {
      base.items = [];
      document.querySelectorAll('#if_comm_body tr').forEach(row => {
        base.items.push({
          supplier:         row.querySelector('.ci-supplier')?.value    || '',
          supplier_inv_ref: row.querySelector('.ci-ref')?.value         || '',
          mt:               Number(row.querySelector('.ci-mt')?.value   || 0),
          rate_per_mt:      Number(row.querySelector('.ci-rate')?.value || 0),
          commission:       Number((row.querySelector('.ci-commission')?.textContent||'0').replace('₹','')),
          billed_side:      row.querySelector('.ci-billed-side')?.value || 'Supplier',
        });
      });
    } else {
      base.items = [];
      document.querySelectorAll('#if_items_body tr').forEach(row => {
        const item = {
          description: row.querySelector('.li-desc')?.value || '',
          hsn_sac:     row.querySelector('.li-hsn')?.value  || '',
          qty:         Number(row.querySelector('.li-qty')?.value  || 0),
          uom:         row.querySelector('.li-uom')?.value  || '',
          rate:        Number(row.querySelector('.li-rate')?.value || 0),
          amount:      Number((row.querySelector('.li-amount')?.textContent||'0').replace('₹','')),
        };
        if (opt.narration) item.narration = row.querySelector('.li-narration')?.value || '';
        if (opt.discount)  item.discount  = Number(row.querySelector('.li-disc')?.value || 0);
        if (gst) {
          item.gst_rate = Number(row.querySelector('.li-gst-rate')?.value || 0);
          item.gst_amount = Number((row.querySelector('.li-gst-amt')?.textContent||'0').replace('₹',''));
        }
        base.items.push(item);
      });
    }

    base.taxable     = Number((document.getElementById('if_subtotal')?.textContent||'0').replace('₹',''));
    base.gst_amount  = gst ? (Number((document.getElementById('if_cgst')?.textContent||'0').replace('₹','')) * 2) : 0;
    base.cgst        = gst ? Number((document.getElementById('if_cgst')?.textContent||'0').replace('₹','')) : 0;
    base.sgst        = gst ? Number((document.getElementById('if_sgst')?.textContent||'0').replace('₹','')) : 0;
    base.total       = Number((document.getElementById('if_total')?.textContent||'0').replace('₹',''));
    return base;
  }

  async function _saveInvoice(cfg) {
    const btn = document.getElementById('if_save_btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      const invoice = _collectInvoiceData(cfg);
      if (!invoice.customer_id) { api.showToast('Please select a customer', 'error'); return; }
      await api.callClientScript('save_invoice', { invoice });
      document.getElementById('invoiceFormModal')?.classList.remove('open');
      api.showToast('Invoice saved');
      window._invoiceConfig = null; // Clear cache so next open re-fetches
    } catch(err) { api.showToast('Save failed: ' + err.message, 'error'); }
    if (btn) { btn.disabled = false; btn.textContent = 'Save Invoice'; }
  }

  // ── Invoice preview (print-ready) ────────────────────────────────────────
  function renderInvoicePreview(invoice) {
    const session = auth.getSession();
    const cfg = window._invoiceConfig || { invoiceType: 'standard', gstRegistered: true };
    const gst = cfg.gstRegistered;
    const isComm = cfg.invoiceType === 'commission';
    const title = gst ? 'Tax Invoice' : 'Bill of Supply';
    const f = n => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});

    const div = document.createElement('div');
    div.className = 'invoice-preview';
    div.style.cssText = 'font-family:Arial,sans-serif;padding:24px;max-width:720px;margin:0 auto;font-size:12px;';

    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #1e293b;padding-bottom:12px;margin-bottom:12px">
        <div>
          <div style="font-size:18px;font-weight:700;color:#1e293b">${session.clientName || ''}</div>
          <div style="color:#475569;margin-top:4px" id="inv-firm-address"></div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700;color:#1e293b;text-transform:uppercase">${title}</div>
          <div style="margin-top:6px"><strong>No:</strong> ${invoice.invoice_no || '(Auto)'}</div>
          <div><strong>Date:</strong> ${invoice.date || '—'}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <div>
          <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:4px">Bill To</div>
          <div style="font-weight:600">${invoice.customer_name || '—'}</div>
          ${gst && invoice.customer_gstin ? `<div style="color:#475569">GSTIN: ${invoice.customer_gstin}</div>` : ''}
          ${gst && invoice.place_of_supply ? `<div style="color:#475569">Place of Supply: ${invoice.place_of_supply}</div>` : ''}
        </div>
        ${invoice.po_ref ? `<div><div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:4px">PO Ref</div><div>${invoice.po_ref}</div></div>` : ''}
        ${invoice.vehicle_no ? `<div><div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:4px">Vehicle</div><div>${invoice.vehicle_no}</div></div>` : ''}
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
        <thead>
          <tr style="background:#1e293b;color:white">
            ${isComm
              ? '<th style="padding:6px 8px;text-align:left">Supplier</th><th style="padding:6px 8px">Supp. Inv</th><th style="padding:6px 8px;text-align:right">MT</th><th style="padding:6px 8px;text-align:right">Rate/MT</th><th style="padding:6px 8px;text-align:right">Commission</th><th style="padding:6px 8px">Billed Side</th>'
              : `<th style="padding:6px 8px;text-align:left">Description</th><th style="padding:6px 8px">HSN</th><th style="padding:6px 8px;text-align:right">Qty</th><th style="padding:6px 8px;text-align:right">Rate</th><th style="padding:6px 8px;text-align:right">Amount</th>${gst?'<th style="padding:6px 8px;text-align:right">GST%</th><th style="padding:6px 8px;text-align:right">GST₹</th>':''}`
            }
          </tr>
        </thead>
        <tbody>
          ${(invoice.items||[]).map((item,i) => `
            <tr style="background:${i%2===0?'#f8fafc':'white'}">
              ${isComm
                ? `<td style="padding:5px 8px">${item.supplier}</td><td style="padding:5px 8px">${item.supplier_inv_ref}</td><td style="padding:5px 8px;text-align:right">${(item.mt||0).toFixed(3)}</td><td style="padding:5px 8px;text-align:right">₹${f(item.rate_per_mt)}</td><td style="padding:5px 8px;text-align:right">₹${f(item.commission)}</td><td style="padding:5px 8px">${item.billed_side}</td>`
                : `<td style="padding:5px 8px">${item.description}</td><td style="padding:5px 8px">${item.hsn_sac||''}</td><td style="padding:5px 8px;text-align:right">${item.qty}</td><td style="padding:5px 8px;text-align:right">₹${f(item.rate)}</td><td style="padding:5px 8px;text-align:right">₹${f(item.amount)}</td>${gst?`<td style="padding:5px 8px;text-align:right">${item.gst_rate}%</td><td style="padding:5px 8px;text-align:right">₹${f(item.gst_amount)}</td>`:''}`
              }
            </tr>`).join('')}
        </tbody>
      </table>

      <div style="display:flex;justify-content:flex-end">
        <div style="width:240px;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px">
          <div style="display:flex;justify-content:space-between;padding:3px 0"><span>Taxable Value</span><strong>₹${f(invoice.taxable)}</strong></div>
          ${gst ? `<div style="display:flex;justify-content:space-between;padding:3px 0"><span>CGST</span><strong>₹${f(invoice.cgst)}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:3px 0"><span>SGST</span><strong>₹${f(invoice.sgst)}</strong></div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:2px solid #1e293b;margin-top:4px;font-size:14px"><strong>Total</strong><strong>₹${f(invoice.total)}</strong></div>
        </div>
      </div>

      <div style="margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px">
        This is a computer-generated ${title}. | MS Associates, Coimbatore
      </div>`;

    return div;
  }

  function _showPreviewModal(previewEl) {
    let modal = document.getElementById('invoicePreviewModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'invoicePreviewModal';
      modal.className = 'modal-backdrop open';
      modal.innerHTML = `<div class="modal modal--wide" style="max-height:85vh;overflow-y:auto">
        <div class="modal__header"><span class="modal__title">Invoice Preview</span>
          <button class="modal__close" onclick="document.getElementById('invoicePreviewModal').classList.remove('open')">×</button>
        </div>
        <div class="modal__body" id="invoicePreviewBody"></div>
        <div class="modal__footer">
          <button class="btn btn--outline" onclick="document.getElementById('invoicePreviewModal').classList.remove('open')">Close</button>
          <button class="btn btn--primary" onclick="window.print()">🖨 Print</button>
        </div>
      </div>`;
      document.body.appendChild(modal);
    }
    modal.classList.add('open');
    document.getElementById('invoicePreviewBody').innerHTML = '';
    document.getElementById('invoicePreviewBody').appendChild(previewEl);
  }

  return { getConfig, saveColumnConfig, renderInvoiceForm, renderInvoicePreview };

})();
