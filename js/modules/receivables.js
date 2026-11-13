// js/modules/receivables.js
(function () {

  async function render(container) {
    container.innerHTML = `
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:1rem" id="arKpis"></div>
      <div class="card">
        <div class="card__header">
          <span class="card__title">Accounts &amp; Receivables</span>
          <select id="arFilter" class="fy-selector" style="font-size:.8rem">
            <option value="">All</option>
            <option value="0-30">0–30 days</option>
            <option value="31-60">31–60 days</option>
            <option value="61-90">61–90 days</option>
            <option value="90+">90+ days</option>
          </select>
        </div>
        <div class="card__body" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Customer</th><th>Invoice</th><th>Invoice Date</th><th>Amount</th><th>Received</th><th>Balance</th><th>Age (days)</th><th>Bucket</th><th></th></tr></thead>
              <tbody id="arBody">
                <tr><td colspan="9"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>`;

    document.getElementById('arFilter').addEventListener('change', e => _applyFilter(e.target.value));
    _load();
  }

  let _rows = [];

  async function _load() {
    let data;
    try { data = await api.callClientScript('get_receivables', {}); }
    catch { document.getElementById('arBody').innerHTML = '<tr><td colspan="9" style="color:var(--danger);padding:1rem">Failed to load.</td></tr>'; return; }

    _rows = data.receivables || [];

    // KPIs
    const buckets = { '0-30':0, '31-60':0, '61-90':0, '90+':0 };
    _rows.forEach(r => {
      const age = Number(r.age_days||0);
      if (age <= 30) buckets['0-30'] += r.balance;
      else if (age <= 60) buckets['31-60'] += r.balance;
      else if (age <= 90) buckets['61-90'] += r.balance;
      else buckets['90+'] += r.balance;
    });
    const f = n => '₹' + Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});
    document.getElementById('arKpis').innerHTML = Object.entries(buckets).map(([b,v]) => `
      <div class="kpi-card"><div class="kpi-card__label">${b} days</div><div class="kpi-card__value" style="font-size:1.2rem">${f(v)}</div></div>
    `).join('');

    _renderAR(_rows);
  }

  function _applyFilter(bucket) {
    if (!bucket) { _renderAR(_rows); return; }
    const [lo,hi] = bucket === '90+' ? [91,Infinity] : bucket.split('-').map(Number);
    _renderAR(_rows.filter(r => { const a = Number(r.age_days||0); return a >= lo && a <= (hi||Infinity); }));
  }

  function _renderAR(rows) {
    const tbody = document.getElementById('arBody');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-state__text">No outstanding receivables.</div></div></td></tr>'; return; }
    const f = n => Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});
    tbody.innerHTML = rows.map(r => {
      const age = Number(r.age_days||0);
      const bucket = age > 90 ? 'badge--red' : age > 60 ? 'badge--amber' : age > 30 ? 'badge--blue' : 'badge--green';
      return `<tr>
        <td><strong>${r.customer_name}</strong></td>
        <td>${r.invoice_no}</td>
        <td>${r.date}</td>
        <td>₹${f(r.total)}</td>
        <td>₹${f(r.received)}</td>
        <td><strong>₹${f(r.balance)}</strong></td>
        <td>${age}</td>
        <td><span class="badge ${bucket}">${age > 90 ? '90+' : age > 60 ? '61-90' : age > 30 ? '31-60' : '0-30'}</span></td>
        <td><a class="btn btn--outline btn--sm" href="mailto:${r.email||''}?subject=Payment Reminder — Invoice ${r.invoice_no}">Remind</a></td>
      </tr>`;
    }).join('');
  }

  router.register('receivables', render);
})();
