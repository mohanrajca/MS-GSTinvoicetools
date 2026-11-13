// js/router.js
// Module router: loads sidebar modules into #main-content.
// Depends on: auth.js (for session), all module files loaded in app.html

const router = (() => {

  // Map of module names to their render functions
  // Populated after all module scripts load
  const moduleMap = {};

  function register(name, renderFn) {
    moduleMap[name] = renderFn;
  }

  // ── Current FY from selector ─────────────────────────────────────────────
  function currentFY() {
    const sel = document.getElementById('fySelector');
    return sel ? sel.value : _defaultFY();
  }

  function _defaultFY() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-based
    // Indian FY: Apr–Mar. If month >= 4, FY starts this year
    const startYear = month >= 4 ? year : year - 1;
    return startYear + '-' + String(startYear + 1).slice(-2);
  }

  // ── Load module into #main-content ──────────────────────────────────────
  function loadModule(name) {
    window._currentModule = name;

    // Update sidebar active state
    document.querySelectorAll('.sidebar__nav a').forEach(a => {
      a.classList.toggle('active', a.dataset.module === name);
    });

    const container = document.getElementById('main-content');
    if (!container) return;

    // Update topbar title
    const titleMap = {
      dashboard:   ['Dashboard', 'Welcome, ' + (auth.getSession()?.userName || '')],
      customers:   ['Customers', 'Manage your customers'],
      products:    ['Products', 'Products & services'],
      invoices:    ['Invoices', 'Create and manage invoices'],
      'sales-register': ['Sales Register', 'All invoices for the financial year'],
      'commission-tracker': ['Commission Tracker', 'Commission billing and tracking'],
      receivables: ['Accounts & Receivables', 'Outstanding receivables'],
      expenses:    ['Expenses', 'Track business expenses'],
      receipts:    ['Receipts', 'Payment receipts'],
      payments:    ['Payments', 'Payments made'],
      settings:    ['Settings', 'Account and invoice settings'],
    };
    const [title, subtitle] = titleMap[name] || [name, ''];
    const titleEl = document.getElementById('topbar-title');
    const subtitleEl = document.getElementById('topbar-subtitle');
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;

    if (!moduleMap[name]) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🚧</div>
          <div class="empty-state__text">Module "${name}" not loaded.</div>
        </div>`;
      return;
    }

    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Loading…</div>';
    // Small delay so spinner shows before heavy render
    setTimeout(() => moduleMap[name](container), 30);
  }

  // ── Build FY options ─────────────────────────────────────────────────────
  function buildFYOptions() {
    const sel = document.getElementById('fySelector');
    if (!sel) return;
    const current = _defaultFY();
    const [startStr] = current.split('-');
    const startYear = parseInt(startStr);
    // Show current FY + 2 years back
    for (let y = startYear; y >= startYear - 2; y--) {
      const opt = document.createElement('option');
      opt.value = y + '-' + String(y + 1).slice(-2);
      opt.textContent = 'FY ' + opt.value;
      if (opt.value === current) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  return { register, loadModule, currentFY, buildFYOptions };

})();
