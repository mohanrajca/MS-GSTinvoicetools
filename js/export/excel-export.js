// js/export/excel-export.js — SheetJS-based Excel exports
// Depends on: XLSX (CDN), auth.js

const excelExport = (() => {

  function _download(wb, filename) {
    XLSX.writeFile(wb, filename);
  }

  function _makeWB(wsName, ws) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, wsName);
    return wb;
  }

  function _colWidths(widths) {
    return widths.map(w => ({ wch: w }));
  }

  // ── Sales Register Excel ─────────────────────────────────────────────────
  function salesRegister(invoices, fy) {
    const session = auth.getSession();
    const gst = session.gstRegistered;
    const rows = (invoices || []).map(inv => {
      const row = {
        'Invoice No':     inv.invoice_no   || '',
        'Date':           inv.date         || '',
        'Customer Name':  inv.customer_name|| '',
      };
      if (gst) row['Customer GSTIN'] = inv.customer_gstin || '';
      row['Taxable Value'] = Number(inv.taxable || 0);
      if (gst) {
        row['CGST']  = Number(inv.cgst  || 0);
        row['SGST']  = Number(inv.sgst  || 0);
        row['IGST']  = Number(inv.igst  || 0);
      }
      row['Total']          = Number(inv.total  || 0);
      row['Payment Status'] = inv.status         || '';
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    ws['!cols'] = _colWidths([14, 12, 30, gst?18:0, 15, gst?12:0, gst?12:0, gst?12:0, 15, 12].filter(w=>w>0));
    _applyHeaderStyle(ws, rows.length ? Object.keys(rows[0]).length : 1);

    const wb = _makeWB('Sales Register', ws);
    _download(wb, `sales-register-FY${fy}.xlsx`);
  }

  // ── Shared: apply bold header row ────────────────────────────────────────
  function _applyHeaderStyle(ws, colCount) {
    for (let c = 0; c < colCount; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell) {
        cell.s = { font: { bold: true }, fill: { fgColor: { rgb: '1E293B' } }, font: { bold: true, color: { rgb: 'FFFFFF' } } };
      }
    }
  }

  return { salesRegister };

})();
