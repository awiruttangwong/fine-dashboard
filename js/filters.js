/* ============================================================
   Fine Dashboard — Filters
   State management, UI rendering, reactive updates
   All icons use inline SVG — no emoji
   ============================================================ */

const Filters = (() => {
  // ── SVG Icons ──
  const ICONS = {
    calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    building: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="1"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><path d="M9 18h6v4H9z"/></svg>`,
    truck: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
    route: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11.5" cy="8.5" r="3.5"/><path d="M11.5 12v6"/><path d="M7 22h9"/><path d="M3 6l3-3 3 3"/><path d="M21 18l-3 3-3-3"/></svg>`,
    vehicleType: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>`,
    mapPin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    creditCard: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    filter: `<svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 -960 960 960" width="22" fill="#999999"><path d="M80-200v-80h400v80H80Zm0-200v-80h200v80H80Zm0-200v-80h200v80H80Zm744 400L670-354q-24 17-52.5 25.5T560-320q-83 0-141.5-58.5T360-520q0-83 58.5-141.5T560-720q83 0 141.5 58.5T760-520q0 29-8.5 57.5T726-410l154 154-56 56ZM560-400q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Z"/></svg>`,
    x: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };

  let state = {
    selectedMonth: '',
    customers: [],
    driver: '',
    routeGroups: [],
    vehicleType: '',
    routeStatuses: [],
    paymentStatuses: [],
    qualityFlags: [],
    searchText: ''
  };

  let onChangeCallback = null;
  let container = null;

  function getState() { return { ...state }; }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setState(newState) {
    state = { ...state, ...newState };
    if (onChangeCallback) onChangeCallback(state);
  }

  function resetAll() {
    state = {
      selectedMonth: FineData.getDefaultMonth(),
      customers: [], driver: '',
      routeGroups: [], vehicleType: '',
      routeStatuses: [], paymentStatuses: [],
      qualityFlags: [], searchText: ''
    };
    render();
    if (onChangeCallback) onChangeCallback(state);
  }

  function getActiveFilterCount() {
    let count = 0;
    // selectedMonth is always active — don't count it as a manual filter
    if (state.customers.length > 0) count++;
    if (state.driver) count++;
    if (state.routeGroups.length > 0) count++;
    if (state.vehicleType) count++;
    if (state.routeStatuses.length > 0) count++;
    if (state.paymentStatuses.length > 0) count++;
    if (state.qualityFlags.length > 0) count++;
    return count;
  }

  function toggleArrayItem(arr, item) {
    const idx = arr.indexOf(item);
    return idx >= 0 ? arr.filter(x => x !== item) : [...arr, item];
  }

  function createChipGroup(label, iconSvg, items, selectedItems, filterType) {
    return `
      <div class="filter-group">
        <div class="filter-group__label">
          <span class="filter-group__label-icon">${iconSvg}</span>
          ${label}
        </div>
        <div class="chip-group">
          ${items.map(item => {
      const isActive = selectedItems.includes(item.value);
      const countHtml = item.count !== undefined ? `<span class="chip__count">${item.count}</span>` : '';
      return `<button class="chip ${isActive ? 'active' : ''}" 
                      data-filter-type="${escapeHtml(filterType)}" data-value="${escapeHtml(item.value)}">
                      ${escapeHtml(item.label)} ${countHtml}
                    </button>`;
    }).join('')}
        </div>
      </div>
    `;
  }

  function render() {
    if (!container) container = document.getElementById('sidebar-filters');
    if (!container) return;

    const allData = FineData.getAll();
    if (!state.selectedMonth) state.selectedMonth = FineData.getDefaultMonth();
    const aggregates = FineData.getAggregates(allData);
    const drivers = FineData.getUniqueValues('driver_name');
    const vehicleTypes = FineData.getUniqueValues('vehicle_type');

    const customerItems = Object.entries(aggregates.customerBreakdown)
      .map(([name, data]) => ({ value: name, label: name, count: data.count }))
      .sort((a, b) => b.count - a.count);

    const paymentStatusLabels = {
      'open': 'ค้างชำระ', 'paid': 'ชำระแล้ว', 'partial': 'ชำระบางส่วน',
      'overpaid': 'ชำระเกิน', 'data_error': 'ข้อมูลผิดพลาด'
    };
    const paymentStatusItems = Object.entries(aggregates.paymentStatusCounts)
      .map(([name, count]) => ({ value: name, label: paymentStatusLabels[name] || name, count }))
      .sort((a, b) => b.count - a.count);

    const routeGroupItems = Object.entries(aggregates.routeGroupCounts)
      .map(([name, count]) => ({ value: name, label: name, count }))
      .sort((a, b) => b.count - a.count);

    const routeStatusItems = Object.entries(aggregates.routeStatusCounts)
      .map(([name, count]) => ({ value: name, label: name, count }))
      .sort((a, b) => b.count - a.count);

    const qualityFlagItems = [
      { value: 'duplicate', label: 'ข้อมูลซ้ำ', count: allData.filter(r => r.is_full_duplicate || r.is_barcode_duplicate).length },
      { value: 'mismatch', label: 'ยอดไม่ตรง', count: allData.filter(r => r.has_amount_mismatch).length },
      { value: 'blank_driver', label: 'ไม่ระบุพนักงาน', count: allData.filter(r => r.is_driver_blank).length }
    ].filter(item => item.count > 0);

    const activeCount = getActiveFilterCount();
    const activeCountBadge = activeCount > 0 ? `<span class="active-filter-count">${activeCount}</span>` : '';

    container.innerHTML = `
      <div class="filter-group" style="margin-bottom: var(--space-4);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3);">
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px;">${ICONS.filter}</span>
            <span style="font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); line-height: 1; display: inline-flex; align-items: center;">ตัวกรอง</span>
            ${activeCountBadge}
          </div>
          ${activeCount > 0 ? `<button class="btn btn--ghost btn--sm" id="btn-reset-filters">${ICONS.x} ล้าง</button>` : ''}
        </div>
      </div>

      <!-- ค้นหาข้อมูล (Global Search) -->
      <div class="filter-group">
        <div class="filter-group__label">
          <span class="filter-group__label-icon">${ICONS.search}</span>
          ค้นหาข้อมูล
        </div>
        <div style="position: relative;">
          <input type="text" class="text-input" id="filter-search-text" 
                 placeholder="บาร์โค้ด, เส้นทาง, พนักงาน..." value="${escapeHtml(state.searchText)}"
                 style="padding-right: var(--space-8);">
          ${state.searchText ? `
            <button id="clear-search-btn" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: none; background: none; cursor: pointer; color: var(--color-text-muted); display: flex; align-items: center; justify-content: center;">
              ${ICONS.x}
            </button>
          ` : ''}
        </div>
      </div>

      ${(() => {
        const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
        const months = FineData.getAvailableMonths();
        const selectedYear = state.selectedMonth ? parseInt(state.selectedMonth.slice(0, 4)) : new Date().getFullYear();
        const buddhistYear = selectedYear + 543;
        const chips = months.map(value => {
          const i = parseInt(value.slice(5, 7)) - 1;
          const isActive = state.selectedMonth === value;
          return `<button class="chip month-chip ${isActive ? 'active' : ''}" data-month-value="${escapeHtml(value)}">${escapeHtml(THAI_MONTHS[i])}</button>`;
        }).join('');
        return `
          <div class="filter-group">
            <div class="filter-group__label" style="justify-content:space-between;">
              <span style="display:flex;align-items:center;gap:var(--space-2);">
                <span class="filter-group__label-icon">${ICONS.calendar}</span>
                เดือน
              </span>
              <span style="font-size:var(--font-size-xs);font-weight:var(--font-weight-semibold);color:var(--color-text-primary);">ปี ${escapeHtml(buddhistYear)}</span>
            </div>
            <div class="month-chip-grid">${chips}</div>
          </div>
        `;
      })()}

      ${createChipGroup('ลูกค้า', ICONS.building, customerItems, state.customers, 'customers')}

      ${createChipGroup('กลุ่มเส้นทาง', ICONS.route, routeGroupItems, state.routeGroups, 'routeGroups')}

      <div class="filter-group">
        <div class="filter-group__label">
          <span class="filter-group__label-icon">${ICONS.truck}</span>
          พนักงานขับรถ
        </div>
        <select class="select-input" id="filter-driver">
          <option value="">ทั้งหมด (${drivers.length} คน)</option>
          ${drivers.map(d => `<option value="${escapeHtml(d)}" ${state.driver === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
        </select>
      </div>

      <div class="filter-group">
        <div class="filter-group__label">
          <span class="filter-group__label-icon">${ICONS.vehicleType}</span>
          ประเภทรถ
        </div>
        <select class="select-input" id="filter-vehicle-type">
          <option value="">ทั้งหมด</option>
          ${vehicleTypes.map(v => `<option value="${escapeHtml(v)}" ${state.vehicleType === v ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
        </select>
      </div>

      ${createChipGroup('สถานะเส้นทาง', ICONS.mapPin, routeStatusItems, state.routeStatuses, 'routeStatuses')}
      ${createChipGroup('สถานะการชำระ', ICONS.creditCard, paymentStatusItems, state.paymentStatuses, 'paymentStatuses')}
      ${qualityFlagItems.length > 0 ? createChipGroup('ความถูกต้องของข้อมูล', ICONS.search, qualityFlagItems, state.qualityFlags, 'qualityFlags') : ''}
    `;

    // ── Bind events ──
    const searchInput = container.querySelector('#filter-search-text');
    if (searchInput) {
      searchInput.addEventListener('input', debounce((e) => {
        setState({ searchText: e.target.value });
        // Re-render clear button when it transitions from empty to non-empty
        if (!e.target.value || e.target.value.length === 1) {
          render();
          const freshInput = container.querySelector('#filter-search-text');
          if (freshInput) {
            freshInput.focus();
            freshInput.selectionStart = freshInput.selectionEnd = freshInput.value.length;
          }
        }
      }, 250));
    }

    const clearSearchBtn = container.querySelector('#clear-search-btn');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        setState({ searchText: '' });
        render();
      });
    }

    // Month chip selection
    container.querySelectorAll('.month-chip[data-month-value]').forEach(btn => {
      btn.addEventListener('click', () => {
        setState({ selectedMonth: btn.dataset.monthValue });
        render();
      });
    });

    const driverSelect = container.querySelector('#filter-driver');
    if (driverSelect) driverSelect.addEventListener('change', (e) => setState({ driver: e.target.value }));

    const vehicleSelect = container.querySelector('#filter-vehicle-type');
    if (vehicleSelect) vehicleSelect.addEventListener('change', (e) => setState({ vehicleType: e.target.value }));

    container.querySelectorAll('.chip[data-filter-type]').forEach(chip => {
      chip.addEventListener('click', () => {
        const type = chip.dataset.filterType;
        const value = chip.dataset.value;
        setState({ [type]: toggleArrayItem(state[type] || [], value) });
        render();
      });
    });

    const resetBtn = container.querySelector('#btn-reset-filters');
    if (resetBtn) resetBtn.addEventListener('click', resetAll);
  }

  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function onChange(callback) { onChangeCallback = callback; }

  return { render, getState, setState, resetAll, onChange, getActiveFilterCount };
})();
