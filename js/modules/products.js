// js/modules/products.js
(function () {

  async function render(container) {
    const session = auth.getSession();
    container.innerHTML = `
      <div class="card">
        <div class="card__header">
          <span class="card__title">Products &amp; Services</span>
          <button class="btn btn--primary btn--sm" id="addProductBtn">+ Add Product</button>
        </div>
        <div class="card__body" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Description</th><th>HSN/SAC</th><th>UOM</th>
                ${session.gstRegistered ? '<th>GST Rate</th>' : ''}
                <th>Unit Price</th><th>Actions</th>
              </tr></thead>
              <tbody id="productsBody">
                <tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ${_modalHTML(session.gstRegistered)}`;

    document.getElementById('addProductBtn').addEventListener('click', () => openModal(null));
    _loadList(session.gstRegistered);
  }

  async function _loadList(gst) {
    let data;
    try { data = await api.callClientScript('get_products', {}); }
    catch { document.getElementById('productsBody').innerHTML = '<tr><td colspan="6" style="color:var(--danger);padding:1rem">Failed to load.</td></tr>'; return; }

    const tbody = document.getElementById('productsBody');
    if (!data.products || !data.products.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state__icon">📦</div><div class="empty-state__text">No products yet.</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = data.products.map(p => `
      <tr>
        <td><strong>${p.description}</strong></td>
        <td><code style="font-size:.78rem">${p.hsn_sac || '—'}</code></td>
        <td>${p.uom || '—'}</td>
        ${gst ? `<td><span class="badge badge--blue">${p.gst_rate || 0}%</span></td>` : ''}
        <td>₹${Number(p.unit_price || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
        <td><button class="btn btn--outline btn--sm" onclick='openProductModal(${JSON.stringify(p)})'>Edit</button></td>
      </tr>`).join('');
  }

  function openModal(product) {
    const modal = document.getElementById('productModal');
    document.getElementById('prod_id').value      = product ? (product.product_id || '') : '';
    document.getElementById('prod_desc').value    = product ? (product.description || '') : '';
    document.getElementById('prod_hsn').value     = product ? (product.hsn_sac || '') : '';
    document.getElementById('prod_uom').value     = product ? (product.uom || '') : '';
    document.getElementById('prod_price').value   = product ? (product.unit_price || '') : '';
    const gstEl = document.getElementById('prod_gst_rate');
    if (gstEl) gstEl.value = product ? (product.gst_rate || '18') : '18';
    modal.classList.add('open');
  }
  window.openProductModal = openModal;

  function _modalHTML(gst) {
    return `
    <div class="modal-backdrop" id="productModal">
      <div class="modal">
        <div class="modal__header">
          <span class="modal__title">Product / Service</span>
          <button class="modal__close" onclick="document.getElementById('productModal').classList.remove('open')">×</button>
        </div>
        <div class="modal__body">
          <input type="hidden" id="prod_id">
          <div class="form-row--1 form-field" style="margin-bottom:.9rem"><label>Description *</label><input id="prod_desc" placeholder="Product or service name"></div>
          <div class="form-row">
            <div class="form-field"><label>HSN / SAC Code</label><input id="prod_hsn" placeholder="e.g. 1001"></div>
            <div class="form-field"><label>Unit of Measure</label><input id="prod_uom" placeholder="e.g. MT, Nos, Kg"></div>
          </div>
          <div class="form-row">
            ${gst ? `<div class="form-field"><label>GST Rate (%)</label><select id="prod_gst_rate"><option>0</option><option>5</option><option>12</option><option>18</option><option>28</option></select></div>` : '<div></div>'}
            <div class="form-field"><label>Unit Price (₹)</label><input id="prod_price" type="number" step="0.01" placeholder="0.00"></div>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" onclick="document.getElementById('productModal').classList.remove('open')">Cancel</button>
          <button class="btn btn--primary" id="saveProductBtn">Save</button>
        </div>
      </div>
    </div>`;
  }

  document.addEventListener('click', async e => {
    if (e.target.id !== 'saveProductBtn') return;
    const btn = e.target; btn.disabled = true; btn.textContent = 'Saving…';
    const gstEl = document.getElementById('prod_gst_rate');
    const product = {
      product_id:  document.getElementById('prod_id').value || null,
      description: document.getElementById('prod_desc').value.trim(),
      hsn_sac:     document.getElementById('prod_hsn').value.trim(),
      uom:         document.getElementById('prod_uom').value.trim(),
      gst_rate:    gstEl ? Number(gstEl.value) : 0,
      unit_price:  Number(document.getElementById('prod_price').value) || 0,
    };
    if (!product.description) { api.showToast('Description is required', 'error'); btn.disabled=false; btn.textContent='Save'; return; }
    try {
      await api.callClientScript('save_product', { product });
      document.getElementById('productModal').classList.remove('open');
      api.showToast('Product saved');
      const session = auth.getSession();
      _loadList(session.gstRegistered);
    } catch (err) { api.showToast('Save failed: ' + err.message, 'error'); }
    btn.disabled=false; btn.textContent='Save';
  });

  router.register('products', render);
})();
