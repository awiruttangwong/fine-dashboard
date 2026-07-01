/* ============================================================
   Fine Dashboard — Tables
   Rendering, sorting, pagination, search, tab switching
   All icons use inline SVG — no emoji
   ============================================================ */

const Tables = (() => {
  // ── SVG Icons ──
  const ICONS = {
    search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    chevronLeft: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
    chevronRight: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    sortAsc: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5l-7 7h14l-7-7z"/></svg>`,
    sortDesc: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 19l-7-7h14l-7 7z"/></svg>`,
    sortNone: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" opacity="0.3"><path d="M12 5l-5 5h10l-5-5z M12 19l-5-5h10l-5 5z"/></svg>`,
    warning: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    alertCircle: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    list: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    copy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    notEqual: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9h14"/><path d="M5 15h14"/><path d="m19 5-14 14"/></svg>`,
    userX: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>`
  };

  let currentTab = 'all-fines';
  let tableState = {
    'all-fines': { page: 1, perPage: 15, sortField: 'payment_status', sortDir: 'asc', search: '' },
    'dup-barcodes': { page: 1, perPage: 15, sortField: 'count', sortDir: 'desc', search: '' },
    'mismatches': { page: 1, perPage: 15, sortField: 'source_row', sortDir: 'asc', search: '' },
    'missing-data': { page: 1, perPage: 15, sortField: 'source_row', sortDir: 'asc', search: '' }
  };

  let currentData = [];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatCurrency(val) {
    if (val === null || val === undefined) return '-';
    return new Intl.NumberFormat('th-TH').format(val) + ' ฿';
  }

  function formatDate(d) {
    if (!d) return '-';
    const parts = d.split('-');
    return `${parseInt(parts[2])}/${parseInt(parts[1])}/${parts[0]}`;
  }

  function getStatusBadge(status) {
    const map = {
      'open': { label: 'ค้างชำระ', class: 'status-badge--open' },
      'paid': { label: 'ชำระค่าปรับแล้ว', class: 'status-badge--paid' },
      'data_error': { label: 'ยอดไม่ตรง', class: 'status-badge--error' }
    };
    const info = map[status] || { label: status, class: 'status-badge--open' };
    return `<span class="status-badge ${info.class}"><span class="status-dot"></span><span class="status-label">${info.label}</span></span>`;
  }

  function getSortIcon(field, state) {
    if (state.sortField !== field) return `<span class="sort-icon">${ICONS.sortNone}</span>`;
    return `<span class="sort-icon">${state.sortDir === 'asc' ? ICONS.sortAsc : ICONS.sortDesc}</span>`;
  }

  const STATUS_WEIGHT = {
    'paid': 1,
    'data_error': 2,
    'open': 3
  };

  function sortData(data, field, dir) {
    return [...data].sort((a, b) => {
      if (field === 'payment_status') {
        const weightA = STATUS_WEIGHT[a.payment_status] || 99;
        const weightB = STATUS_WEIGHT[b.payment_status] || 99;
        if (weightA !== weightB) {
          return dir === 'asc' ? weightA - weightB : weightB - weightA;
        }
        // Tie-breaker: date descending, then row order ascending
        if (a.fine_date !== b.fine_date) {
          return a.fine_date > b.fine_date ? -1 : 1;
        }
        return a.source_row - b.source_row;
      }

      let va = a[field], vb = b[field];
      if (va === null || va === undefined) va = '';
      if (vb === null || vb === undefined) vb = '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return dir === 'asc' ? va - vb : vb - va;
      }
      return dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }

  function filterBySearch(data, search) {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(row => {
      const searchable = Object.values(row).join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }

  function renderPagination(total, state, tabId) {
    const totalPages = Math.ceil(total / state.perPage);
    if (totalPages <= 1) return '';

    const start = (state.page - 1) * state.perPage + 1;
    const end = Math.min(state.page * state.perPage, total);

    let pages = '';
    const maxVisible = 5;
    let startPage = Math.max(1, state.page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

    for (let p = startPage; p <= endPage; p++) {
      pages += `<button class="table-pagination__btn ${p === state.page ? 'active' : ''}" data-tab="${tabId}" data-page="${p}">${p}</button>`;
    }

    return `
      <div class="table-pagination">
        <div class="table-pagination__info">
          แสดง ${start}-${end} จาก ${total} รายการ
        </div>
        <div class="table-pagination__controls">
          <button class="table-pagination__btn" data-tab="${tabId}" data-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''}>${ICONS.chevronLeft}</button>
          ${pages}
          <button class="table-pagination__btn" data-tab="${tabId}" data-page="${state.page + 1}" ${state.page >= totalPages ? 'disabled' : ''}>${ICONS.chevronRight}</button>
        </div>
      </div>
    `;
  }

  function renderColGroup(columns) {
    const hasWidths = columns.some(col => col.width);
    if (!hasWidths) return '';
    return `
      <colgroup>
        ${columns.map(col => `<col${col.width ? ` style="width:${col.width}"` : ''}>`).join('')}
      </colgroup>
    `;
  }

  function getColumnClass(col, target = 'td') {
    const classes = [
      col.className,
      target === 'th' ? col.thClass : col.tdClass,
      col.align ? `cell-${col.align}` : ''
    ];
    return classes.filter(Boolean).join(' ');
  }

  // ── Tab: All Fines ──
  function renderAllFines(data) {
    const state = tableState['all-fines'];
    let filtered = filterBySearch(data, state.search);
    let sorted = sortData(filtered, state.sortField, state.sortDir);
    const total = sorted.length;
    const paginated = sorted.slice((state.page - 1) * state.perPage, state.page * state.perPage);

    const columns = [
      { field: 'fine_date', label: 'วันที่', width: '8%', align: 'left', render: (r) => formatDate(r.fine_date) },
      { field: 'customer', label: 'ลูกค้า', width: '7%', align: 'left', render: (r) => escapeHtml(r.customer) },
      { field: 'barcode', label: 'บาร์โค้ด', width: '12%', align: 'left', render: (r) => `<span class="cell-mono">${escapeHtml(r.barcode)}</span>` },
      { field: 'route_raw', label: 'เส้นทาง', width: '18%', align: 'left', render: (r) => `<code class="cell-mono" style="font-size: var(--font-size-xs); background: none; padding: 0;">${escapeHtml(r.route_raw)}</code>` },
      { field: 'driver_name', label: 'พนักงาน', width: '12%', align: 'left', render: (r) => r.driver_name ? escapeHtml(r.driver_name) : `<span class="cell-muted">ไม่ระบุ</span>` },
      { field: 'fine_amount', label: 'ยอดปรับ', width: '10%', align: 'right', className: 'column-financial', render: (r) => `<span class="cell-amount">${formatCurrency(r.fine_amount)}</span>` },
      { field: 'paid_amount', label: 'ชำระค่าปรับแล้ว', width: '12%', align: 'right', className: 'column-financial column-paid', render: (r) => `<span class="cell-amount ${r.paid_amount ? 'cell-amount--positive' : ''}">${formatCurrency(r.paid_amount || 0)}</span>` },
      { field: 'computed_remaining', label: 'คงเหลือ', width: '9%', align: 'right', className: 'column-financial', render: (r) => `<span class="cell-amount">${formatCurrency(r.computed_remaining)}</span>` },
      { field: 'payment_status', label: 'สถานะ', width: '12%', align: 'center', className: 'cell-status column-status', render: (r) => getStatusBadge(r.payment_status) }
    ];

    return `
      <div class="table-card__header">
        <div class="table-card__title-area">
          ${ICONS.list}
          <span class="table-card__title">รายการค่าปรับทั้งหมด</span>
          <span class="table-card__row-count">${total} รายการ</span>
        </div>
        <div class="table-card__actions">
          <div class="table-search">
            <span class="table-search__icon">${ICONS.search}</span>
            <input type="text" class="table-search__input" placeholder="ค้นหา..." value="${escapeHtml(state.search)}" data-tab="all-fines">
          </div>
        </div>
      </div>
      <div class="table-container">
        <table class="data-table" id="table-all-fines">
          ${renderColGroup(columns)}
          <thead>
            <tr>
              ${columns.map(col => `<th class="${getColumnClass(col, 'th')}" data-tab="all-fines" data-sort="${col.field}">${col.label} ${getSortIcon(col.field, state)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${paginated.length === 0
        ? `<tr><td colspan="${columns.length}" class="empty-state"><div class="empty-state__text">ไม่พบข้อมูล</div></td></tr>`
        : paginated.map(row => {
          const rowClass = row.has_amount_mismatch ? 'row-error' : (row.is_full_duplicate ? 'row-highlight' : '');
          return `<tr class="${rowClass}">${columns.map(col => `<td class="${getColumnClass(col)}">${col.render(row)}</td>`).join('')}</tr>`;
        }).join('')
      }
          </tbody>
        </table>
      </div>
      ${renderPagination(total, state, 'all-fines')}
    `;
  }

  // ── Tab: Duplicate Barcodes ──
  function renderDuplicateBarcodes(data) {
    const state = tableState['dup-barcodes'];
    const dupData = FineData.getDuplicateBarcodeRows(data);
    let filtered = filterBySearch(dupData, state.search);
    const total = filtered.length;
    const columns = [
      { label: 'บาร์โค้ด', width: '28%', align: 'left', render: (item) => `<span class="cell-mono">${escapeHtml(item.barcode)}</span>` },
      { label: 'จำนวนซ้ำ', width: '16%', align: 'center', render: (item) => `<span class="badge badge--orange">${item.count}</span>` },
      { label: 'ยอดปรับรวม', width: '22%', align: 'right', render: (item) => `<span class="cell-amount">${formatCurrency(item.totalFine)}</span>` },
      { label: 'ข้อมูลจากแถวต้นทาง', width: '34%', align: 'center', render: (item) => `<span class="cell-muted">${escapeHtml(item.rows.map(r => r.source_row).join(', '))}</span>` }
    ];

    return `
      <div class="table-card__header">
        <div class="table-card__title-area">
          ${ICONS.copy}
          <span class="table-card__title">บาร์โค้ดซ้ำ</span>
          <span class="table-card__row-count">${total} รายการ</span>
        </div>
        <div class="table-card__actions">
          <div class="table-search">
            <span class="table-search__icon">${ICONS.search}</span>
            <input type="text" class="table-search__input" placeholder="ค้นหา..." value="${escapeHtml(state.search)}" data-tab="dup-barcodes">
          </div>
        </div>
      </div>
      <div class="table-container">
        <table class="data-table">
          ${renderColGroup(columns)}
          <thead>
            <tr>
              ${columns.map(col => `<th class="${getColumnClass(col, 'th')}">${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0
        ? `<tr><td colspan="4" class="empty-state"><div class="empty-state__text">ไม่พบบาร์โค้ดซ้ำ</div></td></tr>`
        : filtered.map(item => `
                  <tr class="row-highlight">
                    ${columns.map(col => `<td class="${getColumnClass(col)}">${col.render(item)}</td>`).join('')}
                  </tr>
                `).join('')
      }
          </tbody>
        </table>
      </div>
    `;
  }

  // ── Tab: Amount Mismatches ──
  function renderMismatches(data) {
    const state = tableState['mismatches'];
    const mismatchData = FineData.getMismatchRows(data);
    const columns = [
      { label: 'แถว', width: '8%', align: 'right', render: (row) => row.source_row },
      { label: 'วันที่', width: '12%', align: 'left', render: (row) => formatDate(row.fine_date) },
      { label: 'บาร์โค้ด', width: '16%', align: 'left', render: (row) => `<span class="cell-mono">${escapeHtml(row.barcode)}</span>` },
      { label: 'ยอดปรับ', width: '12%', align: 'right', render: (row) => `<span class="cell-amount">${formatCurrency(row.fine_amount)}</span>` },
      { label: 'ชำระค่าปรับแล้ว', width: '13%', align: 'right', className: 'column-paid', render: (row) => `<span class="cell-amount">${formatCurrency(row.paid_amount || 0)}</span>` },
      { label: 'คงเหลือ (ต้นทาง)', width: '14%', align: 'right', render: (row) => `<span class="cell-amount cell-amount--negative">${formatCurrency(row.remaining_amount)}</span>` },
      { label: 'คงเหลือ (คำนวณ)', width: '15%', align: 'right', render: (row) => `<span class="cell-amount">${formatCurrency(row.computed_remaining)}</span>` },
      { label: 'สถานะ', width: '10%', align: 'center', className: 'cell-status column-status', render: () => `<span class="badge badge--red"><span class="flag-icon flag-icon--error">${ICONS.alertCircle}</span> ไม่ตรง</span>` }
    ];

    return `
      <div class="table-card__header">
        <div class="table-card__title-area">
          ${ICONS.notEqual}
          <span class="table-card__title">ข้อมูลยอดไม่ตรงกัน</span>
          <span class="table-card__row-count">${mismatchData.length} รายการ</span>
        </div>
      </div>
      <div class="table-container">
        <table class="data-table">
          ${renderColGroup(columns)}
          <thead>
            <tr>
              ${columns.map(col => `<th class="${getColumnClass(col, 'th')}">${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${mismatchData.length === 0
        ? `<tr><td colspan="8" class="empty-state"><div class="empty-state__text">ไม่พบข้อมูลที่ไม่ตรงกัน</div></td></tr>`
        : mismatchData.map(row => `
                  <tr class="row-error">
                    ${columns.map(col => `<td class="${getColumnClass(col)}">${col.render(row)}</td>`).join('')}
                  </tr>
                `).join('')
      }
          </tbody>
        </table>
      </div>
    `;
  }

  // ── Tab: Missing Data ──
  function renderMissingData(data) {
    const state = tableState['missing-data'];
    const missingData = data.filter(r => r.is_driver_blank || r.is_full_duplicate || r.is_barcode_duplicate);
    let filtered = filterBySearch(missingData, state.search);
    const total = filtered.length;
    const columns = [
      { label: 'แถว', width: '6%', align: 'right', render: (row) => row.source_row },
      { label: 'วันที่', width: '12%', align: 'left', render: (row) => formatDate(row.fine_date) },
      { label: 'ลูกค้า', width: '11%', align: 'left', render: (row) => escapeHtml(row.customer) },
      { label: 'บาร์โค้ด', width: '16%', align: 'left', render: (row) => `<span class="cell-mono">${escapeHtml(row.barcode)}</span>` },
      { label: 'พนักงาน', width: '18%', align: 'left', render: (row) => row.driver_name ? escapeHtml(row.driver_name) : `<span class="cell-muted">ไม่ระบุ</span>` },
      { label: 'ยอดปรับ', width: '12%', align: 'right', render: (row) => `<span class="cell-amount">${formatCurrency(row.fine_amount)}</span>` },
      {
        label: 'ปัญหา', width: '25%', align: 'center', className: 'cell-status', render: (row) => {
          const flags = [];
          if (row.is_driver_blank) flags.push(`<span class="badge badge--orange"><span class="flag-icon flag-icon--warning">${ICONS.warning}</span> ไม่ระบุชื่อ พขร.</span>`);
          if (row.is_full_duplicate) flags.push(`<span class="badge badge--red"><span class="flag-icon flag-icon--error">${ICONS.alertCircle}</span> ข้อมูลซ้ำ</span>`);
          if (row.is_barcode_duplicate && !row.is_full_duplicate) flags.push(`<span class="badge badge--orange"><span class="flag-icon flag-icon--warning">${ICONS.warning}</span> บาร์โค้ดซ้ำ</span>`);
          return flags.join(' ');
        }
      }
    ];

    return `
      <div class="table-card__header">
        <div class="table-card__title-area">
          ${ICONS.userX}
          <span class="table-card__title">ข้อมูลไม่ครบถ้วน</span>
          <span class="table-card__row-count">${total} รายการ</span>
        </div>
      </div>
      <div class="table-container">
        <table class="data-table">
          ${renderColGroup(columns)}
          <thead>
            <tr>
              ${columns.map(col => `<th class="${getColumnClass(col, 'th')}">${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0
        ? `<tr><td colspan="7" class="empty-state"><div class="empty-state__text">ไม่พบข้อมูลที่ไม่ครบถ้วน</div></td></tr>`
        : filtered.map(row => `
                  <tr class="row-highlight">
                    ${columns.map(col => `<td class="${getColumnClass(col)}">${col.render(row)}</td>`).join('')}
                  </tr>
                `).join('')
      }
          </tbody>
        </table>
      </div>
    `;
  }

  // ── Render ──
  function render(data) {
    currentData = data;
    const container = document.getElementById('tables-section');
    if (!container) return;

    const tabs = [
      { id: 'all-fines', label: 'รายการทั้งหมด', count: data.length },
      { id: 'dup-barcodes', label: 'บาร์โค้ดซ้ำ', count: FineData.getDuplicateBarcodeRows(data).length },
      { id: 'mismatches', label: 'ยอดไม่ตรง', count: FineData.getMismatchRows(data).length },
      { id: 'missing-data', label: 'ข้อมูลไม่ครบ', count: data.filter(r => r.is_driver_blank || r.is_full_duplicate || r.is_barcode_duplicate).length }
    ];

    let tableContent = '';
    switch (currentTab) {
      case 'all-fines': tableContent = renderAllFines(data); break;
      case 'dup-barcodes': tableContent = renderDuplicateBarcodes(data); break;
      case 'mismatches': tableContent = renderMismatches(data); break;
      case 'missing-data': tableContent = renderMissingData(data); break;
    }

    container.innerHTML = `
      <div class="tab-nav" id="table-tabs">
        ${tabs.map(tab => `
          <button class="tab-nav__item ${tab.id === currentTab ? 'active' : ''}" data-tab-id="${tab.id}">
            ${tab.label} <span class="tab-count">${tab.count}</span>
          </button>
        `).join('')}
      </div>
      <div class="table-card" id="table-card-content">
        ${tableContent}
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Tab switching
    document.querySelectorAll('#table-tabs .tab-nav__item').forEach(tab => {
      tab.addEventListener('click', () => {
        currentTab = tab.dataset.tabId;
        render(currentData);
      });
    });

    // Search
    document.querySelectorAll('.table-search__input').forEach(input => {
      input.addEventListener('input', debounce((e) => {
        const tabId = e.target.dataset.tab;
        tableState[tabId].search = e.target.value;
        tableState[tabId].page = 1;
        render(currentData);
        // Refocus input
        const newInput = document.querySelector(`.table-search__input[data-tab="${tabId}"]`);
        if (newInput) { newInput.focus(); newInput.selectionStart = newInput.value.length; }
      }, 300));
    });

    // Sort
    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const tabId = th.dataset.tab;
        const field = th.dataset.sort;
        const state = tableState[tabId];
        if (state.sortField === field) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortField = field;
          state.sortDir = 'asc';
        }
        render(currentData);
      });
    });

    // Pagination
    document.querySelectorAll('.table-pagination__btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        const page = parseInt(btn.dataset.page);
        if (isNaN(page) || page < 1) return;
        tableState[tabId].page = page;
        render(currentData);
      });
    });
  }

  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function update(data) {
    // Reset page to 1 on filter change
    Object.keys(tableState).forEach(k => { tableState[k].page = 1; });
    render(data);
  }

  return { render, update };
})();
