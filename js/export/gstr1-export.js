// js/export/gstr1-export.js
// GSTR-1 exports: B2B, B2CS, Doc Summary, HSN Summary → Excel + JSON
// Depends on: XLSX (CDN), jsonExport._triggerDownload

const gstr1Export = (() => {

  function _dl(wb, name) { XLSX.writeFile(wb, name); }
  function _dlJson(data, name) { jsonExport._triggerDownload(data, name); }

  function _makeWB(wsName, ws) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, wsName);
    return wb;
  }

  // ── B2B ──────────────────────────────────────────────────────────────────
  // Registered buyer invoices (GSTIN present)
  function _b2bData(invoices) {
    return (invoices || []).filter(inv => inv.customer_gstin && inv.customer_gstin.length === 15);
  }

  function b2bExcel(invoices, fy) {
    const rows = _b2bData(invoices).map(inv => ({
      'Receiver GSTIN':    inv.customer_gstin || '',
      'Invoice Number':    inv.invoice_no     || '',
      'Invoice Date':      inv.date           || '',
      'Invoice Value':     Number(inv.total   || 0),
      'Place of Supply':   inv.place_of_supply|| '',
      'Reverse Charge':    inv.reverse_charge ? 'Y' : 'N',
      'Invoice Type':      inv.invoice_type   || 'Regular B2B',
      'GST Rate (%)':      Number(inv.gst_rate|| 0),
      'Taxable Value':     Number(inv.taxable || 0),
      'IGST':              Number(inv.igst    || 0),
      'CGST':              Number(inv.cgst    || 0),
      'SGST/UTGST':        Number(inv.sgst    || 0),
      'Cess':              0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    ws['!cols'] = [18,16,12,14,18,12,16,10,14,12,12,12,8].map(w=>({wch:w}));
    _dl(_makeWB('B2B', ws), `gstr1-b2b-FY${fy}.xlsx`);
  }

  function b2bJson(invoices, fy) {
    const b2b = [];
    const byGstin = {};
    _b2bData(invoices).forEach(inv => {
      const g = inv.customer_gstin;
      if (!byGstin[g]) byGstin[g] = [];
      byGstin[g].push({
        inum: inv.invoice_no || '', idt: inv.date || '',
        val: Number(inv.total||0), pos: inv.place_of_supply||'',
        rchrg: inv.reverse_charge ? 'Y':'N',
        itms: [{ num: 1, itm_det: {
          rt:   Number(inv.gst_rate||0),
          txval:Number(inv.taxable ||0),
          iamt: Number(inv.igst    ||0),
          camt: Number(inv.cgst    ||0),
          samt: Number(inv.sgst    ||0),
          csamt:0
        }}]
      });
    });
    Object.entries(byGstin).forEach(([ctin, inv]) => b2b.push({ ctin, inv }));
    _dlJson({ b2b }, `gstr1-b2b-FY${fy}.json`);
  }

  // ── B2CS ─────────────────────────────────────────────────────────────────
  // Unregistered buyer invoices (no GSTIN or value ≤ 2.5L)
  function _b2csData(invoices) {
    return (invoices || []).filter(inv =>
      !inv.customer_gstin || inv.customer_gstin.length !== 15 || Number(inv.total||0) <= 250000
    );
  }

  function b2csExcel(invoices, fy) {
    // Group by (place_of_supply, gst_rate)
    const groups = {};
    _b2csData(invoices).forEach(inv => {
      const key = `${inv.place_of_supply||''}|${inv.gst_rate||0}`;
      if (!groups[key]) groups[key] = { pos: inv.place_of_supply||'', rate: Number(inv.gst_rate||0), txval:0, iamt:0, camt:0, samt:0 };
      groups[key].txval += Number(inv.taxable||0);
      groups[key].iamt  += Number(inv.igst   ||0);
      groups[key].camt  += Number(inv.cgst   ||0);
      groups[key].samt  += Number(inv.sgst   ||0);
    });
    const rows = Object.values(groups).map(g => ({
      'Type':              'OE',
      'Place of Supply':   g.pos,
      'Rate (%)':          g.rate,
      'Taxable Value':     g.txval,
      'IGST':              g.iamt,
      'CGST':              g.camt,
      'SGST/UTGST':        g.samt,
      'Cess':              0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    ws['!cols'] = [8,20,10,16,12,12,12,8].map(w=>({wch:w}));
    _dl(_makeWB('B2CS', ws), `gstr1-b2cs-FY${fy}.xlsx`);
  }

  function b2csJson(invoices, fy) {
    const groups = {};
    _b2csData(invoices).forEach(inv => {
      const key = `${inv.place_of_supply||''}|${inv.gst_rate||0}`;
      if (!groups[key]) groups[key] = { sply_ty:'INTER', pos: inv.place_of_supply||'', typ:'OE', rt: Number(inv.gst_rate||0), txval:0, iamt:0, camt:0, samt:0, csamt:0 };
      groups[key].txval += Number(inv.taxable||0);
      groups[key].iamt  += Number(inv.igst   ||0);
      groups[key].camt  += Number(inv.cgst   ||0);
      groups[key].samt  += Number(inv.sgst   ||0);
    });
    _dlJson({ b2cs: Object.values(groups) }, `gstr1-b2cs-FY${fy}.json`);
  }

  // ── Document Summary ─────────────────────────────────────────────────────
  function _docSummaryData(invoices) {
    if (!invoices || !invoices.length) return [{ prefix:'', from:'—', to:'—', totnum:0, cancel:0, net:0 }];
    // Detect series prefix from invoice numbers (e.g. "INV-" from "INV-001")
    const nums = invoices.map(i => i.invoice_no || '').filter(Boolean);
    const prefixMatch = nums[0].match(/^([A-Za-z\-\/]+)/);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    const numbers = nums.map(n => parseInt(n.replace(prefix,'')) || 0).filter(n=>n>0);
    const from = Math.min(...numbers);
    const to   = Math.max(...numbers);
    const cancelled = invoices.filter(i => i.status === 'cancelled').length;
    return [{ prefix, from: prefix+from, to: prefix+to, totnum: invoices.length, cancel: cancelled, net: invoices.length - cancelled }];
  }

  function docSummaryExcel(invoices, fy) {
    const data = _docSummaryData(invoices);
    const rows = data.map(d => ({
      'Document Type':    'Invoice',
      'Series':           d.prefix || 'INV',
      'From':             d.from,
      'To':               d.to,
      'Total Issued':     d.totnum,
      'Cancelled':        d.cancel,
      'Net Issued':       d.net,
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    ws['!cols'] = [14,10,12,12,12,10,10].map(w=>({wch:w}));
    _dl(_makeWB('Doc Summary', ws), `gstr1-doc-summary-FY${fy}.xlsx`);
  }

  function docSummaryJson(invoices, fy) {
    const data = _docSummaryData(invoices);
    const json = { doc_issue: { doc_det: [{ doc_num: 1, docs: data.map(d=>({ from:d.from, to:d.to, totnum:d.totnum, cancel:d.cancel, net:d.net })) }] } };
    _dlJson(json, `gstr1-doc-summary-FY${fy}.json`);
  }

  // ── HSN Summary ──────────────────────────────────────────────────────────
  function _hsnData(invoices) {
    const groups = {};
    (invoices || []).forEach(inv => {
      (inv.items || []).forEach(item => {
        const hsn = item.hsn_sac || 'MISC';
        if (!groups[hsn]) groups[hsn] = { hsn, desc: item.description||'', uqc: item.uom||'NOS', qty:0, val:0, txval:0, iamt:0, camt:0, samt:0, csamt:0 };
        const qty = Number(item.qty||0);
        const amt = Number(item.amount||0);
        const gstAmt = Number(item.gst_amount||0);
        // Distribute GST equally between CGST/SGST (intra-state assumption)
        groups[hsn].qty   += qty;
        groups[hsn].val   += amt + gstAmt;
        groups[hsn].txval += amt;
        groups[hsn].camt  += Number(item.cgst || gstAmt/2 || 0);
        groups[hsn].samt  += Number(item.sgst || gstAmt/2 || 0);
        groups[hsn].iamt  += Number(item.igst || 0);
      });
    });
    return Object.values(groups);
  }

  function hsnExcel(invoices, fy) {
    const data = _hsnData(invoices);
    const rows = data.map((h,i) => ({
      'Sr No':         i+1,
      'HSN/SAC':       h.hsn,
      'Description':   h.desc,
      'UOM':           h.uqc,
      'Total Qty':     h.qty,
      'Total Value':   h.val,
      'Taxable Value': h.txval,
      'IGST':          h.iamt,
      'CGST':          h.camt,
      'SGST':          h.samt,
      'Cess':          h.csamt,
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    ws['!cols'] = [6,10,30,8,10,14,14,12,12,12,8].map(w=>({wch:w}));
    _dl(_makeWB('HSN Summary', ws), `gstr1-hsn-FY${fy}.xlsx`);
  }

  function hsnJson(invoices, fy) {
    const data = _hsnData(invoices);
    const json = { hsn: { data: data.map((h,i)=>({ num:i+1, hsn_sc:h.hsn, desc:h.desc, uqc:h.uqc, qty:h.qty, val:h.val, txval:h.txval, iamt:h.iamt, camt:h.camt, samt:h.samt, csamt:h.csamt })) } };
    _dlJson(json, `gstr1-hsn-FY${fy}.json`);
  }

  return { b2bExcel, b2bJson, b2csExcel, b2csJson, docSummaryExcel, docSummaryJson, hsnExcel, hsnJson };

})();
