/* ============================================================
   Fine Dashboard — Charts
   Chart.js 4 — 6 charts with Apple-inspired styling
   Redesigned: professional bar charts, full route display
   ============================================================ */

const Charts = (() => {
  const chartInstances = {};

  // Apple-inspired color palette
  const COLORS = {
    blue:    '#0071E3',
    green:   '#34C759',
    orange:  '#FF9500',
    red:     '#FF3B30',
    purple:  '#AF52DE',
    teal:    '#5AC8FA',
    pink:    '#FF2D55',
    indigo:  '#5856D6',
    mint:    '#00C7BE',
    cyan:    '#32ADE6',
    yellow:  '#FFCC00',
    gray:    '#8E8E93'
  };

  const PALETTE = [COLORS.blue, COLORS.green, COLORS.orange, COLORS.purple, COLORS.teal, COLORS.pink, COLORS.indigo, COLORS.mint, COLORS.cyan, COLORS.red];

  // Shared Chart.js defaults
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(29, 29, 31, 0.92)',
        titleFont: { family: "'Prompt', sans-serif", size: 12, weight: '600' },
        bodyFont: { family: "'Prompt', sans-serif", size: 11 },
        padding: { top: 10, right: 14, bottom: 10, left: 14 },
        cornerRadius: 10,
        displayColors: true,
        boxPadding: 4,
        caretPadding: 8
      }
    }
  };

  function destroyChart(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  }

  function formatCurrency(val) {
    return new Intl.NumberFormat('th-TH').format(val) + ' ฿';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── 1. Daily Fine Trend (Bar + Premium Smooth Line) ──
  function renderDailyTrend(aggregates) {
    destroyChart('dailyTrend');
    const canvas = document.getElementById('chart-daily-trend');
    if (!canvas) return;

    const dates   = Object.keys(aggregates.dailyTrend).sort();
    const amounts = dates.map(d => aggregates.dailyTrend[d].fineTotal);
    const counts  = dates.map(d => aggregates.dailyTrend[d].count);
    const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const labels  = dates.map(d => {
      const parts = d.split('-');
      const dayVal = parseInt(parts[2]);
      const monthIdx = parseInt(parts[1]) - 1;
      const monthLabel = THAI_MONTHS_SHORT[monthIdx] || '';
      return `${dayVal} ${monthLabel}`;
    });

    // ── Subtitle (update dynamic date range text) ──
    const subtitleEl = canvas.closest('.chart-card').querySelector('.chart-card__subtitle');
    if (subtitleEl) {
      if (dates.length > 0) {
        const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        const firstParts = dates[0].split('-');
        const lastParts = dates[dates.length - 1].split('-');
        const yearBE = parseInt(firstParts[0]) + 543;
        const monthIdx = parseInt(firstParts[1]) - 1;
        const monthLabel = THAI_MONTHS_FULL[monthIdx] || '';
        const startDay = parseInt(firstParts[2]);
        const endDay = parseInt(lastParts[2]);
        subtitleEl.textContent = `ยอดค่าปรับและจำนวนรายการ ตั้งแต่ ${startDay}-${endDay} ${monthLabel} ${yearBE}`;
      } else {
        subtitleEl.textContent = `ไม่มีข้อมูลสำหรับเดือนนี้`;
      }
    }

    // ── Legend (rebuild each render so it stays in sync with filter) ──
    const oldLegend = document.getElementById('chart-daily-trend-legend');
    if (oldLegend) oldLegend.remove();
    const legendEl = document.createElement('div');
    legendEl.id = 'chart-daily-trend-legend';
    legendEl.style.cssText =
      'display:flex;align-items:center;gap:24px;padding:2px 0 14px 2px;' +
      'font-size:0.72rem;font-family:Prompt,sans-serif;color:#6E6E73;flex-wrap:wrap;';
    legendEl.innerHTML = `
      <span style="display:flex;align-items:center;gap:8px;">
        <span style="display:inline-block;width:14px;height:14px;border-radius:4px;
              background:linear-gradient(180deg,rgba(0,113,227,0.70) 0%,rgba(0,113,227,0.10) 100%);
              border-top:2px solid rgba(0,113,227,0.9);"></span>
        ยอดค่าปรับ (฿)
      </span>
      <span style="display:flex;align-items:center;gap:0px;">
        <span style="display:inline-block;width:24px;height:2.5px;border-radius:2px;background:#E8820C;margin-right:4px;"></span>
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;
              background:#fff;border:2.5px solid #E8820C;margin-right:8px;margin-left:-3px;"></span>
        จำนวนรายการ
      </span>
    `;
    canvas.parentNode.insertBefore(legendEl, canvas);

    const ctx = canvas.getContext('2d');

    // Gradient for bars (top → bottom: vivid → almost-clear)
    const barGrad = ctx.createLinearGradient(0, 0, 0, 300);
    barGrad.addColorStop(0,   'rgba(0, 113, 227, 0.72)');
    barGrad.addColorStop(0.6, 'rgba(0, 113, 227, 0.30)');
    barGrad.addColorStop(1,   'rgba(0, 113, 227, 0.05)');

    // Subtle warm fill under the orange line
    const lineGrad = ctx.createLinearGradient(0, 0, 0, 300);
    lineGrad.addColorStop(0,   'rgba(232, 130, 12, 0.14)');
    lineGrad.addColorStop(1,   'rgba(232, 130, 12, 0.0)');

    chartInstances['dailyTrend'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'ยอดปรับ (฿)',
            data: amounts,
            backgroundColor: barGrad,
            borderColor: 'rgba(0, 113, 227, 0.85)',
            borderWidth: { top: 2, right: 0, bottom: 0, left: 0 },
            borderRadius: 6,
            borderSkipped: false,
            yAxisID: 'y',
            order: 2
          },
          {
            type: 'line',
            label: 'จำนวนรายการ',
            data: counts,
            borderColor: '#E8820C',
            backgroundColor: lineGrad,
            borderWidth: 3,
            fill: true,
            tension: 0.42,
            pointRadius: 5,
            pointHoverRadius: 9,
            pointBackgroundColor: '#FFFFFF',
            pointBorderColor: '#E8820C',
            pointBorderWidth: 2.5,
            pointHoverBackgroundColor: '#E8820C',
            pointHoverBorderColor: '#FFFFFF',
            pointHoverBorderWidth: 3,
            yAxisID: 'y1',
            order: 1
          }
        ]
      },
      options: {
        ...baseOptions,
        layout: { padding: { left: 0, right: 0, top: 4, bottom: 0 } },
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: "'Prompt'", size: 11 },
              color: '#AEAEB2',
              maxRotation: 0,
              maxTicksLimit: 11
            },
            border: { display: false }
          },
          y: {
            position: 'left',
            grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
            ticks: {
              font: { family: "'Prompt'", size: 11 },
              color: '#86868B',
              callback: (v) => v >= 1000 ? (v / 1000).toFixed(0) + 'K ฿' : v + ' ฿'
            },
            border: { display: false }
          },
          y1: {
            position: 'right',
            grid: { display: false },
            min: 0,
            ticks: {
              font: { family: "'Prompt'", size: 11 },
              color: '#E8820C',
              stepSize: 1,
              callback: (v) => Number.isInteger(v) ? v : ''
            },
            border: { display: false }
          }
        },
        plugins: {
          ...baseOptions.plugins,
          tooltip: {
            ...baseOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => {
                if (ctx.datasetIndex === 0) return `  ยอดปรับ: ${formatCurrency(ctx.raw)}`;
                return `  จำนวน: ${ctx.raw} รายการ`;
              }
            }
          }
        }
      }
    });
  }



  // ── 2. Fine by Customer (Doughnut) ──
  function renderCustomerChart(aggregates) {
    destroyChart('customerChart');
    const canvas = document.getElementById('chart-customer');
    if (!canvas) return;

    const entries = Object.entries(aggregates.customerBreakdown).sort((a, b) => b[1].fineTotal - a[1].fineTotal);
    const labels = entries.map(([name]) => name);
    const data = entries.map(([, v]) => v.fineTotal);
    const colors = [COLORS.blue, COLORS.orange, COLORS.purple, COLORS.teal];

    chartInstances['customerChart'] = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        ...baseOptions,
        cutout: '68%',
        plugins: {
          ...baseOptions.plugins,
          tooltip: {
            ...baseOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)} (${((ctx.raw / data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`
            }
          }
        }
      }
    });

    const legendEl = document.getElementById('legend-customer');
    if (legendEl) {
      legendEl.innerHTML = entries.map(([name, v], i) => `
        <div class="chart-legend__item">
          <span class="chart-legend__color" style="background:${colors[i]}"></span>
          ${escapeHtml(name)}
          <span class="chart-legend__value">${formatCurrency(v.fineTotal)}</span>
        </div>
      `).join('');
    }
  }

  // ── 3. Top 10 Drivers (Redesigned — Professional list style) ──
  function renderTopDrivers(aggregates) {
    const container = document.getElementById('chart-top-drivers-list');
    if (!container) return;

    const sorted = Object.entries(aggregates.driverCounts)
      .filter(([name]) => name !== '(ไม่ระบุ)')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const maxCount = sorted.length > 0 ? sorted[0][1] : 1;

    container.innerHTML = sorted.map(([name, count], i) => {
      const pct = (count / maxCount) * 100;
      const rank = i + 1;
      const color = i < 3 ? COLORS.blue : (i < 6 ? COLORS.teal : '#C7C7CC');
      const rankBg = i === 0 ? 'background:' + COLORS.blue + ';color:#fff' :
                     i === 1 ? 'background:' + COLORS.indigo + ';color:#fff' :
                     i === 2 ? 'background:' + COLORS.teal + ';color:#fff' :
                     'background:#F0F0F2;color:#6E6E73';
      return `
        <div class="driver-rank-item">
          <div class="driver-rank-item__rank" style="${rankBg}">${rank}</div>
          <div class="driver-rank-item__info">
            <div class="driver-rank-item__name">${escapeHtml(name)}</div>
            <div class="driver-rank-item__bar-track">
              <div class="driver-rank-item__bar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
          </div>
          <div class="driver-rank-item__count">${count} <span class="driver-rank-item__count-label">ครั้ง</span></div>
        </div>
      `;
    }).join('');
  }

  // ── 4. Route Group Distribution (Doughnut) ──
  function renderRouteGroups(aggregates) {
    destroyChart('routeGroups');
    const canvas = document.getElementById('chart-route-groups');
    if (!canvas) return;

    const sorted = Object.entries(aggregates.routeGroupCounts).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(([name]) => name);
    const data = sorted.map(([, count]) => count);

    chartInstances['routeGroups'] = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: PALETTE.slice(0, labels.length),
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        ...baseOptions,
        cutout: '62%',
        plugins: {
          ...baseOptions.plugins,
          tooltip: {
            ...baseOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw} รายการ (${((ctx.raw / data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`
            }
          }
        }
      }
    });

    const legendEl = document.getElementById('legend-route-groups');
    if (legendEl) {
      legendEl.innerHTML = sorted.map(([name, count], i) => `
        <div class="chart-legend__item">
          <span class="chart-legend__color" style="background:${PALETTE[i]}"></span>
          ${escapeHtml(name)}
          <span class="chart-legend__value">${count}</span>
        </div>
      `).join('');
    }
  }

  // ── 5. Route Status (Redesigned — Professional styled bars) ──
  function renderRouteStatus(aggregates) {
    const container = document.getElementById('chart-route-status-list');
    if (!container) return;

    const entries = Object.entries(aggregates.routeStatusCounts).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, c]) => sum + c, 0);
    const statusColors = {
      'RO': COLORS.blue, 'RS1': COLORS.green, 'RS2': COLORS.orange,
      'SOCN': COLORS.purple, 'SOCE': COLORS.teal, 'needs_review': COLORS.gray
    };

    container.innerHTML = entries.map(([status, count]) => {
      const pct = ((count / total) * 100).toFixed(1);
      const color = statusColors[status] || COLORS.gray;
      return `
        <div class="status-bar-item">
          <div class="status-bar-item__header">
            <div class="status-bar-item__label">
              <span class="status-bar-item__dot" style="background:${color}"></span>
              <span class="status-bar-item__name">${escapeHtml(status)}</span>
            </div>
            <div class="status-bar-item__values">
              <span class="status-bar-item__count">${count}</span>
              <span class="status-bar-item__pct">${pct}%</span>
            </div>
          </div>
          <div class="status-bar-item__track">
            <div class="status-bar-item__fill" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── 6. Payment Status (Doughnut) ──
  function renderPaymentStatus(aggregates) {
    destroyChart('paymentStatus');
    const canvas = document.getElementById('chart-payment-status');
    if (!canvas) return;

    const statusLabels = {
      'open': 'ค้างชำระ', 'paid': 'ชำระแล้ว', 'partial': 'ชำระบางส่วน',
      'overpaid': 'ชำระเกิน', 'data_error': 'ข้อมูลผิดพลาด'
    };
    const statusColors = {
      'open': COLORS.blue, 'paid': COLORS.green, 'partial': COLORS.orange,
      'overpaid': COLORS.purple, 'data_error': COLORS.red
    };

    const entries = Object.entries(aggregates.paymentStatusCounts).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(([k]) => statusLabels[k] || k);
    const data = entries.map(([, v]) => v);
    const colors = entries.map(([k]) => statusColors[k] || COLORS.gray);

    chartInstances['paymentStatus'] = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        ...baseOptions,
        cutout: '68%',
        plugins: {
          ...baseOptions.plugins,
          tooltip: {
            ...baseOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw} รายการ`
            }
          }
        }
      }
    });

    const legendEl = document.getElementById('legend-payment-status');
    if (legendEl) {
      legendEl.innerHTML = entries.map(([k, count], i) => `
        <div class="chart-legend__item">
          <span class="chart-legend__color" style="background:${colors[i]}"></span>
          ${escapeHtml(statusLabels[k] || k)}
          <span class="chart-legend__value">${count}</span>
        </div>
      `).join('');
    }
  }

  // ── 7. Full Route Table (NEW — shows complete route strings) ──
  function renderFullRoutes(filteredData) {
    const container = document.getElementById('route-detail-list');
    if (!container) return;

    // Group by route_raw and count
    const routeCounts = {};
    filteredData.forEach(row => {
      if (!routeCounts[row.route_raw]) {
        routeCounts[row.route_raw] = {
          route: row.route_raw,
          group: row.route_group,
          vehicle: row.vehicle_type || '-',
          time: row.route_time || '-',
          status: row.route_status,
          count: 0,
          totalFine: 0
        };
      }
      routeCounts[row.route_raw].count++;
      routeCounts[row.route_raw].totalFine += row.fine_amount;
    });

    const sorted = Object.values(routeCounts).sort((a, b) => b.count - a.count);
    container.innerHTML = sorted.map(r => {
      return `
        <div class="route-detail-row">
          <div class="route-detail-row__route">
            <code class="route-detail-row__path">${escapeHtml(r.route)}</code>
            <div class="route-detail-row__meta">
              ${r.vehicle !== '-' ? `<span class="route-meta-tag">${escapeHtml(r.vehicle)}</span>` : ''}
              <span class="route-meta-tag route-meta-tag--status">${escapeHtml(r.status)}</span>
            </div>
          </div>
          <div class="route-detail-row__stats">
            <span class="route-detail-row__count">${r.count} <small>ครั้ง</small></span>
            <span class="route-detail-row__fine">${formatCurrency(r.totalFine)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── Public API ──
  function renderAll(aggregates, filteredData) {
    renderDailyTrend(aggregates);
    renderCustomerChart(aggregates);
    renderTopDrivers(aggregates);
    renderPaymentStatus(aggregates);
    renderFullRoutes(filteredData || FineData.getAll());
  }

  function updateAll(aggregates, filteredData) {
    renderAll(aggregates, filteredData);
  }

  return { renderAll, updateAll };
})();
