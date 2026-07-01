/* ============================================================
   Fine Dashboard — App (Main Entry Point)
   Initialization, event wiring, module coordination
   ============================================================ */

const App = (() => {
  let initialized = false;

  async function init() {
    if (initialized) return;
    initialized = true;

    // ── Sidebar date ──
    const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    // Use Bangkok time (UTC+7) so the sidebar date matches the month used by
    // the comparison feature, regardless of the host's local timezone.
    const now = FineData.nowInThailand();
    const day = now.getDate();
    const month = thaiMonths[now.getMonth()];
    const year = now.getFullYear() + 543; // Convert to Buddhist Era
    const dateEl = document.getElementById('sidebar-date');
    if (dateEl) dateEl.textContent = day + ' ' + month + ' ' + year;

    let allData = [];
    let filteredData = [];
    let aggregates = null;

    try {
      renderLoadingState();
      allData = await FineData.load(window.FINE_DASHBOARD_CONFIG || {});
      aggregates = FineData.getAggregates(allData);
    } catch (err) {
      renderLoadError(err);
      console.error('[Fine Dashboard] Data load failed', err);
      return;
    }

    // ── Render all components ──
    Filters.render();
    const initialFilterState = Filters.getState();
    filteredData = FineData.getFiltered(initialFilterState);
    aggregates = FineData.getAggregates(filteredData);
    KPICards.render(aggregates);
    Charts.renderAll(aggregates, filteredData, initialFilterState);
    Tables.render(filteredData);
    setViewMode(initialFilterState);

    // ── Wire filter changes ──
    Filters.onChange((filterState) => {
      if (filterState.isComparisonMode) {
        setViewMode(filterState);
        ComparisonView.render(filterState);
        return;
      }

      setViewMode(filterState);
      const filtered = FineData.getFiltered(filterState);
      const newAggregates = FineData.getAggregates(filtered);

      KPICards.update(newAggregates);
      Charts.updateAll(newAggregates, filtered, filterState);
      Tables.update(filtered);
    });

    // ── Mobile sidebar toggle ──
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const menuToggle = document.getElementById('mobile-menu-toggle');

    if (menuToggle && sidebar && overlay) {
      menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
      });

      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
      });
    }



    console.log('[Fine Dashboard] Initialized successfully');
    console.log(`[Fine Dashboard] ${allData.length} records loaded`);
    console.log(`[Fine Dashboard] Total fine: ${FineData.getAggregates(allData).totalFine.toLocaleString()} ฿`);
  }

  function setViewMode(filterState) {
    const isComparisonMode = !!filterState.isComparisonMode;
    const overviewSections = [
      document.getElementById('section-kpi'),
      document.getElementById('section-charts'),
      document.getElementById('section-tables')
    ];
    const title = document.getElementById('main-title');
    const subtitle = document.getElementById('main-subtitle');

    overviewSections.forEach(section => {
      if (section) section.hidden = isComparisonMode;
    });

    if (title) {
      title.textContent = isComparisonMode
        ? 'เปรียบเทียบข้อมูลรายเดือน'
        : 'รายงานสรุปและติดตามข้อมูลค่าปรับ';
    }

    if (subtitle) {
      subtitle.hidden = !isComparisonMode;
      subtitle.textContent = isComparisonMode
        ? ''
        : '';
    }

    if (!isComparisonMode) ComparisonView.hide();
  }

  function renderLoadingState() {
    // ── Sidebar Filters Skeleton ──
    const sidebarFilters = document.getElementById('sidebar-filters');
    if (sidebarFilters) {
      sidebarFilters.innerHTML = `
        <div class="skeleton-sidebar-filter">
          <div class="skeleton-sidebar-filter__header">
            <div class="skeleton skeleton-text--md" style="width: 100px; height: 16px;"></div>
          </div>
          <div class="skeleton-sidebar-filter__section">
            <div class="skeleton skeleton-text--sm" style="width: 90px; height: 10px;"></div>
            <div class="skeleton" style="width: 100%; height: 32px; border-radius: var(--radius-md);"></div>
          </div>
          <div class="skeleton-sidebar-filter__section">
            <div class="skeleton skeleton-text--sm" style="width: 60px; height: 10px;"></div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
              ${Array.from({ length: 12 }, () => '<div class="skeleton" style="height: 28px; border-radius: var(--radius-full);"></div>').join('')}
            </div>
          </div>
          <div class="skeleton-sidebar-filter__section">
            <div class="skeleton skeleton-text--sm" style="width: 80px; height: 10px;"></div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${Array.from({ length: 6 }, () => '<div class="skeleton" style="width: 60px; height: 24px; border-radius: var(--radius-full);"></div>').join('')}
            </div>
          </div>
          <div class="skeleton-sidebar-filter__section">
            <div class="skeleton skeleton-text--sm" style="width: 100px; height: 10px;"></div>
            <div class="skeleton" style="width: 100%; height: 32px; border-radius: var(--radius-md);"></div>
          </div>
        </div>
      `;
    }

    // ── KPI Cards Skeleton ──
    const kpiGrid = document.getElementById('kpi-grid');
    if (kpiGrid) {
      const skeletonCards = Array.from({ length: 5 }, () => `
        <div class="skeleton-kpi">
          <div>
            <div class="skeleton skeleton-icon"></div>
            <div class="skeleton skeleton-text--sm"></div>
          </div>
          <div>
            <div class="skeleton skeleton-text--lg"></div>
            <div class="skeleton skeleton-text--sm"></div>
          </div>
        </div>
      `).join('');
      kpiGrid.innerHTML = skeletonCards;
    }

    // ── Charts: subtitle texts are already correct in HTML, no need to overwrite ──

    // ── Tables Skeleton ──
    const tablesSection = document.getElementById('tables-section');
    if (tablesSection) {
      const tableRows = Array.from({ length: 8 }, () => {
        const widths = ['8%', '12%', '10%', '16%', '24%', '12%', '18%'];
        return `<div class="skeleton-table-row">
          ${widths.map(w => `<div class="skeleton skeleton-cell" style="width: ${w};"></div>`).join('')}
        </div>`;
      }).join('');
      tablesSection.innerHTML = `
        <div class="table-card">
          <div class="table-card__header">
            <div class="table-card__title-area">
              <span class="skeleton skeleton-text--md" style="width: 160px; height: 18px;"></span>
            </div>
          </div>
          <div class="table-container">
            ${tableRows}
          </div>
        </div>
      `;
    }
  }

  function renderLoadError(err) {
    const message = err && err.message ? err.message : 'โหลดข้อมูลไม่สำเร็จ';
    const hint = 'ตรวจสอบว่า Apps Script ถูก Deploy เป็น Web App แล้ว และตั้งค่า gasEndpoint ใน js/api-config.js เป็น URL ที่ลงท้ายด้วย /exec';
    const safeMessage = escapeHtml(message);
    const safeHint = escapeHtml(hint);

    const kpiGrid = document.getElementById('kpi-grid');
    if (kpiGrid) {
      kpiGrid.innerHTML = `
        <div class="kpi-card" style="grid-column: 1 / -1;">
          <div class="kpi-card__content">
            <div class="kpi-card__value kpi-card__value--small">เชื่อมต่อ Google Sheet ไม่สำเร็จ</div>
            <div class="kpi-card__detail">${safeMessage}</div>
          </div>
        </div>
      `;
    }

    document.querySelectorAll('.chart-card__subtitle').forEach(el => {
      el.textContent = message;
    });

    const tablesSection = document.getElementById('tables-section');
    if (tablesSection) {
      tablesSection.innerHTML = `
        <div class="table-card">
          <div class="table-card__header">
            <div class="table-card__title-area">
              <span class="table-card__title">ยังไม่สามารถโหลดข้อมูลได้</span>
            </div>
          </div>
          <div class="empty-state">
            <div class="empty-state__text">${safeMessage}<br>${safeHint}</div>
          </div>
        </div>
      `;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init };
})();
