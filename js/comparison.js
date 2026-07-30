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
    trend: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>`
  };

  const KPI_CONFIGS = [
    { key: 'totalFine', label: 'ยอดปรับรวมทั้งปี', format: 'currency', icon: ICONS.money, tone: 'red' },
    { key: 'totalRows', label: 'จำนวนรายการปรับ', format: 'count', icon: ICONS.file, tone: 'blue' },
    { key: 'totalPaid', label: 'ยอดชำระแล้ว', format: 'currency', icon: ICONS.check, tone: 'green' },
    { key: 'totalRemaining', label: 'ยอดคงเหลือ', format: 'currency', icon: ICONS.clock, tone: 'orange' },
    { key: 'collectionRate', label: 'อัตราการเรียกเก็บ', format: 'percent', icon: ICONS.trend, tone: 'purple' }
  ];

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

  function renderKpiCard(config, yearly) {
    const value = yearly[config.key];
    return `
      <article class="comparison-kpi comparison-kpi--${config.tone}">
        <div class="comparison-kpi__header">
          <span class="comparison-kpi__label">${escapeHtml(config.label)}</span>
          <span class="comparison-kpi__icon">${config.icon}</span>
        </div>
        <div class="comparison-kpi__value">${formatValue(value, config.format)}</div>
        <div class="comparison-kpi__footer">
          <span class="comparison-kpi__baseline">ปี ${yearly.year + 543} ข้อมูล ${formatNumber(yearly.totalRows)} รายการ</span>
        </div>
      </article>
    `;
  }

  function renderMonthlyTable(model) {
    const { months, monthlyData, yearly } = model;

    const rows = monthlyData.map(m => {
      const isCurrentMonth = m.index === new Date().getMonth() + 1;
      const rowClass = isCurrentMonth ? 'row--current-month' : '';
      return `
        <tr class="${rowClass}">
          <td class="cell-month-name">${escapeHtml(m.label)}</td>
          <td class="cell-right">${formatNumber(m.count)}</td>
          <td class="cell-right cell-amount">${formatCurrency(m.totalFine)}</td>
          <td class="cell-right cell-amount cell-amount--positive">${formatCurrency(m.totalPaid)}</td>
          <td class="cell-right cell-amount">${formatCurrency(m.totalRemaining)}</td>
          <td class="cell-right">${formatNumber(m.collectionRate, 1)}%</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="table-card__header">
        <div class="table-card__title-area">
          ${ICONS.file}
          <span class="table-card__title">ภาพรวมรายเดือน ปี ${yearly.year + 543}</span>
        </div>
      </div>
      <div class="table-container">
        <table class="data-table comparison-yearly-table">
          <thead>
            <tr>
              <th style="text-align:left;white-space:nowrap">เดือน</th>
              <th style="text-align:right;white-space:nowrap">จำนวนรายการ</th>
              <th style="text-align:right;white-space:nowrap">ยอดปรับ</th>
              <th style="text-align:right;white-space:nowrap">ชำระแล้ว</th>
              <th style="text-align:right;white-space:nowrap">คงเหลือ</th>
              <th style="text-align:right;white-space:nowrap">อัตราเรียกเก็บ</th>
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
              <td class="cell-right" style="font-weight:700">${formatNumber(yearly.collectionRate, 1)}%</td>
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
      const pct = yearly.totalFine > 0 ? ((data.fineTotal / yearly.totalFine) * 100).toFixed(1) : '0.0';
      return `
        <tr>
          <td class="cell-customer-name">${escapeHtml(name)}</td>
          <td class="cell-right">${formatNumber(data.count)}</td>
          <td class="cell-right cell-amount">${formatCurrency(data.fineTotal)}</td>
          <td class="cell-right cell-amount cell-amount--positive">${formatCurrency(data.paidTotal)}</td>
          <td class="cell-right">${pct}%</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="table-card__header">
        <div class="table-card__title-area">
          ${ICONS.money}
          <span class="table-card__title">สัดส่วนตามลูกค้า</span>
        </div>
      </div>
      <div class="table-container">
        <table class="data-table comparison-yearly-table">
          <thead>
            <tr>
              <th style="text-align:left;white-space:nowrap">ลูกค้า</th>
              <th style="text-align:right;white-space:nowrap">จำนวนรายการ</th>
              <th style="text-align:right;white-space:nowrap">ยอดปรับรวม</th>
              <th style="text-align:right;white-space:nowrap">ชำระแล้ว</th>
              <th style="text-align:right;white-space:nowrap">สัดส่วน</th>
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

    container.hidden = false;
    container.innerHTML = `
      <section class="comparison-section">
        <div class="comparison-toolbar">
          <div>
            <div class="comparison-toolbar__period">ภาพรวมทั้งปี พ.ศ. ${year + 543}</div>
          </div>
        </div>

        <div class="comparison-kpi-grid">
          ${KPI_CONFIGS.map(config => renderKpiCard(config, yearly)).join('')}
        </div>

        <div class="comparison-yearly-chart-card chart-card">
          <div class="chart-card__header">
            <div>
              <div class="chart-card__title">แนวโน้มค่าปรับรายเดือน</div>
              <div class="chart-card__subtitle">ยอดค่าปรับสะสมรายเดือน ประจำปี ${year + 543}</div>
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

    renderYearlyTrendChart(model);
    renderCustomerChart(model);
  }

  function renderYearlyTrendChart(model) {
    if (dailyChart) dailyChart.destroy();
    const canvas = document.getElementById('chart-yearly-trend');
    if (!canvas || typeof Chart === 'undefined') return;

    const { monthlyData } = model;
    const labels = monthlyData.map(m => m.shortLabel);
    const amounts = monthlyData.map(m => m.totalFine);
    const counts = monthlyData.map(m => m.count);

    const ctx = canvas.getContext('2d');
    const chartArea = { height: 320 };
    const barGrad = ctx.createLinearGradient(0, 0, 0, chartArea.height);
    barGrad.addColorStop(0, 'rgba(0, 113, 227, 0.92)');
    barGrad.addColorStop(1, 'rgba(0, 113, 227, 0.18)');

    const activeMonthIndex = new Date().getMonth();

    dailyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'ยอดปรับ (฿)',
            data: amounts,
            backgroundColor: amounts.map((_, i) => {
              if (i === activeMonthIndex) return 'rgba(0, 113, 227, 1)';
              return barGrad;
            }),
            hoverBackgroundColor: 'rgba(0, 113, 227, 1)',
            borderColor: amounts.map((_, i) => i === activeMonthIndex ? 'rgba(0, 113, 227, 1)' : 'rgba(0, 113, 227, 0)'),
            borderWidth: amounts.map((_, i) => i === activeMonthIndex ? 2 : 0),
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 48,
            categoryPercentage: 0.72,
            barPercentage: 0.82
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 34, right: 4, bottom: 14 } },
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
            grid: { color: 'rgba(0,0,0,0.045)', drawTicks: false },
            border: { display: false },
            ticks: {
              color: '#86868B',
              font: { family: "'Prompt'", size: 11 },
              padding: 8,
              callback: value => value >= 1000 ? `${(value / 1000).toFixed(1).replace('.0', '')}K ฿` : `${value} ฿`
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
              title: items => {
                const idx = items[0]?.dataIndex ?? 0;
                return model.months[idx]?.label || '';
              },
              label: context => {
                const idx = context.dataIndex;
                const amount = amounts[idx];
                const count = counts[idx];
                return `  ยอดปรับ: ${formatCurrency(amount)} (${count} รายการ)`;
              }
            }
          }
        }
      }
    });

    drawYearlyValueLabels(dailyChart, amounts, counts);
  }

  function drawYearlyValueLabels(chart, amounts, counts) {
    const valueLabelPlugin = {
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

    chart.config.plugins = [valueLabelPlugin];
    chart.update('none');
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
