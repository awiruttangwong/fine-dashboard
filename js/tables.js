/* ============================================================
   Fine Dashboard — Tables
   Receiver-grouped summary with detail modal
   ============================================================ */

const Tables = (() => {
  const ICONS = {
    search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    chevronLeft: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
    chevronRight: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    sortAsc: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5l-7 7h14l-7-7z"/></svg>`,
    sortDesc: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 19l-7-7h14l-7 7z"/></svg>`,
    sortNone: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" opacity="0.3"><path d="M12 5l-5 5h10l-5-5z M12 19l-5-5h10l-5 5z"/></svg>`,
    list: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    userStack: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    external: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>`,
    close: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };

  const RECEIVER_FALLBACK_KEY = '__blank_receiver__';
  const RECEIVER_FALLBACK_LABEL = 'ไม่ระบุผู้รับโอน';
  const SUMMARY_TAB = 'receiver-summary';
  const INSTALLMENT_TAB = 'receiver-installment';
  const STATUS_WEIGHT = { paid: 1, partial: 2, open: 3 };

  let tableState = {
    [SUMMARY_TAB]: { page: 1, perPage: 12, sortField: 'total_remaining', sortDir: 'desc', search: '' },
    [INSTALLMENT_TAB]: { page: 1, perPage: 12, sortField: 'total_remaining', sortDir: 'desc', search: '' }
  };

  let currentData = [];
  let currentSummaryGroups = [];
  let currentInstallmentGroups = [];
  let currentGroups = [];
  let detailState = { receiverKey: null };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cleanText(value) {
    return String(value ?? '').trim();
  }

  function formatCurrency(val) {
    if (val === null || val === undefined) return '-';
    return new Intl.NumberFormat('th-TH').format(val) + ' ฿';
  }

  function formatDate(dateValue) {
    if (!dateValue) return '-';
    const parts = String(dateValue).split('-');
    if (parts.length !== 3) return escapeHtml(dateValue);
    return `${parseInt(parts[2], 10)}/${parseInt(parts[1], 10)}/${parts[0]}`;
  }

  function getSortIcon(field, state) {
    if (state.sortField !== field) return `<span class="sort-icon">${ICONS.sortNone}</span>`;
    return `<span class="sort-icon">${state.sortDir === 'asc' ? ICONS.sortAsc : ICONS.sortDesc}</span>`;
  }

  function getStatusMeta(status) {
    const map = {
      open: { label: 'ค้างชำระ', class: 'status-badge--open' },
      partial: { label: 'ผ่อนชำระ', class: 'status-badge--partial' },
      paid: { label: 'ชำระค่าปรับแล้ว', class: 'status-badge--paid' }
    };
    return map[status] || map.open;
  }

  function getStatusBadge(status) {
    const info = getStatusMeta(status);
    return `<span class="status-badge ${info.class}"><span class="status-dot"></span><span class="status-label">${info.label}</span></span>`;
  }

  function getColumnClass(col, target = 'td') {
    const classes = [
      col.className,
      target === 'th' ? col.thClass : col.tdClass,
      col.align ? `cell-${col.align}` : ''
    ];
    return classes.filter(Boolean).join(' ');
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

  function normalizeReceiverInfo(row) {
    const receiverLabel = cleanText(row.transfer_receiver_name);
    return {
      key: receiverLabel || RECEIVER_FALLBACK_KEY,
      label: receiverLabel || RECEIVER_FALLBACK_LABEL,
      isFallback: !receiverLabel
    };
  }

  function isInstallmentRow(row) {
    return row.source_type === 'LOAN' || row.installment_flag === true || row.payment_status === 'partial';
  }

  function sortRowsForDetail(rows) {
    return [...rows].sort((a, b) => {
      if (a.fine_date !== b.fine_date) {
        return a.fine_date > b.fine_date ? -1 : 1;
      }
      return (a.source_row || 0) - (b.source_row || 0);
    });
  }

  function deriveGroupPaymentStatus(group, mode = 'standard') {
    const fine = group.total_fine || 0;
    const paid = group.total_paid || 0;
    const remaining = group.total_remaining || 0;

    if (fine > 0 && paid >= fine && remaining <= 0) return 'paid';
    if (mode === 'installment') return 'partial';
    return 'open';
  }

  function buildReceiverGroups(data, mode = 'standard') {
    const groups = new Map();

    data.forEach(row => {
      const receiver = normalizeReceiverInfo(row);
      const groupKey = `${mode}::${receiver.key}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          receiver_key: groupKey,
          receiver_raw_key: receiver.key,
          receiver_label: receiver.label,
          receiver_missing: receiver.isFallback,
          view_mode: mode,
          total_fine: 0,
          total_paid: 0,
          total_remaining: 0,
          item_count: 0,
          customer_names: new Set(),
          rows: []
        });
      }

      const group = groups.get(groupKey);
      group.total_fine += row.fine_amount || 0;
      group.total_paid += row.paid_amount || 0;
      group.total_remaining += row.computed_remaining_amount || 0;
      group.item_count += 1;
      if (row.customer) group.customer_names.add(row.customer);
      group.rows.push(row);
    });

    return Array.from(groups.values()).map(group => {
      const rows = sortRowsForDetail(group.rows);
      const customerNames = Array.from(group.customer_names).sort();

      return {
        ...group,
        rows,
        customer_names: customerNames,
        customer_count: customerNames.length,
        latest_fine_date: rows[0]?.fine_date || null,
        payment_status: deriveGroupPaymentStatus(group, mode)
      };
    });
  }

  function sortGroups(data, field, dir) {
    return [...data].sort((a, b) => {
      if (field === 'payment_status') {
        const weightA = STATUS_WEIGHT[a.payment_status] || 99;
        const weightB = STATUS_WEIGHT[b.payment_status] || 99;
        if (weightA !== weightB) return dir === 'asc' ? weightA - weightB : weightB - weightA;
      }

      let valueA = a[field];
      let valueB = b[field];

      if (field === 'receiver_label') {
        valueA = a.receiver_missing ? `zzz_${a.receiver_label}` : a.receiver_label;
        valueB = b.receiver_missing ? `zzz_${b.receiver_label}` : b.receiver_label;
      }

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return dir === 'asc' ? valueA - valueB : valueB - valueA;
      }

      valueA = valueA ?? '';
      valueB = valueB ?? '';
      return dir === 'asc'
        ? String(valueA).localeCompare(String(valueB), 'th')
        : String(valueB).localeCompare(String(valueA), 'th');
    });
  }

  function filterGroupsBySearch(groups, search) {
    if (!search.trim()) return groups;
    const query = search.trim().toLowerCase();

    return groups.filter(group => {
      const haystack = [
        group.receiver_label,
        group.customer_names.join(' '),
        ...group.rows.flatMap(row => [
          row.customer,
          row.barcode,
          row.route_raw,
          row.driver_name,
          row.transfer_receiver_name
        ])
      ].join(' ').toLowerCase();

      return haystack.includes(query);
    });
  }

  function renderPagination(total, state, tabId) {
    const totalPages = Math.ceil(total / state.perPage);
    if (totalPages <= 1) return '';

    const start = (state.page - 1) * state.perPage + 1;
    const end = Math.min(state.page * state.perPage, total);
    const maxVisible = 5;
    let startPage = Math.max(1, state.page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

    let pages = '';
    for (let page = startPage; page <= endPage; page++) {
      pages += `<button class="table-pagination__btn ${page === state.page ? 'active' : ''}" data-tab="${tabId}" data-page="${page}">${page}</button>`;
    }

    return `
      <div class="table-pagination">
        <div class="table-pagination__info">แสดง ${start}-${end} จาก ${total} ผู้รับโอน</div>
        <div class="table-pagination__controls">
          <button class="table-pagination__btn" data-tab="${tabId}" data-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''}>${ICONS.chevronLeft}</button>
          ${pages}
          <button class="table-pagination__btn" data-tab="${tabId}" data-page="${state.page + 1}" ${state.page >= totalPages ? 'disabled' : ''}>${ICONS.chevronRight}</button>
        </div>
      </div>
    `;
  }

  function renderSummaryReceiverCell(group) {
    return `
      <div class="receiver-cell">
        <div class="receiver-cell__main">
          <div class="receiver-cell__title-wrap">
            <div class="receiver-cell__name">${escapeHtml(group.receiver_label)}</div>
            <div class="receiver-cell__hint">${group.receiver_missing ? 'กลุ่มรายการที่ยังไม่ระบุผู้รับโอน' : 'คลิกเพื่อดูรายละเอียดรายการทั้งหมด'}</div>
          </div>
          <button type="button" class="receiver-cell__action" data-detail-trigger="${escapeHtml(group.receiver_key)}" aria-label="ดูรายละเอียด ${escapeHtml(group.receiver_label)}">
            ดูรายละเอียด
            <span aria-hidden="true">${ICONS.external}</span>
          </button>
        </div>
        <div class="receiver-cell__meta">
          <span class="receiver-chip">${group.item_count} รายการ</span>
          <span class="receiver-chip">${group.customer_count} ลูกค้า</span>
          ${getStatusBadge(group.payment_status)}
        </div>
      </div>
    `;
  }

  function renderReceiverSummary(data, options = {}) {
    const {
      tabId = SUMMARY_TAB,
      title = 'สรุปตามผู้รับโอน',
      rowCountLabel = 'ผู้รับโอน',
      summaryNote = 'รวมยอดตามผู้รับโอนก่อน และกดดูรายละเอียดเพื่อเปิดรายการย่อยทั้งหมดของแต่ละกลุ่ม',
      searchPlaceholder = 'ค้นหาผู้รับโอน, ลูกค้า, บาร์โค้ด...'
    } = options;
    const state = tableState[tabId];
    const searchedGroups = filterGroupsBySearch(data, state.search);
    const sortedGroups = sortGroups(searchedGroups, state.sortField, state.sortDir);
    const totalGroups = sortedGroups.length;
    const paginatedGroups = sortedGroups.slice((state.page - 1) * state.perPage, state.page * state.perPage);

    const columns = [
      {
        field: 'receiver_label',
        label: 'ผู้รับโอน',
        width: '43%',
        align: 'left',
        render: renderSummaryReceiverCell
      },
      {
        field: 'total_fine',
        label: 'ยอดปรับ',
        width: '19%',
        align: 'right',
        className: 'column-financial',
        render: (group) => `<span class="cell-amount">${formatCurrency(group.total_fine)}</span>`
      },
      {
        field: 'total_paid',
        label: 'ชำระค่าปรับแล้ว',
        width: '19%',
        align: 'right',
        className: 'column-financial column-paid',
        render: (group) => `<span class="cell-amount ${group.total_paid > 0 ? 'cell-amount--positive' : ''}">${formatCurrency(group.total_paid)}</span>`
      },
      {
        field: 'total_remaining',
        label: 'คงเหลือ',
        width: '19%',
        align: 'right',
        className: 'column-financial',
        render: (group) => `<span class="cell-amount ${group.total_remaining > 0 ? 'cell-amount--negative' : ''}">${formatCurrency(group.total_remaining)}</span>`
      }
    ];

    return `
      <div class="table-card__header table-card__header--stacked">
        <div class="table-card__title-block">
          <div class="table-card__title-area">
            ${ICONS.userStack}
            <span class="table-card__title">${title}</span>
            <span class="table-card__row-count">${totalGroups} ${rowCountLabel}</span>
          </div>
          <div class="table-card__summary-note">
            ${summaryNote}
          </div>
        </div>
        <div class="table-card__actions">
          <div class="table-search">
            <span class="table-search__icon">${ICONS.search}</span>
            <input
              type="text"
              class="table-search__input"
              placeholder="${searchPlaceholder}"
              value="${escapeHtml(state.search)}"
              data-tab="${tabId}">
          </div>
        </div>
      </div>
      <div class="table-container">
        <table class="data-table data-table--receiver-summary" id="table-${tabId}">
          ${renderColGroup(columns)}
          <thead>
            <tr>
              ${columns.map(col => `<th class="${getColumnClass(col, 'th')}" data-tab="${tabId}" data-sort="${col.field}">${col.label} ${getSortIcon(col.field, state)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${paginatedGroups.length === 0
              ? `<tr><td colspan="${columns.length}" class="empty-state"><div class="empty-state__text">ไม่พบข้อมูลผู้รับโอนที่ตรงกับเงื่อนไข</div></td></tr>`
              : paginatedGroups.map(group => `
                  <tr class="summary-row" tabindex="0" role="button" data-detail-trigger="${escapeHtml(group.receiver_key)}" aria-label="เปิดรายละเอียด ${escapeHtml(group.receiver_label)}">
                    ${columns.map(col => `<td class="${getColumnClass(col)}">${col.render(group)}</td>`).join('')}
                  </tr>
                `).join('')
            }
          </tbody>
        </table>
      </div>
      ${renderPagination(totalGroups, state, tabId)}
    `;
  }

  function renderDetailRows(rows) {
    const columns = [
      { field: 'fine_date', label: 'วันที่', width: '112px', align: 'left', render: row => formatDate(row.fine_date) },
      { field: 'customer', label: 'ลูกค้า', width: '88px', align: 'left', render: row => escapeHtml(row.customer) },
      { field: 'barcode', label: 'บาร์โค้ด', width: '150px', align: 'left', render: row => `<span class="cell-mono">${escapeHtml(row.barcode)}</span>` },
      { field: 'route_raw', label: 'เส้นทาง', width: '320px', align: 'left', render: row => `<code class="cell-mono table-inline-code">${escapeHtml(row.route_raw)}</code>` },
      { field: 'driver_name', label: 'ชื่อ พขร', width: '180px', align: 'left', render: row => row.driver_name ? escapeHtml(row.driver_name) : `<span class="cell-muted">ไม่ระบุ</span>` },
      { field: 'fine_amount', label: 'ยอดปรับ', width: '110px', align: 'right', className: 'column-financial', render: row => `<span class="cell-amount">${formatCurrency(row.fine_amount)}</span>` },
      { field: 'paid_amount', label: 'ชำระค่าปรับแล้ว', width: '150px', align: 'right', className: 'column-financial column-paid', render: row => `<span class="cell-amount ${row.paid_amount > 0 ? 'cell-amount--positive' : ''}">${formatCurrency(row.paid_amount || 0)}</span>` },
      { field: 'computed_remaining', label: 'คงเหลือ', width: '120px', align: 'right', className: 'column-financial', render: row => `<span class="cell-amount ${row.computed_remaining > 0 ? 'cell-amount--negative' : ''}">${formatCurrency(row.computed_remaining)}</span>` },
      { field: 'payment_status', label: 'สถานะ', width: '136px', align: 'center', className: 'cell-status column-status column-status-detail', render: row => getStatusBadge(row.payment_status) }
    ];

    return `
      <div class="table-container table-container--modal">
        <table class="data-table data-table--detail">
          ${renderColGroup(columns)}
          <thead>
            <tr>
              ${columns.map(col => `<th class="${getColumnClass(col, 'th')}">${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${columns.map(col => `<td class="${getColumnClass(col)}">${col.render(row)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderDetailModal() {
    const modalRoot = ensureModalRoot();
    const activeGroup = currentGroups.find(group => group.receiver_key === detailState.receiverKey);

    if (!activeGroup) {
      modalRoot.innerHTML = '';
      document.body.classList.remove('modal-open');
      return;
    }

    document.body.classList.add('modal-open');
    const isInstallmentView = activeGroup.view_mode === 'installment';
    modalRoot.innerHTML = `
      <div class="table-modal" role="dialog" aria-modal="true" aria-labelledby="receiver-detail-title">
        <div class="table-modal__backdrop" data-modal-close></div>
        <div class="table-modal__dialog">
          <div class="table-modal__header">
            <div class="table-modal__title-wrap">
              <div class="table-modal__eyebrow">${isInstallmentView ? 'รายละเอียดผ่อนชำระ' : 'รายละเอียดผู้รับโอน'}</div>
              <h3 class="table-modal__title" id="receiver-detail-title">${escapeHtml(activeGroup.receiver_label)}</h3>
              <div class="table-modal__subtitle">
                ${isInstallmentView
                  ? 'แสดงเฉพาะรายการจากชีท LOAN ของผู้รับโอนนี้ โดยยอดรวมด้านล่างต้องสอดคล้องกับยอดสรุปในตารางผ่อนชำระ'
                  : 'แสดงรายละเอียดรายการทั้งหมดในกลุ่มนี้ โดยยอดรวมด้านล่างต้องสอดคล้องกับยอดสรุปในตารางหลัก'}
              </div>
            </div>
            <button type="button" class="table-modal__close" data-modal-close aria-label="ปิดหน้าต่างรายละเอียด">
              ${ICONS.close}
            </button>
          </div>

          <div class="table-modal__summary">
            <div class="table-modal__stat">
              <div class="table-modal__stat-label">รายการทั้งหมด</div>
              <div class="table-modal__stat-value">${activeGroup.item_count}</div>
            </div>
            <div class="table-modal__stat">
              <div class="table-modal__stat-label">ยอดปรับ</div>
              <div class="table-modal__stat-value">${formatCurrency(activeGroup.total_fine)}</div>
            </div>
            <div class="table-modal__stat">
              <div class="table-modal__stat-label">ชำระค่าปรับแล้ว</div>
              <div class="table-modal__stat-value table-modal__stat-value--positive">${formatCurrency(activeGroup.total_paid)}</div>
            </div>
            <div class="table-modal__stat">
              <div class="table-modal__stat-label">คงเหลือ</div>
              <div class="table-modal__stat-value ${activeGroup.total_remaining > 0 ? 'table-modal__stat-value--negative' : ''}">${formatCurrency(activeGroup.total_remaining)}</div>
            </div>
          </div>

          <div class="table-modal__body">
            ${renderDetailRows(activeGroup.rows)}
          </div>
        </div>
      </div>
    `;

    bindModalEvents();
  }

  function ensureModalRoot() {
    let root = document.getElementById('receiver-detail-modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'receiver-detail-modal-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function openDetail(receiverKey) {
    detailState.receiverKey = receiverKey;
    renderDetailModal();
  }

  function closeDetail() {
    detailState.receiverKey = null;
    renderDetailModal();
  }

  function bindModalEvents() {
    const modalRoot = document.getElementById('receiver-detail-modal-root');
    if (!modalRoot) return;

    modalRoot.querySelectorAll('[data-modal-close]').forEach(node => {
      node.addEventListener('click', closeDetail);
    });
  }

  function onEscapeClose(event) {
    if (event.key === 'Escape' && detailState.receiverKey) closeDetail();
  }

  function render(data) {
    currentData = data;
    const summaryRows = data.filter(row => !isInstallmentRow(row));
    const installmentRows = data.filter(isInstallmentRow);
    currentSummaryGroups = buildReceiverGroups(summaryRows, 'standard');
    currentInstallmentGroups = buildReceiverGroups(installmentRows, 'installment');
    currentGroups = [...currentSummaryGroups, ...currentInstallmentGroups];

    if (detailState.receiverKey && !currentGroups.some(group => group.receiver_key === detailState.receiverKey)) {
      detailState.receiverKey = null;
    }

    const container = document.getElementById('tables-section');
    if (!container) return;

    container.innerHTML = `
      <div class="table-card" id="table-card-content">
        ${renderReceiverSummary(currentSummaryGroups, {
          tabId: SUMMARY_TAB,
          title: 'สรุปตามผู้รับโอน',
          rowCountLabel: 'ผู้รับโอน',
          summaryNote: 'รวมยอดจากรายการปกติตามผู้รับโอนก่อน และกดดูรายละเอียดเพื่อเปิดรายการย่อยทั้งหมดของแต่ละกลุ่ม',
          searchPlaceholder: 'ค้นหาผู้รับโอน, ลูกค้า, บาร์โค้ด...'
        })}
      </div>
      ${currentInstallmentGroups.length > 0 ? `
        <div class="table-card">
          ${renderReceiverSummary(currentInstallmentGroups, {
            tabId: INSTALLMENT_TAB,
            title: 'สรุปผ่อนชำระ',
            rowCountLabel: 'ผู้รับโอน',
            summaryNote: 'แสดงเฉพาะรายการจากชีท LOAN เพื่อแยกการติดตามผ่อนชำระออกจากตารางหลัก โดยยอดยังสัมพันธ์กับข้อมูลรวมของเดือนเดียวกัน',
            searchPlaceholder: 'ค้นหาผู้รับโอนผ่อนชำระ, ลูกค้า, บาร์โค้ด...'
          })}
        </div>
      ` : ''}
    `;

    bindEvents();
    renderDetailModal();
  }

  function bindEvents() {
    document.querySelectorAll('.table-search__input').forEach(input => {
      input.addEventListener('input', debounce((event) => {
        const tabId = event.target.dataset.tab;
        tableState[tabId].search = event.target.value;
        tableState[tabId].page = 1;
        render(currentData);
        const newInput = document.querySelector(`.table-search__input[data-tab="${tabId}"]`);
        if (newInput) {
          newInput.focus();
          newInput.selectionStart = newInput.value.length;
        }
      }, 250));
    });

    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const tabId = th.dataset.tab;
        const field = th.dataset.sort;
        const state = tableState[tabId];
        if (state.sortField === field) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortField = field;
          state.sortDir = field === 'receiver_label' ? 'asc' : 'desc';
        }
        render(currentData);
      });
    });

    document.querySelectorAll('.table-pagination__btn[data-page]').forEach(button => {
      button.addEventListener('click', () => {
        const tabId = button.dataset.tab;
        const page = parseInt(button.dataset.page, 10);
        if (Number.isNaN(page) || page < 1) return;
        tableState[tabId].page = page;
        render(currentData);
      });
    });

    document.querySelectorAll('[data-detail-trigger]').forEach(node => {
      const handler = (event) => {
        event.preventDefault();
        event.stopPropagation();
        openDetail(node.dataset.detailTrigger);
      };

      node.addEventListener('click', handler);

      if (node.matches('tr.summary-row')) {
        node.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDetail(node.dataset.detailTrigger);
          }
        });
      }
    });
  }

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function update(data) {
    Object.keys(tableState).forEach(key => {
      tableState[key].page = 1;
    });
    render(data);
  }

  document.addEventListener('keydown', onEscapeClose);

  return { render, update };
})();
