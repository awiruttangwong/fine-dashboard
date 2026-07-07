/* ============================================================
   Fine Dashboard — Charts
   Chart.js 4 — 6 charts with Apple-inspired styling
   Redesigned: professional bar charts, full route display
   ============================================================ */

const Charts = (() => {
  const chartInstances = {};

  // Apple-inspired color palette
  const COLORS = {
    blue: '#0071E3',
    green: '#34C759',
    orange: '#FF9500',
    red: '#FF3B30',
    purple: '#AF52DE',
    teal: '#5AC8FA',
    pink: '#FF2D55',
    indigo: '#5856D6',
    mint: '#00C7BE',
    cyan: '#32ADE6',
    yellow: '#FFCC00',
    gray: '#8E8E93'
  };

  const PALETTE = [COLORS.blue, COLORS.green, COLORS.orange, COLORS.purple, COLORS.teal, COLORS.pink, COLORS.indigo, COLORS.mint, COLORS.cyan, COLORS.red];
  const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

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

  // Professional doughnut hover: focus/dim instead of geometry offset.
  //
  // WHY: Chart.js `hoverOffset` moves a slice outward on hover. During the
  // active animation Chart.js re-draws the arc at an intermediate radius,
  // which produces a visible "warp/collapse" — a known rendering quirk
  // (chartjs/Chart.js#10220). Tuning easing cannot fix it because the bug
  // is in how the arc geometry itself is drawn mid-transition.
  //
  // FIX: Don't move geometry at all. Instead, highlight only the hovered
  // slice at full opacity while dimming its neighbors. This is the technique
  // used by premium dashboards (Apple/Linear) — nothing distorts because
  // nothing shifts position. A tiny 3px offset gives subtle feedback without
  // triggering the warp.
  const DOUGHNUT_HOVER = {
    animations: {
      numbers: {
        duration: 1000,
        easing: 'easeOutQuart'
      }
    },
    interaction: {
      intersect: true,
      mode: 'nearest'
    },
    hover: {
      mode: 'nearest',
      intersect: true
    },
    datasets: {
      doughnut: {
        // Very small offset — just enough to signal "this is active" without
        // triggering the geometry-warp rendering quirk from large offsets.
        hoverOffset: 3
      }
    }
  };

  // Custom plugin: draws center text inside doughnut charts.
  // Shows total value and label centered in the doughnut hole.
  const doughnutCenterText = {
    id: 'doughnutCenterText',
    afterDraw(chart, args, options) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;

      const centerX = chartArea.left + (chartArea.width / 2);
      const centerY = chartArea.top + (chartArea.height / 2);

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Value (e.g., "23,000 ฿")
      ctx.font = "bold 1.5rem 'Prompt', sans-serif";
      ctx.fillStyle = '#1D1D1F';
      ctx.fillText(options.total || '', centerX, centerY - 10);

      // Label ("ยอดรวม")
      ctx.font = "500 0.75rem 'Prompt', sans-serif";
      ctx.fillStyle = '#86868B';
      ctx.fillText(options.label || 'ยอดรวม', centerX, centerY + 14);

      ctx.restore();
    }
  };

  // Custom plugin: dims non-hovered slices for a clean focus effect.
  // Registered per-chart via the chart's `plugins` array.
  const doughnutFocusPlugin = {
    id: 'doughnutFocus',
    // Re-draw is driven by the active element — hook beforeDatasetsDraw so
    // our dimming sits underneath the active slice's tooltip highlight.
    beforeDatasetsDraw(chart) {
      const active = chart.tooltip?._active?.length ? chart.tooltip._active : [];
      if (!active.length) return; // nothing hovered → render normally

      const activeIdx = new Set(active.map(a => a.index));
      const meta = chart.getDatasetMeta(0);
      if (!meta?.data) return;

      const ctx = chart.ctx;
      ctx.save();

      // Draw a translucent overlay over every non-active slice to dim it.
      meta.data.forEach((arc, i) => {
        if (activeIdx.has(i)) return;
        const props = arc.getProps(['x', 'y', 'startAngle', 'endAngle', 'outerRadius', 'innerRadius'], true);
        ctx.beginPath();
        // Arc parameters matching Chart.js doughnut drawing (counter-clockwise=false)
        ctx.arc(props.x, props.y, props.outerRadius + 1, props.startAngle, props.endAngle);
        ctx.arc(props.x, props.y, props.innerRadius - 1, props.endAngle, props.startAngle, true);
        ctx.closePath();
        // Card-surface-tinted overlay → reads as "dimmed" without flicker
        ctx.fillStyle = 'rgba(245, 245, 247, 0.55)';
        ctx.fill();
      });

      ctx.restore();
    }
  };

  // Draw professional value labels above the daily trend bars. We keep the
  // typography subtle and skip collisions on dense layouts so the chart stays
  // readable on narrower screens.
  const dailyTrendValueLabelPlugin = {
    id: 'dailyTrendValueLabel',
    afterDraw(chart, _args, pluginOptions) {
      const datasetIndex = pluginOptions?.datasetIndex ?? 0;
      const dataset = chart.data.datasets?.[datasetIndex];
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!dataset?.data?.length || !meta?.data?.length) return;

      const { ctx, chartArea } = chart;
      const bars = meta.data;
      const values = dataset.data;
      const activeItems = chart.tooltip?._active || [];
      const activeIndexes = new Set(
        activeItems
          .filter(item => item.datasetIndex === datasetIndex)
          .map(item => item.index)
      );

      // Hide all value labels when tooltip is active to prevent overlap
      if (activeIndexes.size > 0) return;

      const isNearActiveTooltip = (index) => {
        for (const activeIndex of activeIndexes) {
          if (Math.abs(activeIndex - index) <= 1) return true;
        }
        return false;
      };
      const slotWidth = bars.length > 0 ? chartArea.width / bars.length : chartArea.width;
      const isDenseLayout = slotWidth < 38;
      const topPadding = Number(chart.options?.layout?.padding?.top) || 0;
      const anchorTop = Math.max(chartArea.top - topPadding, 0);
      const occupiedRects = [];

      ctx.save();
      ctx.font = `${isDenseLayout ? 8.5 : 10}px 'Prompt', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      bars.forEach((bar, index) => {
        const rawValue = Number(values[index]) || 0;
        if (rawValue <= 0) return;
        if (isNearActiveTooltip(index)) return;

        const props = bar.getProps(['x', 'y', 'base'], true);
        const barHeight = Math.abs(props.base - props.y);
        const label = formatBarValueLabel(rawValue, isDenseLayout);
        const textWidth = ctx.measureText(label).width;
        const horizontalPadding = isDenseLayout ? 5 : 6;
        const pillWidth = textWidth + horizontalPadding * 2;
        const pillHeight = isDenseLayout ? 14 : 16;
        const unclampedPillX = props.x - pillWidth / 2;
        const topSafeY = anchorTop + 4;
        const preferredPillY = props.y - pillHeight - 8;
        const pillX = Math.min(
          Math.max(unclampedPillX, chartArea.left + 2),
          chartArea.right - pillWidth - 2
        );
        const textX = pillX + pillWidth / 2;
        const left = pillX;
        const right = pillX + pillWidth;

        let resolvedRect = null;
        const maxLanes = barHeight < 22 ? 4 : 3;

        for (let lane = 0; lane < maxLanes; lane++) {
          const laneOffset = lane * (pillHeight + 4);
          const laneY = Math.max(topSafeY, preferredPillY - laneOffset);
          const candidateRect = {
            left,
            right,
            top: laneY,
            bottom: laneY + pillHeight
          };

          const collides = occupiedRects.some((rect) => {
            const horizontalOverlap = candidateRect.left < rect.right + 6 && candidateRect.right > rect.left - 6;
            const verticalOverlap = candidateRect.top < rect.bottom + 2 && candidateRect.bottom > rect.top - 2;
            return horizontalOverlap && verticalOverlap;
          });

          if (!collides) {
            resolvedRect = candidateRect;
            break;
          }
        }

        if (!resolvedRect && !isDenseLayout && barHeight >= 28) {
          resolvedRect = {
            left,
            right,
            top: Math.max(topSafeY, preferredPillY),
            bottom: Math.max(topSafeY, preferredPillY) + pillHeight
          };
        }

        if (!resolvedRect) return;

        drawRoundedRect(ctx, pillX, resolvedRect.top, pillWidth, pillHeight, pillHeight / 2);
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
        ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 1;
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#4A4A4F';
        ctx.fillText(label, textX, resolvedRect.top + pillHeight / 2 + 0.5);
        occupiedRects.push(resolvedRect);
      });

      ctx.restore();
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

  function formatBarValueLabel(val, compact = false) {
    const amount = Number(val) || 0;
    if (compact && amount >= 1000) {
      const compactValue = amount >= 10000
        ? Math.round(amount / 1000)
        : Number((amount / 1000).toFixed(1));
      return `${String(compactValue).replace('.0', '')}K฿`;
    }
    return `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(amount)}฿`;
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
  }

  function getBarGradient(ctx) {
    const barGrad = ctx.createLinearGradient(0, 0, 0, 300);
    barGrad.addColorStop(0, 'rgba(0, 113, 227, 0.85)');
    barGrad.addColorStop(1, 'rgba(0, 113, 227, 0.10)');
    return barGrad;
  }

  function ensureDailyTrendLegend(canvas) {
    let legendEl = document.getElementById('chart-daily-trend-legend');
    if (!legendEl) {
      legendEl = document.createElement('div');
      legendEl.id = 'chart-daily-trend-legend';
      legendEl.style.cssText =
        'display:flex;align-items:center;gap:24px;padding:2px 0 14px 2px;' +
        'font-size:0.72rem;font-family:Prompt,sans-serif;color:#6E6E73;flex-wrap:wrap;';
      canvas.parentNode.insertBefore(legendEl, canvas);
    }

    legendEl.innerHTML = `
      <span style="display:flex;align-items:center;gap:8px;">
        <span style="display:inline-block;width:14px;height:14px;border-radius:4px;
              background:linear-gradient(180deg,rgba(0,113,227,0.70) 0%,rgba(0,113,227,0.10) 100%);
              border-top:2px solid rgba(0,113,227,0.9);"></span>
        ยอดค่าปรับ (฿)
      </span>
    `;
  }

  function setLegendItems(legendEl, html) {
    if (!legendEl) return;
    if (legendEl.dataset.renderedHtml === html) return;
    legendEl.innerHTML = html;
    legendEl.dataset.renderedHtml = html;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMonthLabel(monthValue) {
    const match = String(monthValue || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return '';

    const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const yearBE = Number(match[1]) + 543;
    const monthLabel = THAI_MONTHS_FULL[Number(match[2]) - 1] || '';
    return monthLabel ? `${monthLabel} ${yearBE}` : '';
  }

  function formatThaiDateLabel(dateValue) {
    const match = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return String(dateValue || '');

    const day = Number(match[3]);
    const monthLabel = THAI_MONTHS_SHORT[Number(match[2]) - 1] || '';
    const yearBE = Number(match[1]) + 543;
    return `${day} ${monthLabel} ${yearBE}`;
  }

  // ── 1. Daily Fine Trend (Bar + Premium Smooth Line) ──
  function renderDailyTrend(aggregates, selectedMonth) {
    const canvas = document.getElementById('chart-daily-trend');
    if (!canvas) return;

    const dates = Object.keys(aggregates.dailyTrend).sort();
    const amounts = dates.map(d => aggregates.dailyTrend[d].fineTotal);
    const counts = dates.map(d => aggregates.dailyTrend[d].count);
    const labels = dates.map(d => {
      const parts = d.split('-');
      const dayVal = parseInt(parts[2]);
      const monthLabel = THAI_MONTHS_SHORT[parseInt(parts[1]) - 1] || '';
      return [String(dayVal), monthLabel];
    });

    // ── Subtitle (update dynamic selected-month text) ──
    const subtitleEl = canvas.closest('.chart-card').querySelector('.chart-card__subtitle');
    if (subtitleEl) {
      const selectedMonthLabel = formatMonthLabel(selectedMonth || (dates[0] ? dates[0].slice(0, 7) : ''));
      if (dates.length > 0 && selectedMonthLabel) {
        subtitleEl.textContent = `ยอดค่าปรับสะสมรายวัน ประจำเดือน${selectedMonthLabel}`;
      } else if (selectedMonthLabel) {
        subtitleEl.textContent = `ไม่มีข้อมูลสำหรับเดือน${selectedMonthLabel}`;
      } else {
        subtitleEl.textContent = `ไม่มีข้อมูลสำหรับเดือนนี้`;
      }
    }

    ensureDailyTrendLegend(canvas);

    const ctx = canvas.getContext('2d');
    const barGrad = getBarGradient(ctx);
    const existingChart = chartInstances['dailyTrend'];

    if (existingChart) {
      existingChart.data.labels = labels;
      existingChart.data.datasets[0].data = amounts;
      existingChart.data.datasets[0].backgroundColor = barGrad;
      existingChart.options.plugins.tooltip.callbacks = {
        title: (items) => {
          const index = items?.[0]?.dataIndex ?? 0;
          return formatThaiDateLabel(dates[index]);
        },
        label: (tooltipCtx) => `  ยอดปรับ: ${formatCurrency(tooltipCtx.raw)}`,
        afterLabel: (tooltipCtx) => `  จำนวนรายการ: ${counts[tooltipCtx.dataIndex] || 0} รายการ`
      };
      existingChart.update('none');
      return;
    }

    chartInstances['dailyTrend'] = new Chart(ctx, {
      type: 'bar',
      plugins: [dailyTrendValueLabelPlugin],
      data: {
        labels,
        datasets: [
          {
            label: 'ยอดปรับ (฿)',
            data: amounts,
            backgroundColor: barGrad,
            borderWidth: 0,
            borderRadius: 5,
            borderSkipped: false,
            barPercentage: 0.6,
            categoryPercentage: 0.8,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        ...baseOptions,
        layout: { padding: { left: 0, right: 0, top: 48, bottom: 14 } },
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: "'Prompt'", size: 11 },
              color: '#6E6E73',
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              padding: 10,
              callback: function (value) {
                return this.getLabelForValue(value);
              }
            },
            border: { display: false }
          },
          y: {
            position: 'left',
            grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
            ticks: {
              font: { family: "'Prompt'", size: 11 },
              color: '#86868B',
              callback: (v) => v >= 1000 ? (v / 1000).toFixed(1).replace('.0', '') + 'K ฿' : v + ' ฿'
            },
            border: { display: false }
          }
        },
        plugins: {
          ...baseOptions.plugins,
          tooltip: {
            ...baseOptions.plugins.tooltip,
            callbacks: {
              title: (items) => {
                const index = items?.[0]?.dataIndex ?? 0;
                return formatThaiDateLabel(dates[index]);
              },
              label: (tooltipCtx) => `  ยอดปรับ: ${formatCurrency(tooltipCtx.raw)}`,
              afterLabel: (tooltipCtx) => `  จำนวนรายการ: ${counts[tooltipCtx.dataIndex] || 0} รายการ`
            }
          }
        }
      }
    });
  }



  // ── 2. Fine by Customer (Doughnut) ──
  function renderCustomerChart(aggregates) {
    const canvas = document.getElementById('chart-customer');
    if (!canvas) return;

    const entries = Object.entries(aggregates.customerBreakdown).sort((a, b) => b[1].fineTotal - a[1].fineTotal);
    const labels = entries.map(([name]) => name);
    const data = entries.map(([, v]) => v.fineTotal);
    const colors = [COLORS.blue, COLORS.orange, COLORS.purple, COLORS.teal];
    const total = data.reduce((a, b) => a + b, 0);

    const existingChart = chartInstances['customerChart'];
    if (existingChart) {
      existingChart.data.labels = labels;
      existingChart.data.datasets[0].data = data;
      existingChart.data.datasets[0].backgroundColor = colors.slice(0, labels.length);
      existingChart.options.plugins.tooltip.callbacks = {
        label: (tooltipCtx) => ` ${tooltipCtx.label}: ${formatCurrency(tooltipCtx.raw)} (${total > 0 ? ((tooltipCtx.raw / total) * 100).toFixed(1) : '0.0'}%)`
      };
      existingChart.options.plugins.doughnutCenterText = {
        total: formatCurrency(total),
        label: 'ยอดรวม'
      };
      existingChart.update('none');
    } else {
      chartInstances['customerChart'] = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 0
        }]
      },
      plugins: [doughnutFocusPlugin, doughnutCenterText],
      options: {
        ...baseOptions,
        ...DOUGHNUT_HOVER,
        cutout: '72%',
        plugins: {
          ...baseOptions.plugins,
          tooltip: {
            ...baseOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)} (${((ctx.raw / total) * 100).toFixed(1)}%)`
            }
          },
          doughnutCenterText: {
            total: formatCurrency(total),
            label: 'ยอดรวม'
          }
        }
      }
      });
    }

    const legendEl = document.getElementById('legend-customer');
    if (legendEl) {
      const legendHtml = entries.map(([name, v], i) => `
        <div class="chart-legend__item">
          <span class="chart-legend__color" style="background:${colors[i]}"></span>
          ${escapeHtml(name)}
          <span class="chart-legend__value">${formatCurrency(v.fineTotal)}</span>
        </div>
      `).join('');
      setLegendItems(legendEl, legendHtml);
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
      const color = i === 0
        ? '#0071E3'
        : i === 1
          ? '#2C78D6'
          : i === 2
            ? '#5A9BE8'
            : '#C7C7CC';
      const rankBg = i === 0
        ? 'background:#0071E3;color:#fff'
        : i === 1
          ? 'background:#2C78D6;color:#fff'
          : i === 2
            ? 'background:#5A9BE8;color:#fff'
            : 'background:#F0F0F2;color:#6E6E73';
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
    const canvas = document.getElementById('chart-route-groups');
    if (!canvas) return;

    const sorted = Object.entries(aggregates.routeGroupCounts).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(([name]) => name);
    const data = sorted.map(([, count]) => count);

    const total = data.reduce((a, b) => a + b, 0);
    const existingChart = chartInstances['routeGroups'];
    if (existingChart) {
      existingChart.data.labels = labels;
      existingChart.data.datasets[0].data = data;
      existingChart.data.datasets[0].backgroundColor = PALETTE.slice(0, labels.length);
      existingChart.options.plugins.tooltip.callbacks = {
        label: (tooltipCtx) => ` ${tooltipCtx.label}: ${tooltipCtx.raw} รายการ (${total > 0 ? ((tooltipCtx.raw / total) * 100).toFixed(1) : '0.0'}%)`
      };
      existingChart.update('none');
    } else {
      chartInstances['routeGroups'] = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: PALETTE.slice(0, labels.length),
          borderWidth: 0
        }]
      },
      plugins: [doughnutFocusPlugin],
      options: {
        ...baseOptions,
        ...DOUGHNUT_HOVER,
        cutout: '62%',
        plugins: {
          ...baseOptions.plugins,
          tooltip: {
            ...baseOptions.plugins.tooltip,
            callbacks: {
              label: (tooltipCtx) => ` ${tooltipCtx.label}: ${tooltipCtx.raw} รายการ (${total > 0 ? ((tooltipCtx.raw / total) * 100).toFixed(1) : '0.0'}%)`
            }
          }
        }
      }
      });
    }

    const legendEl = document.getElementById('legend-route-groups');
    if (legendEl) {
      const legendHtml = sorted.map(([name, count], i) => `
        <div class="chart-legend__item">
          <span class="chart-legend__color" style="background:${PALETTE[i]}"></span>
          ${escapeHtml(name)}
          <span class="chart-legend__value">${count}</span>
        </div>
      `).join('');
      setLegendItems(legendEl, legendHtml);
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
    const canvas = document.getElementById('chart-payment-status');
    if (!canvas) return;

    const statusLabels = {
      'open': 'ค้างชำระ',
      'partial': 'ผ่อนชำระ',
      'paid': 'ชำระค่าปรับแล้ว'
    };
    const statusColors = {
      'open': COLORS.blue,
      'partial': COLORS.orange,
      'paid': COLORS.green
    };

    const entries = Object.entries(aggregates.paymentStatusCounts)
      .filter(([key]) => statusLabels[key] && statusColors[key])
      .sort((a, b) => b[1] - a[1]);
    const labels = entries.map(([k]) => statusLabels[k] || k);
    const data = entries.map(([, v]) => v);
    const colors = entries.map(([k]) => statusColors[k] || COLORS.gray);

    const existingChart = chartInstances['paymentStatus'];
    if (existingChart) {
      existingChart.data.labels = labels;
      existingChart.data.datasets[0].data = data;
      existingChart.data.datasets[0].backgroundColor = colors;
      existingChart.options.plugins.tooltip.callbacks = {
        label: (tooltipCtx) => ` ${tooltipCtx.label}: ${tooltipCtx.raw} รายการ`
      };
      existingChart.update('none');
    } else {
      chartInstances['paymentStatus'] = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 0
        }]
      },
      plugins: [doughnutFocusPlugin],
      options: {
        ...baseOptions,
        ...DOUGHNUT_HOVER,
        cutout: '68%',
        plugins: {
          ...baseOptions.plugins,
          tooltip: {
            ...baseOptions.plugins.tooltip,
            callbacks: {
              label: (tooltipCtx) => ` ${tooltipCtx.label}: ${tooltipCtx.raw} รายการ`
            }
          }
        }
      }
      });
    }

    const legendEl = document.getElementById('legend-payment-status');
    if (legendEl) {
      const legendHtml = entries.map(([k, count], i) => `
        <div class="chart-legend__item">
          <span class="chart-legend__color" style="background:${colors[i]}"></span>
          ${escapeHtml(statusLabels[k] || k)}
          <span class="chart-legend__value">${count}</span>
        </div>
      `).join('');
      setLegendItems(legendEl, legendHtml);
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
  function renderAll(aggregates, filteredData, filters = {}) {
    renderDailyTrend(aggregates, filters.selectedMonth);
    renderCustomerChart(aggregates);
    renderTopDrivers(aggregates);
    renderPaymentStatus(aggregates);
    renderFullRoutes(filteredData || FineData.getAll());
  }

  function updateAll(aggregates, filteredData, filters = {}) {
    renderAll(aggregates, filteredData, filters);
  }

  return { renderAll, updateAll };
})();
