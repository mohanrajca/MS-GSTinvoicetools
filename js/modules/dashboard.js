// js/modules/dashboard.js
// Renders the dashboard: KPI cards, monthly bar chart, top customers, commission pending

(function () {

  function formatINR(n) {
    if (n === undefined || n === null || isNaN(n)) return '₹0';
    const abs = Math.abs(Number(n));
    if (abs >= 1e7)  return '₹' + (n/1e7).toFixed(2)  + 'Cr';
    if (abs >= 1e5)  return '₹' + (n/1e5).toFixed(2)  + 'L';
    if (abs >= 1e3)  return '₹' + (n/1e3).toFixed(2)  + 'K';
    return '₹' + Number(n).toFixed(2);
  }

  function formatINRFull(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }

  async function render(container) {
    const session = auth.getSession();
    const fy = router.currentFY();
    const gst = session.gstRegistered;

    let data;
    try {
      data = await api.callClientScript('get_dashboard', { fy });
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__text">Could not load dashboard. ${err.message}</div></div>`;
      return;
    }

    const d = data.data || {};
    const months = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card kpi-card--dark" style="grid-column: span 2;">
          <div class="kpi-card__label">Sales, FY ${fy} (taxable)</div>
          <div class="kpi-card__value">${formatINRFull(d.taxableSales || 0)}</div>
          <div class="kpi-card__sub">${d.invoiceCount || 0} invoices · ${formatINR(d.totalWithGST || 0)} with GST</div>
          ${d.mt ? `<div class="kpi-card__highlight">${(d.mt||0).toFixed(3)} MT traded</div>` : ''}
          ${d.commissionPerMT ? `<div class="kpi-card__sub">${formatINR(d.commissionPerMT)} earned per MT</div>` : ''}
        </div>
        ${gst ? `
        <div class="kpi-card">
          <div class="kpi-card__label">Output GST</div>
          <div class="kpi-card__value">${formatINR(d.outputGST || 0)}</div>
          <div class="kpi-card__sub">CGST ${formatINR(d.cgst||0)} · SGST ${formatINR(d.sgst||0)} · IGST ${formatINR(d.igst||0)}</div>
        </div>` : ''}
        <div class="kpi-card">
          <div class="kpi-card__label">Received</div>
          <div class="kpi-card__value">${formatINR(d.received || 0)}</div>
          <div class="kpi-card__sub">${d.receiptCount || 0} receipts on record</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-card__label">Receivable Now</div>
          <div class="kpi-card__value">${formatINR(d.receivable || 0)}</div>
          <div class="kpi-card__sub">${d.oldReceivable ? 'Older than 60 days: ' + formatINR(d.oldReceivable) : 'Nothing older than 60 days'}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-card__label">Expenses</div>
          <div class="kpi-card__value">${formatINR(d.expenses || 0)}</div>
          <div class="kpi-card__sub">Sales less expenses ${formatINR((d.taxableSales||0) - (d.expenses||0))}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
        <!-- Monthly chart -->
        <div class="card">
          <div class="card__header">
            <span class="card__title">Month-wise sales</span>
            <span style="font-size:.78rem;color:var(--text-muted);">Best month: ${d.bestMonth || '—'}</span>
          </div>
          <div class="card__body" style="padding:.75rem 1rem;">
            <canvas id="monthChart" height="160"></canvas>
          </div>
        </div>

        <!-- Top customers -->
        <div class="card">
          <div class="card__header">
            <span class="card__title">Top customers</span>
            <button class="btn btn--outline btn--sm" onclick="router.loadModule('sales-register')">Sales register</button>
          </div>
          <div class="card__body" style="padding:0;">
            <table>
              <tbody id="topCustomersBody"></tbody>
            </table>
          </div>
        </div>
      </div>

      ${session.invoiceType === 'commission' ? `
      <div class="card">
        <div class="card__header">
          <span class="card__title">Commission not yet billed</span>
          <button class="btn btn--primary btn--sm" onclick="router.loadModule('commission-tracker')">Commission tracker</button>
        </div>
        <div class="card__body" style="padding:0;">
          <table>
            <thead><tr><th>Supplier</th><th>Invoices</th><th>MT</th><th>Pending</th><th></th></tr></thead>
            <tbody id="commissionBody"></tbody>
          </table>
        </div>
      </div>` : ''}
    `;

    // Top customers
    const tbody = document.getElementById('topCustomersBody');
    if (d.topCustomers && d.topCustomers.length) {
      const total = d.taxableSales || 1;
      d.topCustomers.slice(0,5).forEach(c => {
        const pct = ((c.amount / total) * 100).toFixed(1);
        tbody.innerHTML += `
          <tr>
            <td>
              <div style="font-weight:600">${c.name}</div>
              <div style="font-size:.72rem;color:var(--text-muted)">${pct}% · ${c.invoiceCount} inv</div>
              <div style="margin-top:.3rem;height:4px;background:#f1f5f9;border-radius:2px;">
                <div style="width:${pct}%;height:4px;background:var(--accent);border-radius:2px;"></div>
              </div>
            </td>
            <td style="text-align:right;font-weight:700">${formatINR(c.amount)}</td>
          </tr>`;
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:1rem">No data</td></tr>';
    }

    // Commission pending
    const cbody = document.getElementById('commissionBody');
    if (cbody && d.commissionPending && d.commissionPending.length) {
      d.commissionPending.forEach(c => {
        cbody.innerHTML += `
          <tr>
            <td>${c.supplier}</td>
            <td>${c.invoiceCount}</td>
            <td>${(c.mt||0).toFixed(3)}</td>
            <td>${formatINR(c.pending)}</td>
            <td><button class="btn btn--primary btn--sm" onclick="router.loadModule('invoices');setTimeout(()=>document.dispatchEvent(new CustomEvent('openNewInvoice',{detail:{commissionParty:'${c.supplier}'}})),100)">Raise Invoice</button></td>
          </tr>`;
      });
    }

    // Simple bar chart (vanilla canvas)
    _drawBarChart('monthChart', months, d.monthSales || [], d.monthMT || []);
  }

  function _drawBarChart(canvasId, labels, salesData, mtData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 400;
    canvas.width = W;
    const H = canvas.height;
    const pad = { t: 20, r: 10, b: 40, l: 50 };
    const chartW = W - pad.l - pad.r;
    const chartH = H - pad.t - pad.b;
    const max = Math.max(...salesData, 1);
    const barW = chartW / labels.length * 0.6;
    const gap  = chartW / labels.length;

    ctx.clearRect(0, 0, W, H);
    ctx.font = '10px Segoe UI, sans-serif';
    ctx.fillStyle = '#94a3b8';

    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + chartH - (i / 4) * chartH;
      ctx.beginPath(); ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
      ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + chartW, y);
      ctx.stroke();
      ctx.fillText(formatINR((max * i / 4)), 0, y + 3);
    }

    // Bars
    salesData.forEach((val, i) => {
      const x = pad.l + gap * i + (gap - barW) / 2;
      const barH = val ? (val / max) * chartH : 0;
      const y = pad.t + chartH - barH;
      const isHighest = val === Math.max(...salesData);
      ctx.fillStyle = isHighest ? '#d4a017' : '#1e293b';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, barW, barH, [3,3,0,0]) : ctx.rect(x, y, barW, barH);
      ctx.fill();

      // Value label on highest
      if (isHighest && val) {
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 10px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(formatINR(val), x + barW/2, y - 5);
        ctx.font = '10px Segoe UI, sans-serif';
      }

      // Month label
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x + barW/2, pad.t + chartH + 15);

      // MT label below month
      if (mtData[i]) {
        ctx.fillStyle = '#d4a017';
        ctx.fillText((mtData[i]||0).toFixed(0)+'MT', x + barW/2, pad.t + chartH + 27);
      }
    });

    function formatINR(n) {
      const abs = Math.abs(Number(n));
      if (abs >= 1e5) return '₹'+(n/1e5).toFixed(1)+'L';
      if (abs >= 1e3) return '₹'+(n/1e3).toFixed(0)+'K';
      return '₹'+n;
    }
  }

  router.register('dashboard', render);

})();
