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
    filter: `<svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 -960 960 960" width="22" fill="currentColor"><path d="M80-200v-80h400v80H80Zm0-200v-80h200v80H80Zm0-200v-80h200v80H80Zm744 400L670-354q-24 17-52.5 25.5T560-320q-83 0-141.5-58.5T360-520q0-83 58.5-141.5T560-720q83 0 141.5 58.5T760-520q0 29-8.5 57.5T726-410l154 154-56 56ZM560-400q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Z"/></svg>`,
    x: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };

  let state = {
    selectedMonth: '',
    comparisonMonth: '',
    isComparisonMode: false,
    customers: [],
    driver: '',
    routeGroups: [],
    vehicleType: '',
    routeStatuses: [],
    paymentStatuses: [],
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
    const isComparisonMode = state.isComparisonMode;
    const selectedMonth = FineData.getDefaultMonth();
    state = {
      selectedMonth,
      comparisonMonth: '',
      isComparisonMode,
      customers: [], driver: '',
      routeGroups: [], vehicleType: '',
      routeStatuses: [], paymentStatuses: [],
      searchText: ''
    };
    render();
    if (onChangeCallback) onChangeCallback(state);
  }

  function getActiveFilterCount() {
    let count = 0;
    // selectedMonth is always active — don't count it as a manual filter
    if (state.customers.length > 0) count++;
    if (state.driver) count++;
    if (state.vehicleType) count++;
    if (state.paymentStatuses.length > 0) count++;
    return count;
  }

  function toggleArrayItem(arr, item) {
    const idx = arr.indexOf(item);
    return idx >= 0 ? arr.filter(x => x !== item) : [...arr, item];
  }

  function uniqueValues(values, limit = 120) {
    const seen = new Set();
    const result = [];

    values.forEach(value => {
      const text = String(value ?? '').trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      result.push(text);
    });

    return result.slice(0, limit);
  }

  function formatMonthLabel(monthValue) {
    const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const match = String(monthValue || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return String(monthValue || '');
    return `${thaiMonths[Number(match[2]) - 1]} ${Number(match[1]) + 543}`;
  }

  function getSearchSuggestions(rows) {
    return uniqueValues([
      ...rows.map(row => row.barcode),
      ...rows.map(row => row.route_raw),
      ...rows.map(row => row.driver_name),
      ...rows.map(row => row.customer)
    ]);
  }

  function getMatchingSuggestions(suggestions, query, limit = 20) {
    const normalizedQuery = String(query ?? '').trim().toLowerCase();
    if (!normalizedQuery) return [];

    const startsWithMatches = [];
    const includesMatches = [];

    suggestions.forEach(value => {
      const normalizedValue = String(value ?? '').trim().toLowerCase();
      if (!normalizedValue) return;
      if (normalizedValue.startsWith(normalizedQuery)) {
        startsWithMatches.push(value);
      } else if (normalizedValue.includes(normalizedQuery)) {
        includesMatches.push(value);
      }
    });

    return [...startsWithMatches, ...includesMatches].slice(0, limit);
  }

  function getMonthScopedRows() {
    return FineData.getFiltered({
      selectedMonth: state.selectedMonth,
      customers: [],
      driver: '',
      routeGroups: [],
      vehicleType: '',
      routeStatuses: [],
      paymentStatuses: [],
      searchText: ''
    });
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
    const availableMonths = FineData.getAvailableMonths();
    if (!availableMonths.includes(state.selectedMonth)) state.selectedMonth = FineData.getDefaultMonth();
    const monthScopedRows = getMonthScopedRows();
    const aggregates = FineData.getAggregates(monthScopedRows);
    const drivers = uniqueValues(monthScopedRows.map(row => row.driver_name));
    const vehicleTypes = uniqueValues(monthScopedRows.map(row => row.vehicle_type));
    const searchSuggestions = getSearchSuggestions(monthScopedRows);

    const customerItems = Object.entries(aggregates.customerBreakdown)
      .map(([name, data]) => ({ value: name, label: name, count: data.count }))
      .filter(item => String(item.label || '').trim() !== '')
      .sort((a, b) => b.count - a.count);

    const availableCustomers = new Set(customerItems.map(item => item.value));
    const nextCustomers = state.customers.filter(customer => availableCustomers.has(customer));
    const statePatches = {};
    if (nextCustomers.length !== state.customers.length) {
      statePatches.customers = nextCustomers;
    }
    if (state.driver && !drivers.includes(state.driver)) {
      statePatches.driver = '';
    }
    if (state.vehicleType && !vehicleTypes.includes(state.vehicleType)) {
      statePatches.vehicleType = '';
    }
    if (Object.keys(statePatches).length > 0) {
      state = { ...state, ...statePatches };
      if (onChangeCallback) onChangeCallback(state);
    }

    const paymentStatusLabels = {
      'open': 'ค้างชำระ',
      'partial': 'ผ่อนชำระ',
      'paid': 'ชำระค่าปรับแล้ว'
    };
    const paymentStatusItems = Object.entries(aggregates.paymentStatusCounts)
      .map(([name, count]) => ({ value: name, label: paymentStatusLabels[name] || name, count }))
      .filter(item => item.label)
      .sort((a, b) => b.count - a.count);

    const activeCount = getActiveFilterCount();
    const activeCountBadge = activeCount > 0 ? `<span class="active-filter-count">${activeCount}</span>` : '';

    container.innerHTML = `
      <div class="filter-group" style="margin-bottom: var(--space-4);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3);">
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; margin-top: -3px;">${ICONS.filter}</span>
            <span style="font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); line-height: 1; display: inline-flex; align-items: center;">ตัวกรอง</span>
            ${activeCountBadge}
          </div>
          ${activeCount > 0 ? `<button class="btn btn--ghost btn--sm" id="btn-reset-filters">${ICONS.x} ล้าง</button>` : ''}
        </div>
      </div>

      <!-- ค้นหาข้อมูล (Global Search - Custom Select Pattern) -->
      <div class="filter-group">
        <div class="filter-group__label">
          <span class="filter-group__label-icon">${ICONS.search}</span>
          ค้นหาข้อมูล
        </div>
        <div class="custom-select" id="search-custom-select">
          <div class="custom-select__trigger">
            <span class="custom-select__placeholder">${state.searchText ? escapeHtml(state.searchText) : '<span style="color: var(--color-text-placeholder)">พิมพ์เพื่อค้นหา...</span>'}</span>
            <svg width="10" height="10" viewBox="0 0 12 12" style="fill: none; stroke: #86868B; stroke-width: 1.5; stroke-linecap: round;"><path d="M3 4.5L6 7.5L9 4.5" /></svg>
          </div>
          <div class="custom-select__dropdown">
            <div class="custom-select__search-wrapper">
              <div class="search-input-wrapper">
                <input type="text" class="custom-select__search" id="search-custom-input" placeholder="บาร์โค้ด, เส้นทาง, ชื่อ พขร..." autocomplete="off">
                <span class="search-input-clear" id="search-input-clear" style="display: none;">${ICONS.x}</span>
              </div>
            </div>
            <div class="custom-select__options" id="search-custom-options">

              <div class="custom-select__no-results" style="display: none;">ไม่พบข้อมูลที่ค้นหา</div>
            </div>
          </div>
        </div>
      </div>

      ${(() => {
        const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const months = FineData.getAvailableMonths();
        const chips = months.map(value => {
          const i = parseInt(value.slice(5, 7)) - 1;
          const isActive = state.selectedMonth === value;
          return `<button class="chip month-chip ${isActive ? 'active' : ''}" data-month-value="${escapeHtml(value)}">${escapeHtml(THAI_MONTHS[i])}</button>`;
        }).join('');
        return `
          <div class="filter-group">
            <div class="filter-month-label">
              <span class="filter-month-label__left">
                <span class="filter-group__label-icon" style="margin-top: -2px;">${ICONS.calendar}</span>
                เดือน
              </span>
              <span class="filter-month-label__right">
                <button class="comparison-switch ${state.isComparisonMode ? 'active' : ''}" id="comparison-mode-toggle"
                        type="button" aria-pressed="${state.isComparisonMode}">
                  <span class="comparison-switch__label">ภาพรวม</span>
                  <span class="comparison-switch__track" aria-hidden="true">
                    <span class="comparison-switch__thumb"></span>
                  </span>
                </button>
              </span>
            </div>
            ${state.isComparisonMode ? `
              <div class="yearly-mode-banner">
                <div class="yearly-mode-banner__text">
                  <span class="yearly-mode-banner__label">ภาพรวมทั้งปี</span>
                  <span class="yearly-mode-banner__year">พ.ศ. ${FineData.nowInThailand().getFullYear() + 543}</span>
                </div>
                <div class="yearly-mode-banner__badge">12 เดือน</div>
              </div>
            ` : `
              <div class="month-chip-grid">${chips}</div>
            `}
          </div>
        `;
      })()}

      ${createChipGroup('ลูกค้า', ICONS.building, customerItems, state.customers, 'customers')}

      <div class="filter-group">
        <div class="filter-group__label">
          <span class="filter-group__label-icon">${ICONS.truck}</span>
          ชื่อ พขร
        </div>
        <div class="custom-select" id="driver-custom-select">
          <div class="custom-select__trigger">
            <span>${state.driver ? escapeHtml(state.driver) : `ทั้งหมด (${drivers.length} คน)`}</span>
            <svg width="10" height="10" viewBox="0 0 12 12" style="fill: none; stroke: #86868B; stroke-width: 1.5; stroke-linecap: round;"><path d="M3 4.5L6 7.5L9 4.5" /></svg>
          </div>
          <div class="custom-select__dropdown">
            <div class="custom-select__search-wrapper">
              <div class="search-input-wrapper">
                <input type="text" class="custom-select__search" id="driver-search-input" placeholder="ค้นหาชื่อ พขร..." autocomplete="off">
                <span class="search-input-clear" id="driver-input-clear" style="display: none;">${ICONS.x}</span>
              </div>
            </div>
            <div class="custom-select__options">
              <div class="custom-select__option ${!state.driver ? 'selected' : ''}" data-value="">ทั้งหมด (${drivers.length} คน)</div>
              ${drivers.map(d => {
        const isSelected = state.driver === d;
        return `<div class="custom-select__option ${isSelected ? 'selected' : ''}" data-value="${escapeHtml(d)}">${escapeHtml(d)}</div>`;
      }).join('')}
            </div>
          </div>
        </div>
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

      ${createChipGroup('สถานะการชำระ', ICONS.creditCard, paymentStatusItems, state.paymentStatuses, 'paymentStatuses')}
    `;

    // ── Bind events ──
    // Custom Search Select (same pattern as Driver filter)
    const searchSelectContainer = container.querySelector('#search-custom-select');
    if (searchSelectContainer) {
      const trigger = searchSelectContainer.querySelector('.custom-select__trigger');
      const dropdown = searchSelectContainer.querySelector('.custom-select__dropdown');
      const searchInput = searchSelectContainer.querySelector('.custom-select__search');
      const optionsContainer = searchSelectContainer.querySelector('.custom-select__options');

      // Update search options based on query
      const updateSearchOptions = (query) => {
        const noResults = optionsContainer.querySelector('.custom-select__no-results');
        // Remove old option items (but keep no-results and clear)
        optionsContainer.querySelectorAll('.custom-select__option:not([data-search-clear])').forEach(el => el.remove());

        const normalizedQuery = String(query ?? '').trim().toLowerCase();
        if (!normalizedQuery) {
          if (noResults) noResults.style.display = 'none';
          return;
        }

        const matches = getMatchingSuggestions(searchSuggestions, normalizedQuery, 20);
        if (!matches.length) {
          if (noResults) noResults.style.display = '';
          return;
        }
        if (noResults) noResults.style.display = 'none';

        matches.forEach(value => {
          const opt = document.createElement('div');
          opt.className = 'custom-select__option';
          opt.dataset.searchValue = value;
          opt.textContent = value;
          opt.addEventListener('click', () => {
            setState({ searchText: value });
            searchSelectContainer.classList.remove('open');
            render();
          });
          optionsContainer.appendChild(opt);
        });
      };



      // Clear button (X) inside search input
      const inputClearBtn = searchSelectContainer.querySelector('#search-input-clear');
      const updateInputClearVisibility = () => {
        if (inputClearBtn) inputClearBtn.style.display = searchInput.value ? '' : 'none';
      };
      if (inputClearBtn) {
        inputClearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          searchInput.value = '';
          updateInputClearVisibility();
          updateSearchOptions('');
          searchInput.focus();
        });
      }

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();

        // Close other custom selects
        document.querySelectorAll('.custom-select.open').forEach(el => {
          if (el !== searchSelectContainer) el.classList.remove('open');
        });

        searchSelectContainer.classList.toggle('open');
        if (searchSelectContainer.classList.contains('open')) {
          searchInput.value = state.searchText || '';
          updateSearchOptions(searchInput.value);
          updateInputClearVisibility();
          searchInput.focus();
        }
      });

      dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      searchInput.addEventListener('input', (e) => {
        updateSearchOptions(e.target.value);
        updateInputClearVisibility();
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchSelectContainer.classList.remove('open');
        } else if (e.key === 'Enter') {
          const val = searchInput.value.trim();
          if (val) {
            setState({ searchText: val });
            searchSelectContainer.classList.remove('open');
            render();
          }
        }
      });
    }

    // Month chip selection
    container.querySelectorAll('.month-chip[data-month-value]').forEach(btn => {
      btn.addEventListener('click', () => {
        setState({ selectedMonth: btn.dataset.monthValue });
        render();
      });
    });

    const comparisonToggle = container.querySelector('#comparison-mode-toggle');
    if (comparisonToggle) {
      comparisonToggle.addEventListener('click', () => {
        const isComparisonMode = !state.isComparisonMode;
        setState({ isComparisonMode });
        render();
      });
    }

    // Custom Driver Dropdown logic
    const driverSelectContainer = container.querySelector('#driver-custom-select');
    if (driverSelectContainer) {
      const trigger = driverSelectContainer.querySelector('.custom-select__trigger');
      const dropdown = driverSelectContainer.querySelector('.custom-select__dropdown');
      const searchInput = driverSelectContainer.querySelector('.custom-select__search');
      const optionsContainer = driverSelectContainer.querySelector('.custom-select__options');

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();

        // Close other custom selects
        document.querySelectorAll('.custom-select.open').forEach(el => {
          if (el !== driverSelectContainer) el.classList.remove('open');
        });

        driverSelectContainer.classList.toggle('open');
        if (driverSelectContainer.classList.contains('open')) {
          searchInput.value = '';
          updateDriverInputClearVisibility();
          optionsContainer.querySelectorAll('.custom-select__option').forEach(opt => opt.style.display = '');
          searchInput.focus();
        }
      });

      dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      const driverInputClearBtn = driverSelectContainer.querySelector('#driver-input-clear');
      const updateDriverInputClearVisibility = () => {
        if (driverInputClearBtn) driverInputClearBtn.style.display = searchInput.value ? '' : 'none';
      };
      if (driverInputClearBtn) {
        driverInputClearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          searchInput.value = '';
          updateDriverInputClearVisibility();
          // Reset all option visibility
          optionsContainer.querySelectorAll('.custom-select__option').forEach(opt => opt.style.display = '');
          searchInput.focus();
        });
      }

      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        updateDriverInputClearVisibility();
        const options = optionsContainer.querySelectorAll('.custom-select__option');
        options.forEach(opt => {
          const val = opt.textContent.toLowerCase();
          if (opt.dataset.value === '') {
            opt.style.display = '';
          } else if (val.includes(query)) {
            opt.style.display = '';
          } else {
            opt.style.display = 'none';
          }
        });
      });

      optionsContainer.querySelectorAll('.custom-select__option').forEach(opt => {
        opt.addEventListener('click', () => {
          const val = opt.dataset.value;
          setState({ driver: val });
          driverSelectContainer.classList.remove('open');
          render();
        });
      });
    }

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

  // Close custom dropdowns on click outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select.open').forEach(el => {
      el.classList.remove('open');
    });
  });

  return { render, getState, setState, resetAll, onChange, getActiveFilterCount };
})();
