/* ============================================================
   Fine Dashboard - Yearly Comparison View
   Shows all 12 months of the year with KPI, monthly trend,
   monthly table, and customer breakdown
   ============================================================ */

const ComparisonView = (() => {
  const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const COLORS = ['#0071E3', '#FF9500', '#34C759', '#FF3B30', '#AF52DE', '#5AC8FA', '#5856D6', '#00C7BE', '#32ADE6', '#FFCC00'];

  const ICONS = {
    money: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    file: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></svg>`,
    check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
    clock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
    trend: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>`,
    alert: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    pie: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`
  };

  // ชุดการ์ด KPI เดียวกับหน้าแรก (js/kpi.js cardConfigs) เป๊ะ — ก่อนหน้านี้หน้านี้มีแค่
  // 5 การ์ดสรุปกว้างๆ (ยอดปรับรวม/จำนวนรายการ/ชำระแล้ว/คงเหลือ/อัตราเรียกเก็บ) ซึ่งไม่มี
  // "กำลังผ่อน"/"ผ่อนเสร็จแล้ว"/"ปรับไม่ได้" เลย ทำให้ดูภาพรวมทั้งปีไม่ครบเท่าโหมดปกติ
  // เปลี่ยนให้ใช้ yearly.* ที่คำนวณด้วยสูตรเดียวกับ getAggregates ทุกกระเบียดนิ้วแทน
  const KPI_CONFIGS = [
    {
      key: 'totalFine', label: 'ยอดปรับรวม', format: 'currency', icon: ICONS.money, tone: 'red',
      detail: (yearly) => {
        const netCount = yearly.totalRows - yearly.uncollectibleCount;
        return `จาก ${formatNumber(netCount + yearly.debtCount)} รายการ`;
      }
    },
    {
      key: 'totalPaid', label: 'ชำระค่าปรับแล้ว', format: 'currency', icon: ICONS.check, tone: 'green',
      detail: (yearly) => `${formatNumber(yearly.paidCount)} รายการที่ปรับได้`
    },
    {
      key: 'totalRemaining', label: 'ยอดคงเหลือ', format: 'currency', icon: ICONS.alert, tone: 'orange',
      detail: (yearly) => yearly.pendingCount > 0 ? `${formatNumber(yearly.pendingCount)} รายการรอปรับ` : 'ไม่มีรายการที่ต้องติดตาม'
    },
    {
      key: 'installmentActive', label: 'กำลังผ่อน', format: 'currency', icon: ICONS.clock, tone: 'blue',
      getValue: (yearly) => yearly.installment.totalRemainingAmount,
      detail: (yearly) => yearly.installment.activeCases > 0 ? `${formatNumber(yearly.installment.activeCases)} รายการ` : 'ไม่มีรายการที่กำลังผ่อน'
    },
    {
      key: 'installmentDone', label: 'ผ่อนเสร็จแล้ว', format: 'currency', icon: ICONS.check, tone: 'mint',
      getValue: (yearly) => yearly.installment.doneAmount,
      detail: (yearly) => yearly.installment.doneCases > 0 ? `${formatNumber(yearly.installment.doneCases)} รายการ` : 'ยังไม่มีรายการผ่อนเสร็จ'
    },
    {
      key: 'nonCollectible', label: 'ปรับไม่ได้', format: 'currency', icon: ICONS.alert, tone: 'red',
      getValue: (yearly) => yearly.nonCollectible.totalAmount,
      detail: (yearly) => yearly.nonCollectible.totalCases > 0 ? `${formatNumber(yearly.nonCollectible.totalCases)} รายการ` : 'ไม่มีรายการปรับไม่ได้'
    }
  ];

  // ตัวชี้วัดที่กราฟ "แนวโน้มค่าปรับรายเดือน" สลับดูได้ทีละตัว (toggle) — ใช้สูตร/ฟิลด์
  // เดียวกับ monthlyData ใน getYearlyComparisonModel (js/data.js) ที่คำนวณตรงกับ
  // getAggregates ของโหมดปกติอยู่แล้ว ไม่มีการคำนวณใหม่ซ้ำในไฟล์นี้
  const TREND_METRICS = [
    {
      key: 'totalFine', label: 'ยอดปรับรวม', color: '#0071E3',
      getValue: (m) => m.totalFine, getCount: (m) => m.count,
      chartSubtitle: 'ยอดปรับรวมรายเดือน'
    },
    {
      key: 'totalPaid', label: 'ชำระค่าปรับแล้ว', color: '#34C759',
      getValue: (m) => m.totalPaid, getCount: (m) => m.paidCount,
      chartSubtitle: 'ยอดชำระค่าปรับแล้วรายเดือน'
    },
    {
      key: 'totalRemaining', label: 'ยอดคงเหลือ', color: '#FF9500',
      getValue: (m) => m.totalRemaining, getCount: (m) => m.pendingCount,
      chartSubtitle: 'ยอดคงเหลือรายเดือน'
    },
    {
      key: 'installmentActive', label: 'กำลังผ่อน', color: '#5856D6',
      getValue: (m) => m.installment.totalRemainingAmount, getCount: (m) => m.installment.activeCases,
      chartSubtitle: 'ยอดกำลังผ่อนรายเดือน'
    },
    {
      key: 'installmentDone', label: 'ผ่อนเสร็จแล้ว', color: '#00C7BE',
      getValue: (m) => m.installment.doneAmount, getCount: (m) => m.installment.doneCases,
      chartSubtitle: 'ยอดผ่อนเสร็จแล้วรายเดือน'
    },
    {
      key: 'nonCollectible', label: 'ปรับไม่ได้', color: '#FF3B30',
      getValue: (m) => m.uncollectibleAmount + m.nonCollectibleDebt.totalAmount,
      getCount: (m) => m.uncollectibleCount + m.nonCollectibleDebt.totalCases,
      chartSubtitle: 'ยอดปรับไม่ได้รายเดือน'
    }
  ];

  function hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  let currentTrendMetric = TREND_METRICS[0].key;
  let lastComparisonModel = null;
  let dailyChart = null;
  let customerChart = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(value, maximumFractionDigits = 0) {
    return new Intl.NumberFormat('th-TH', { maximumFractionDigits }).format(Number(value) || 0);
  }

  function formatCurrency(value) {
    return `${formatNumber(value)} ฿`;
  }

  function formatValue(value, type) {
    if (type === 'currency') return formatCurrency(value);
    if (type === 'percent') return `${formatNumber(value, 1)}%`;
    return `${formatNumber(value)} รายการ`;
  }

  // แยกตัวเลข/หน่วยเป็นคนละ span (main + suffix) เพื่อให้พิมพ์ตัวเลขใหญ่เด่น ส่วนหน่วย
  // เล็กลงและมีสีตามโทนการ์ด — ดีไซน์เดียวกับ .kpi-card__value-main/suffix ของการ์ด
  // KPI หน้าโหมดปกติ (css/components.css) ไม่ได้เปลี่ยนค่าตัวเลขใดๆ แค่จัดรูปแบบใหม่
  function formatValueMarkup(value, type) {
    if (type === 'currency') {
      return `<span class="comparison-kpi__value-main">${formatNumber(value)}</span><span class="comparison-kpi__value-suffix">฿</span>`;
    }
    if (type === 'percent') {
      return `<span class="comparison-kpi__value-main">${formatNumber(value, 1)}</span><span class="comparison-kpi__value-suffix">%</span>`;
    }
    return `<span class="comparison-kpi__value-main">${formatNumber(value)}</span><span class="comparison-kpi__value-suffix comparison-kpi__value-suffix--word">รายการ</span>`;
  }

  function renderKpiCard(config, yearly) {
    const value = typeof config.getValue === 'function' ? config.getValue(yearly) : yearly[config.key];
    return `
      <article class="comparison-kpi comparison-kpi--${config.tone}">
        <div class="comparison-kpi__header">
          <span class="comparison-kpi__label">${escapeHtml(config.label)}</span>
          <span class="comparison-kpi__icon">${config.icon}</span>
        </div>
        <div class="comparison-kpi__value">${formatValueMarkup(value, config.format)}</div>
        <div class="comparison-kpi__footer">
          <span class="comparison-kpi__baseline">${escapeHtml(config.detail(yearly))}</span>
        </div>
      </article>
    `;
  }

  // ระดับสีของอัตราเรียกเก็บ ใช้โทนเดียวกับ .status-badge ของตารางหลัก (เขียว/ส้ม/แดง/เทา)
  // แทนตัวเลขเปล่าๆ เดิม เพื่อให้เห็นเดือนที่เก็บเงินได้ดี/แย่ได้ทันทีโดยไม่ต้องอ่านตัวเลข
  function collectionRateClass(rate, count) {
    if (!count) return 'rate-pill--muted';
    if (rate >= 50) return 'rate-pill--good';
    if (rate >= 20) return 'rate-pill--warn';
    return 'rate-pill--bad';
  }

  function renderMonthlyTable(model) {
    const { months, monthlyData, yearly } = model;

    const rows = monthlyData.map(m => {
      const isCurrentMonth = m.index === new Date().getMonth() + 1;
      const rowClasses = [isCurrentMonth ? 'row--current-month' : '', !m.count ? 'row--empty' : ''].filter(Boolean).join(' ');
      return `
        <tr class="${rowClasses}">
          <td class="cell-month-name">${escapeHtml(m.label)}</td>
          <td class="cell-right">${formatNumber(m.count)}</td>
          <td class="cell-right cell-amount">${formatCurrency(m.totalFine)}</td>
          <td class="cell-right cell-amount cell-amount--positive">${formatCurrency(m.totalPaid)}</td>
          <td class="cell-right cell-amount">${formatCurrency(m.totalRemaining)}</td>
          <td class="cell-right cell-amount">${m.debtTotal ? formatCurrency(m.debtTotal) : '<span class="cell-muted">—</span>'}</td>
          <td class="cell-right"><span class="rate-pill ${collectionRateClass(m.collectionRate, m.count)}">${formatNumber(m.collectionRate, 1)}%</span></td>
        </tr>
      `;
    }).join('');

    return `
      <div class="table-card__header">
        <div class="table-card__title-area table-card__title-area--blue">
          ${ICONS.file}
          <span class="table-card__title">ภาพรวมรายเดือน ปี ${yearly.year + 543}</span>
        </div>
        <span class="table-card__row-count">${formatNumber(yearly.totalRows)} รายการ</span>
      </div>
      <div class="table-container">
        <table class="data-table comparison-yearly-table comparison-yearly-table--monthly">
          <thead>
            <tr>
              <th style="text-align:left">เดือน</th>
              <th style="text-align:right">จำนวนรายการ</th>
              <th style="text-align:right">ยอดปรับ</th>
              <th style="text-align:right">ชำระค่าปรับแล้ว</th>
              <th style="text-align:right">ยอดคงเหลือ</th>
              <th style="text-align:right">ค่าปรับรถไม่เข้ารับงาน</th>
              <th style="text-align:right">อัตราเรียกเก็บ</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="row-total">
              <td class="cell-month-name" style="font-weight:700">รวมทั้งปี</td>
              <td class="cell-right" style="font-weight:700">${formatNumber(yearly.totalRows)}</td>
              <td class="cell-right cell-amount" style="font-weight:700">${formatCurrency(yearly.totalFine)}</td>
              <td class="cell-right cell-amount cell-amount--positive" style="font-weight:700">${formatCurrency(yearly.totalPaid)}</td>
              <td class="cell-right cell-amount" style="font-weight:700">${formatCurrency(yearly.totalRemaining)}</td>
              <td class="cell-right cell-amount" style="font-weight:700">${formatCurrency(yearly.debtTotal)}</td>
              <td class="cell-right"><span class="rate-pill ${collectionRateClass(yearly.collectionRate, yearly.totalRows)}">${formatNumber(yearly.collectionRate, 1)}%</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  function renderCustomerYearlyTable(model) {
    const { customerBreakdown, yearly } = model;
    const entries = Object.entries(customerBreakdown)
      .sort((a, b) => b[1].fineTotal - a[1].fineTotal);

    if (!entries.length) {
      return `<div class="comparison-empty">ไม่มีข้อมูลลูกค้าในปีนี้</div>`;
    }

    const rows = entries.map(([name, data]) => {
      return `
        <tr>
          <td class="cell-customer-name">${escapeHtml(name)}</td>
          <td class="cell-right">${formatNumber(data.count)}</td>
          <td class="cell-right cell-amount">${formatCurrency(data.fineTotal)}</td>
          <td class="cell-right cell-amount cell-amount--positive">${formatCurrency(data.paidTotal)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="table-card__header">
        <div class="table-card__title-area table-card__title-area--mint">
          ${ICONS.pie}
          <span class="table-card__title">สัดส่วนตามลูกค้า</span>
        </div>
        <span class="table-card__row-count">${entries.length} ลูกค้า</span>
      </div>
      <div class="table-container">
        <table class="data-table comparison-yearly-table">
          <thead>
            <tr>
              <th style="text-align:left;white-space:nowrap">ลูกค้า</th>
              <th style="text-align:right;white-space:nowrap">จำนวนรายการ</th>
              <th style="text-align:right;white-space:nowrap">ยอดปรับรวม</th>
              <th style="text-align:right;white-space:nowrap">ชำระแล้ว</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  function render(filters) {
    const container = document.getElementById('comparison-view');
    if (!container) return;

    const model = FineData.getYearlyComparisonModel(filters);
    const { year, yearly, months } = model;
    lastComparisonModel = model;
    currentTrendMetric = TREND_METRICS[0].key;

    container.hidden = false;
    container.innerHTML = `
      <section class="comparison-section">
        <div class="comparison-toolbar">
          <div class="comparison-toolbar__title-block">
            <div class="comparison-toolbar__period">ภาพรวมทั้งปี พ.ศ. ${year + 543}</div>
            <div class="comparison-toolbar__subtitle">สรุปข้อมูลค่าปรับสะสมทั้ง 12 เดือน เทียบกับปีปัจจุบัน</div>
          </div>
        </div>

        <div class="comparison-kpi-grid">
          ${KPI_CONFIGS.map(config => renderKpiCard(config, yearly)).join('')}
        </div>

        <div class="comparison-yearly-chart-card chart-card">
          <div class="chart-card__header chart-card__header--stack">
            <div>
              <div class="chart-card__title">แนวโน้มค่าปรับรายเดือน</div>
              <div class="chart-card__subtitle" id="yearly-trend-subtitle">${TREND_METRICS[0].chartSubtitle} ประจำปี ${year + 543}</div>
            </div>
            <div class="chart-metric-toggle" role="group" aria-label="เลือกตัวชี้วัดกราฟแนวโน้มรายเดือน">
              ${TREND_METRICS.map((metric, i) => `
                <button type="button"
                  class="chart-metric-toggle__btn${i === 0 ? ' is-active' : ''}"
                  data-metric-key="${metric.key}"
                  style="--metric-color:${metric.color}"
                  aria-pressed="${i === 0 ? 'true' : 'false'}">${escapeHtml(metric.label)}</button>
              `).join('')}
            </div>
          </div>
          <div class="chart-card__body">
            <div class="comparison-daily-chart">
              <canvas id="chart-yearly-trend" role="img" aria-label="กราฟแนวโน้มค่าปรับรายเดือน ปี ${year + 543}"></canvas>
            </div>
          </div>
        </div>

        <div class="comparison-breakdown-grid">
          <div class="chart-card comparison-yearly-table-card">
            ${renderMonthlyTable(model)}
          </div>
          <div class="chart-card comparison-customer-chart-card">
            <div class="chart-card__header">
              <div>
                <div class="chart-card__title">สัดส่วนยอดปรับตามลูกค้า</div>
                <div class="chart-card__subtitle">ปี ${year + 543}</div>
              </div>
            </div>
            <div class="comparison-customer-chart-layout">
              <div class="comparison-doughnut-wrap">
                <canvas id="chart-yearly-customer" role="img" aria-label="กราฟสัดส่วนลูกค้าทั้งปี"></canvas>
                <div class="comparison-doughnut-center">
                  <strong>${formatCurrency(yearly.totalFine)}</strong>
                  <span>ยอดรวมทั้งปี</span>
                </div>
              </div>
              <div class="comparison-customer-legend" id="yearly-customer-legend"></div>
            </div>
          </div>
        </div>

        <div class="chart-card">
          ${renderCustomerYearlyTable(model)}
        </div>
      </section>
    `;

    renderYearlyTrendChart(model, currentTrendMetric);
    renderCustomerChart(model);

    const toggleEl = container.querySelector('.chart-metric-toggle');
    if (toggleEl) {
      toggleEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.chart-metric-toggle__btn');
        if (!btn || !lastComparisonModel) return;
        const metricKey = btn.dataset.metricKey;
        if (metricKey === currentTrendMetric) return;
        currentTrendMetric = metricKey;

        toggleEl.querySelectorAll('.chart-metric-toggle__btn').forEach(b => {
          const isActive = b === btn;
          b.classList.toggle('is-active', isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        const metricConfig = TREND_METRICS.find(m => m.key === metricKey);
        const subtitleEl = document.getElementById('yearly-trend-subtitle');
        if (subtitleEl && metricConfig) {
          subtitleEl.textContent = `${metricConfig.chartSubtitle} ประจำปี ${lastComparisonModel.year + 543}`;
        }

        renderYearlyTrendChart(lastComparisonModel, currentTrendMetric);
      });
    }
  }

  function renderYearlyTrendChart(model, metricKey) {
    if (dailyChart) dailyChart.destroy();
    const canvas = document.getElementById('chart-yearly-trend');
    if (!canvas || typeof Chart === 'undefined') return;

    const metricConfig = TREND_METRICS.find(m => m.key === metricKey) || TREND_METRICS[0];
    const { monthlyData } = model;
    // ใช้ตัวย่อมาตรฐาน ม.ค.-ธ.ค. (THAI_MONTHS_SHORT ด้านบน) แทน m.shortLabel ที่มาจาก
    // js/data.js ซึ่งตัดชื่อเต็มมาแค่ 3 ตัวอักษร+จุด (เช่น "มกร.", "กรก.", "พฤศ.") ไม่ใช่
    // ตัวย่อทางการที่คนไทยคุ้นเคย
    const labels = monthlyData.map(m => THAI_MONTHS_SHORT[m.index - 1]);
    const amounts = monthlyData.map(m => metricConfig.getValue(m));
    const counts = monthlyData.map(m => metricConfig.getCount(m));

    const ctx = canvas.getContext('2d');

    // ดีไซน์ทางการ: ทุกแท่งใช้สีทึบเข้มเท่ากันทุกเดือน (ไม่แยกเดือนปัจจุบันให้เข้มกว่า
    // เดือนอื่น) ให้ผู้ใช้เปรียบเทียบขนาด/มูลค่าโดยไม่ถูกสีชักจูงความสนใจ
    const SOLID = metricConfig.color;
    const HOVER = hexToRgba(metricConfig.color, 0.82);
    const valueLabelPlugin = buildYearlyValueLabelPlugin(amounts);
    const dpr = Math.max(window.devicePixelRatio || 1, 2);

    dailyChart = new Chart(ctx, {
      type: 'bar',
      plugins: [valueLabelPlugin],
      data: {
        labels,
        datasets: [
          {
            label: `${metricConfig.label} (฿)`,
            data: amounts,
            backgroundColor: SOLID,
            hoverBackgroundColor: HOVER,
            borderRadius: 4,
            borderSkipped: false,
            maxBarThickness: 38,
            categoryPercentage: 0.62,
            barPercentage: 0.78
          }
        ]
      },
      options: {
        devicePixelRatio: dpr,
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 34, right: 8, bottom: 14 } },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: '#6E6E73',
              font: { family: "'Prompt'", size: 11 },
              maxRotation: 0,
              padding: 8
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.06)', drawTicks: false },
            border: { display: false },
            ticks: {
              color: '#86868B',
              font: { family: "'Prompt'", size: 11 },
              padding: 8,
              maxTicksLimit: 6,
              callback: value => value >= 1000 ? `${(value / 1000).toFixed(1).replace('.0', '')}K ฿` : `${value} ฿`
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(29,29,31,0.94)',
            padding: 12,
            cornerRadius: 8,
            boxPadding: 4,
            caretPadding: 6,
            displayColors: false,
            titleFont: { family: "'Prompt'", size: 12, weight: '600' },
            bodyFont: { family: "'Prompt'", size: 11 },
            callbacks: {
              title: items => {
                const idx = items[0]?.dataIndex ?? 0;
                return model.months[idx]?.label || '';
              },
              label: context => {
                const idx = context.dataIndex;
                const amount = amounts[idx];
                const count = counts[idx];
                return `${metricConfig.label}: ${formatCurrency(amount)} (${count} รายการ)`;
              }
            }
          }
        }
      }
    });
  }

  // ป้ายราคาลอยเหนือแท่งกราฟ — ต้องส่งเป็น chart-level plugin ตอนสร้าง Chart instance
  // (top-level `plugins:` array ตอน new Chart()) เท่านั้นถึงจะทำงานจริง แต่เดิมโค้ดผูก
  // ปลั๊กอินหลังสร้าง chart เสร็จแล้วด้วย chart.config.plugins = [...] ซึ่งไม่ใช่ API ที่
  // Chart.js v4 รองรับ — afterDraw เลยไม่เคยถูกเรียกจริง ป้ายตัวเลขจึงไม่เคยแสดงผลเลย
  function buildYearlyValueLabelPlugin(amounts) {
    return {
      id: 'yearlyValueLabel',
      afterDraw(ch) {
        const meta = ch.getDatasetMeta(0);
        if (!meta?.data?.length) return;

        const { ctx, chartArea } = ch;
        const bars = meta.data;
        const topPadding = Number(ch.options?.layout?.padding?.top) || 0;
        const anchorTop = Math.max(chartArea.top - topPadding, 0);
        let previousRight = chartArea.left - 999;

        ctx.save();
        ctx.font = "11px 'Prompt', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        bars.forEach((bar, index) => {
          const rawValue = Number(amounts[index]) || 0;
          if (rawValue <= 0) return;

          const props = bar.getProps(['x', 'y', 'base'], true);
          const label = formatNumber(rawValue) + ' ฿';
          const textWidth = ctx.measureText(label).width;
          const pillWidth = textWidth + 12;
          const pillHeight = 18;
          const pillX = props.x - pillWidth / 2;
          const pillY = Math.max(anchorTop + 4, props.y - pillHeight - 10);

          if (pillX < chartArea.left || pillX + pillWidth > chartArea.right) return;
          if (pillX < previousRight + 4) return;

          ctx.beginPath();
          const r = pillHeight / 2;
          ctx.moveTo(pillX + r, pillY);
          ctx.lineTo(pillX + pillWidth - r, pillY);
          ctx.quadraticCurveTo(pillX + pillWidth, pillY, pillX + pillWidth, pillY + r);
          ctx.lineTo(pillX + pillWidth, pillY + pillHeight - r);
          ctx.quadraticCurveTo(pillX + pillWidth, pillY + pillHeight, pillX + pillWidth - r, pillY + pillHeight);
          ctx.lineTo(pillX + r, pillY + pillHeight);
          ctx.quadraticCurveTo(pillX, pillY + pillHeight, pillX, pillY + pillHeight - r);
          ctx.lineTo(pillX, pillY + r);
          ctx.quadraticCurveTo(pillX, pillY, pillX + r, pillY);
          ctx.closePath();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
          ctx.shadowColor = 'rgba(15, 23, 42, 0.10)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 2;
          ctx.fill();
          ctx.shadowColor = 'transparent';

          ctx.fillStyle = '#5C5C61';
          ctx.fillText(label, props.x, pillY + pillHeight / 2 + 0.5);
          previousRight = pillX + pillWidth;
        });

        ctx.restore();
      }
    };
  }

  function renderCustomerChart(model) {
    if (customerChart) customerChart.destroy();
    const canvas = document.getElementById('chart-yearly-customer');
    if (!canvas || typeof Chart === 'undefined') return;

    const { customerBreakdown, yearly } = model;
    const entries = Object.entries(customerBreakdown)
      .filter(([, data]) => data.fineTotal > 0)
      .sort((a, b) => b[1].fineTotal - a[1].fineTotal);

    if (!entries.length) {
      canvas.hidden = true;
      return;
    }

    customerChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: entries.map(([name]) => name),
        datasets: [{
          data: entries.map(([, data]) => data.fineTotal),
          backgroundColor: entries.map((_, i) => COLORS[i % COLORS.length]),
          borderColor: '#FFFFFF',
          borderWidth: 3,
          hoverOffset: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        animation: { duration: 450 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(29,29,31,0.94)',
            padding: 12,
            titleFont: { family: "'Prompt'", size: 12, weight: '600' },
            bodyFont: { family: "'Prompt'", size: 11 },
            callbacks: {
              label: context => {
                const pct = yearly.totalFine > 0 ? ((context.raw / yearly.totalFine) * 100).toFixed(1) : '0.0';
                return ` ${context.label}: ${formatCurrency(context.raw)} (${pct}%)`;
              }
            }
          }
        }
      }
    });

    const legendEl = document.getElementById('yearly-customer-legend');
    if (legendEl) {
      const total = entries.reduce((sum, [, data]) => sum + data.fineTotal, 0);
      legendEl.innerHTML = entries.map(([name, data], i) => {
        const pct = total > 0 ? ((data.fineTotal / total) * 100).toFixed(1) : '0.0';
        return `
          <div class="comparison-customer-legend__item">
            <span class="comparison-customer-legend__dot" style="background:${COLORS[i % COLORS.length]}"></span>
            <span class="comparison-customer-legend__name">${escapeHtml(name)}</span>
            <strong>${formatCurrency(data.fineTotal)}</strong>
            <span>${pct}%</span>
          </div>
        `;
      }).join('');
    }
  }

  function hide() {
    const container = document.getElementById('comparison-view');
    if (container) {
      container.hidden = true;
      container.innerHTML = '';
    }
    if (dailyChart) dailyChart.destroy();
    if (customerChart) customerChart.destroy();
    dailyChart = null;
    customerChart = null;
  }

  return { render, hide };
})();
