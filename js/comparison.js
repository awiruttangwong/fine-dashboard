/* ============================================================
   Fine Dashboard - Monthly Comparison View
   Two-month KPI, daily trend, summary and customer breakdown
   ============================================================ */

const ComparisonView = (() => {
  const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const COLORS = ['#0071E3', '#FF9500', '#34C759', '#FF3B30', '#AF52DE', '#5AC8FA', '#5856D6', '#00C7BE'];

  const ICONS = {
    money: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
    trend: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>`,
    arrowUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>`,
    arrowDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`,
    minus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>`
  };

  const KPI_CONFIGS = [
    { key: 'totalFine', label: 'ยอดปรับรวม', format: 'currency', icon: ICONS.money, tone: 'red', positiveWhenIncrease: false },
    { key: 'count', label: 'จำนวนรายการปรับ', format: 'count', icon: ICONS.file, tone: 'blue', positiveWhenIncrease: false },
    { key: 'totalPaid', label: 'ยอดชำระค่าปรับแล้ว', format: 'currency', icon: ICONS.check, tone: 'green', positiveWhenIncrease: true },
    { key: 'totalRemaining', label: 'ยอดคงเหลือ', format: 'currency', icon: ICONS.clock, tone: 'orange', positiveWhenIncrease: false },
    { key: 'collectionRate', label: 'อัตราการเรียกเก็บเงิน', format: 'percent', icon: ICONS.trend, tone: 'purple', positiveWhenIncrease: true }
  ];
  const SUMMARY_CONFIGS = KPI_CONFIGS.filter(config => config.key !== 'collectionRate');

  let metricMode = 'amount';
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

  function formatMonth(monthValue, short = false) {
    const match = String(monthValue || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return String(monthValue || '');
    const months = short ? THAI_MONTHS_SHORT : THAI_MONTHS;
    return `${months[Number(match[2]) - 1]} ${Number(match[1]) + 543}`;
  }

  function formatDelta(metric, type) {
    const sign = metric.delta > 0 ? '+' : '';
    if (type === 'currency') return `${sign}${formatCurrency(metric.delta)}`;
    // Percentage metrics (e.g. collection rate) use "จุดเปอร์เซ็นต์"
    // (percentage points) for the absolute difference — distinct from the
    // relative "%" change shown separately. The bare word "จุด" was
    // ambiguous and unclear.
    if (type === 'percent') return `${sign}${formatNumber(metric.delta, 1)} จุดเปอร์เซ็นต์`;
    return `${sign}${formatNumber(metric.delta)} รายการ`;
  }

  function formatDeltaPercent(metric) {
    if (metric.percent === null) return metric.delta === 0 ? '0.0%' : 'รายการใหม่';
    const sign = metric.percent > 0 ? '+' : '';
    return `${sign}${formatNumber(metric.percent, 1)}%`;
  }

  function trendState(metric, positiveWhenIncrease) {
    if (metric.delta === 0) return { className: 'neutral', icon: ICONS.minus };
    const isIncrease = metric.delta > 0;
    const isPositive = positiveWhenIncrease ? isIncrease : !isIncrease;
    return {
      className: isPositive ? 'positive' : 'negative',
      icon: isIncrease ? ICONS.arrowUp : ICONS.arrowDown
    };
  }

  function renderKpiCard(config, model) {
    const metric = model.metrics[config.key];
    const trend = trendState(metric, config.positiveWhenIncrease);
    return `
      <article class="comparison-kpi comparison-kpi--${config.tone}">
        <div class="comparison-kpi__header">
          <span class="comparison-kpi__label">${escapeHtml(config.label)}</span>
          <span class="comparison-kpi__icon">${config.icon}</span>
        </div>
        <div class="comparison-kpi__value">${formatValue(metric.current, config.format)}</div>
        <div class="comparison-kpi__footer">
          <span class="comparison-trend comparison-trend--${trend.className}">${trend.icon}${formatDeltaPercent(metric)}</span>
          <span class="comparison-kpi__baseline">จาก ${formatValue(metric.comparison, config.format)}</span>
        </div>
      </article>
    `;
  }

  function renderSummary(model) {
    return SUMMARY_CONFIGS.map(config => {
      const metric = model.metrics[config.key];
      const trend = trendState(metric, config.positiveWhenIncrease);
      return `
        <div class="comparison-summary__row">
          <span>${escapeHtml(config.label)}</span>
          <strong class="comparison-summary__value comparison-summary__value--${trend.className}">
            ${formatDelta(metric, config.format)}
            <small>(${formatDeltaPercent(metric)})</small>
          </strong>
        </div>
      `;
    }).join('');
  }

  function renderCustomerRows(model) {
    if (!model.customerComparison.length) {
      return `<tr><td colspan="4" class="comparison-empty-cell">ไม่พบข้อมูลลูกค้าในเดือนที่เลือก</td></tr>`;
    }

    return model.customerComparison.map(item => {
      const metric = item[metricMode];
      const trend = trendState(metric, false);
      const type = metricMode === 'amount' ? 'currency' : 'count';
      return `
        <tr>
          <td><span class="comparison-customer-name">${escapeHtml(item.customer || '(ไม่ระบุ)')}</span></td>
          <td>${formatValue(metric.current, type)}</td>
          <td>${formatValue(metric.comparison, type)}</td>
          <td class="comparison-delta comparison-delta--${trend.className}">${formatDelta(metric, type)}</td>
        </tr>
      `;
    }).join('');
  }

  function renderCustomerLegend(model) {
    const type = metricMode === 'amount' ? 'currency' : 'count';
    const entries = model.customerComparison.filter(item => item[metricMode].current > 0);
    const total = entries.reduce((sum, item) => sum + item[metricMode].current, 0);

    if (!entries.length) return `<div class="comparison-empty">ไม่มีข้อมูลลูกค้าในเดือนหลัก</div>`;

    return entries.map((item, index) => {
      const value = item[metricMode].current;
      const percent = total > 0 ? (value / total) * 100 : 0;
      return `
        <div class="comparison-customer-legend__item">
          <span class="comparison-customer-legend__dot" style="background:${COLORS[index % COLORS.length]}"></span>
          <span class="comparison-customer-legend__name">${escapeHtml(item.customer || '(ไม่ระบุ)')}</span>
          <strong>${formatValue(value, type)}</strong>
          <span>${formatNumber(percent, 1)}%</span>
        </div>
      `;
    }).join('');
  }

  function render(filters) {
    const container = document.getElementById('comparison-view');
    if (!container) return;

    const model = FineData.getComparisonModel(filters);
    const primaryLabel = formatMonth(model.primaryMonth);
    const comparisonLabel = formatMonth(model.comparisonMonth);
    const primaryCount = model.primaryRows.length;
    const comparisonCount = model.comparisonRows.length;

    container.hidden = false;
    container.innerHTML = `
      <section class="comparison-section">
        <div class="comparison-toolbar">
          <div>
            <div class="comparison-toolbar__period">${escapeHtml(primaryLabel)} <span>เทียบกับ</span> ${escapeHtml(comparisonLabel)}</div>
          </div>
        </div>

        <div class="comparison-kpi-grid">
          ${KPI_CONFIGS.map(config => renderKpiCard(config, model)).join('')}
        </div>

        <div class="comparison-analysis-grid">
          <article class="chart-card comparison-trend-card">
            <div class="chart-card__header">
              <div>
                <div class="chart-card__title">แนวโน้มค่าปรับรายวัน</div>
                <div class="chart-card__subtitle">เปรียบเทียบวันที่ 1-${model.days.length} ของทั้งสองเดือน</div>
              </div>
              <div class="comparison-segmented comparison-segmented--compact" role="group" aria-label="รูปแบบค่าที่ใช้ในกราฟและตาราง">
                <button type="button" data-comparison-metric="amount" class="${metricMode === 'amount' ? 'active' : ''}" aria-pressed="${metricMode === 'amount'}">มูลค่า</button>
                <button type="button" data-comparison-metric="count" class="${metricMode === 'count' ? 'active' : ''}" aria-pressed="${metricMode === 'count'}">จำนวนรายการ</button>
              </div>
            </div>
            <div class="comparison-chart-legend" aria-hidden="true">
              <span><i class="comparison-chart-legend__dot comparison-chart-legend__dot--primary"></i>${escapeHtml(primaryLabel)}</span>
              <span><i class="comparison-chart-legend__dot comparison-chart-legend__dot--comparison"></i>${escapeHtml(comparisonLabel)}</span>
            </div>
            <div class="chart-card__body">
              <div class="comparison-daily-chart">
                <canvas id="chart-comparison-daily" role="img" aria-label="กราฟเปรียบเทียบค่าปรับรายวันระหว่าง ${escapeHtml(primaryLabel)} และ ${escapeHtml(comparisonLabel)}"></canvas>
              </div>
            </div>
          </article>

          <aside class="comparison-summary-card" aria-label="สรุปการเปรียบเทียบ">
            <div class="comparison-summary-card__header">
              <div class="chart-card__title">สรุปการเปรียบเทียบ</div>
              <div class="chart-card__subtitle">${escapeHtml(primaryLabel)} เทียบกับ ${escapeHtml(comparisonLabel)}</div>
            </div>
            <div class="comparison-summary">${renderSummary(model)}</div>
            <div class="comparison-summary__counts">
              <span>${formatNumber(primaryCount)} รายการเดือนหลัก</span>
              <span>${formatNumber(comparisonCount)} รายการเดือนเปรียบเทียบ</span>
            </div>
          </aside>
        </div>

        <div class="comparison-breakdown-grid">
          <article class="chart-card comparison-customer-table-card">
            <div class="chart-card__header">
              <div>
                <div class="chart-card__title">เปรียบเทียบตามลูกค้า</div>
                <div class="chart-card__subtitle">แสดงลูกค้าจากทั้งสองเดือน รวมถึงลูกค้าที่มีข้อมูลเพียงเดือนเดียว</div>
              </div>
            </div>
            <div class="comparison-table-wrap">
              <table class="comparison-table">
                <thead><tr>
                  <th>ลูกค้า</th>
                  <th>${escapeHtml(primaryLabel)}</th>
                  <th>${escapeHtml(comparisonLabel)}</th>
                  <th>ผลต่าง</th>
                </tr></thead>
                <tbody>${renderCustomerRows(model)}</tbody>
              </table>
            </div>
          </article>

          <article class="chart-card comparison-customer-chart-card">
            <div class="chart-card__header">
              <div>
                <div class="chart-card__title">สัดส่วนยอดปรับตามลูกค้า</div>
                <div class="chart-card__subtitle">${escapeHtml(primaryLabel)}</div>
              </div>
            </div>
            <div class="comparison-customer-chart-layout">
              <div class="comparison-doughnut-wrap">
                <canvas id="chart-comparison-customer" role="img" aria-label="กราฟสัดส่วนยอดปรับตามลูกค้าของ ${escapeHtml(primaryLabel)}"></canvas>
                <div class="comparison-doughnut-center">
                  <strong>${metricMode === 'amount' ? formatCurrency(model.primary.totalFine) : formatNumber(model.primary.count)}</strong>
                  <span>${metricMode === 'amount' ? 'ยอดปรับรวม' : 'รายการทั้งหมด'}</span>
                </div>
              </div>
              <div class="comparison-customer-legend">${renderCustomerLegend(model)}</div>
            </div>
          </article>
        </div>
      </section>
    `;

    container.querySelectorAll('[data-comparison-metric]').forEach(button => {
      button.addEventListener('click', () => {
        const nextMode = button.dataset.comparisonMetric;
        if (nextMode === metricMode) return;
        metricMode = nextMode;
        render(Filters.getState());
      });
    });

    renderDailyChart(model);
    renderCustomerChart(model);
  }

  function renderDailyChart(model) {
    if (dailyChart) dailyChart.destroy();
    const canvas = document.getElementById('chart-comparison-daily');
    if (!canvas || typeof Chart === 'undefined') return;

    const isAmount = metricMode === 'amount';
    const valueKey = isAmount ? 'amount' : 'count';

    // Premium bar gradients (top → bottom: vivid → almost-clear) so bars
    // feel dimensional and Apple-like instead of flat solid color blocks.
    // Built fresh per render because the canvas size can change.
    const ctx = canvas.getContext('2d');
    const chartArea = { height: 320 };
    const primaryGrad = ctx.createLinearGradient(0, 0, 0, chartArea.height);
    primaryGrad.addColorStop(0, 'rgba(0, 113, 227, 0.92)');
    primaryGrad.addColorStop(1, 'rgba(0, 113, 227, 0.18)');

    const comparisonGrad = ctx.createLinearGradient(0, 0, 0, chartArea.height);
    comparisonGrad.addColorStop(0, 'rgba(174, 174, 178, 0.78)');
    comparisonGrad.addColorStop(1, 'rgba(174, 174, 178, 0.12)');

    dailyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: model.days.map(day => String(day)),
        datasets: [
          {
            label: formatMonth(model.primaryMonth),
            data: model.primaryDaily.map(item => item[valueKey]),
            comparisonCounts: model.primaryDaily.map(item => item.count),
            comparisonAmounts: model.primaryDaily.map(item => item.amount),
            backgroundColor: primaryGrad,
            hoverBackgroundColor: 'rgba(0, 113, 227, 1)',
            borderColor: 'rgba(0, 113, 227, 0.95)',
            borderWidth: 0,
            borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
            borderSkipped: false,
            maxBarThickness: 22,
            categoryPercentage: 0.7,
            barPercentage: 0.85
          },
          {
            label: formatMonth(model.comparisonMonth),
            data: model.comparisonDaily.map(item => item[valueKey]),
            comparisonCounts: model.comparisonDaily.map(item => item.count),
            comparisonAmounts: model.comparisonDaily.map(item => item.amount),
            backgroundColor: comparisonGrad,
            hoverBackgroundColor: 'rgba(120, 120, 128, 0.95)',
            borderColor: 'rgba(174, 174, 178, 0.9)',
            borderWidth: 0,
            borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
            borderSkipped: false,
            maxBarThickness: 22,
            categoryPercentage: 0.7,
            barPercentage: 0.85
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 6, right: 4 } },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: '#6E6E73', font: { family: "'Prompt'", size: 10 }, maxTicksLimit: 16, maxRotation: 0 }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.045)', drawTicks: false },
            border: { display: false },
            ticks: {
              color: '#86868B',
              font: { family: "'Prompt'", size: 10 },
              padding: 8,
              callback: value => isAmount
                ? `${value >= 1000 ? `${formatNumber(value / 1000, 1)}K` : formatNumber(value)} ฿`
                : formatNumber(value)
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(29,29,31,0.94)',
            padding: 12,
            cornerRadius: 10,
            boxPadding: 4,
            caretPadding: 6,
            titleFont: { family: "'Prompt'", size: 12, weight: '600' },
            bodyFont: { family: "'Prompt'", size: 11 },
            callbacks: {
              title: items => `วันที่ ${model.days[items[0]?.dataIndex || 0]}`,
              label: context => {
                const amount = context.dataset.comparisonAmounts[context.dataIndex];
                const count = context.dataset.comparisonCounts[context.dataIndex];
                if (amount === null || count === null) return ` ${context.dataset.label}: ไม่มีวันนี้ในเดือน`;
                return ` ${context.dataset.label}: ${formatCurrency(amount)} (${formatNumber(count)} รายการ)`;
              }
            }
          }
        }
      }
    });
  }

  function renderCustomerChart(model) {
    if (customerChart) customerChart.destroy();
    const canvas = document.getElementById('chart-comparison-customer');
    if (!canvas || typeof Chart === 'undefined') return;

    const entries = model.customerComparison.filter(item => item[metricMode].current > 0);
    if (!entries.length) {
      canvas.hidden = true;
      return;
    }

    customerChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: entries.map(item => item.customer || '(ไม่ระบุ)'),
        datasets: [{
          data: entries.map(item => item[metricMode].current),
          backgroundColor: entries.map((_, index) => COLORS[index % COLORS.length]),
          borderColor: '#FFFFFF',
          borderWidth: 3,
          hoverOffset: 0
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
              label: context => metricMode === 'amount'
                ? ` ${context.label}: ${formatCurrency(context.raw)}`
                : ` ${context.label}: ${formatNumber(context.raw)} รายการ`
            }
          }
        }
      }
    });
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
