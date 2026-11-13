// js/export/json-export.js

const jsonExport = (() => {

  function _triggerDownload(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  // ── Sales Register JSON ──────────────────────────────────────────────────
  function salesRegister(invoices, fy) {
    const session = auth.getSession();
    const gst = session.gstRegistered;
    const data = (invoices || []).map(inv => {
      const row = {
        invoice_no:    inv.invoice_no    || '',
        date:          inv.date          || '',
        customer_name: inv.customer_name || '',
        taxable:       Number(inv.taxable || 0),
        total:         Number(inv.total   || 0),
        status:        inv.status         || '',
      };
      if (gst) {
        row.customer_gstin = inv.customer_gstin || '';
        row.cgst  = Number(inv.cgst  || 0);
        row.sgst  = Number(inv.sgst  || 0);
        row.igst  = Number(inv.igst  || 0);
      }
      return row;
    });
    _triggerDownload(data, `sales-register-FY${fy}.json`);
  }

  return { salesRegister, _triggerDownload };

})();
