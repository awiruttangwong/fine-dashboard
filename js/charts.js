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
      // แท่งแคบเกินกว่าจะวางป้ายได้โดยไม่ทับกัน (มือถือ / เดือนที่มีหลายวัน) — ไม่วาดป้าย
      // ดูยอดได้จาก tooltip ตอนแตะแท่งแทน
      if (slotWidth < 24) return;
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
    return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(val) + ' ฿';
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

  function setContainerHtml(container, html) {
    if (!container) return;
    if (container.dataset.renderedHtml === html) return;
    container.innerHTML = html;
    container.dataset.renderedHtml = html;
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

  // เติมวันที่ไม่มีค่าปรับในเดือนที่เลือก (ยอด 0) ตั้งแต่วันที่ 1 ถึงวันล่าสุดที่มีข้อมูล ให้แกน x
  // ต่อเนื่อง — เดิมข้ามวันที่ว่าง (เช่น 13 → 15) แท่งจึงชิดกันเหมือนวันติดกัน · วันที่นอก
  // เดือนที่เลือก (แถวที่อยู่ชีตเดือนนี้แต่วันที่ย้อนหลัง) คงไว้ตามเดิม ไม่เติมช่วงว่างให้
  function fillMissingDays(dates, selectedMonth) {
    const month = /^\d{4}-\d{2}$/.test(selectedMonth || '') ? selectedMonth : null;
    if (!month) return dates;
    const inMonth = dates.filter(d => d.startsWith(month + '-'));
    if (!inMonth.length) return dates;
    const lastDay = Math.max(...inMonth.map(d => parseInt(d.slice(8, 10), 10)));
    const filled = [];
    for (let day = 1; day <= lastDay; day++) filled.push(`${month}-${String(day).padStart(2, '0')}`);
    return [...new Set([...dates, ...filled])].sort();
  }

  // ── 1. Daily Fine Trend (Bar + Premium Smooth Line) ──
  function renderDailyTrend(aggregates, selectedMonth) {
    const canvas = document.getElementById('chart-daily-trend');
    if (!canvas) return;

    const dates = fillMissingDays(Object.keys(aggregates.dailyTrend).sort(), selectedMonth);
    const dayData = (d) => aggregates.dailyTrend[d] || {};
    const fineAmounts = dates.map(d => dayData(d).fineTotal || 0);
    const debtAmounts = dates.map(d => dayData(d).debtTotal || 0);
    const amounts = dates.map((d, i) => fineAmounts[i] + debtAmounts[i]);
    const counts = dates.map(d => dayData(d).count || 0);
    const debtCounts = dates.map(d => dayData(d).debtCount || 0);
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
        subtitleEl.textContent = `ยอดค่าปรับสะสมรายวัน ประจำเดือน${selectedMonthLabel} (รวมค่าปรับรถไม่เข้ารับงาน)`;
      } else if (selectedMonthLabel) {
        subtitleEl.textContent = `ไม่มีข้อมูลสำหรับเดือน${selectedMonthLabel}`;
      } else {
        subtitleEl.textContent = `ไม่มีข้อมูลสำหรับเดือนนี้`;
      }
    }

    ensureDailyTrendLegend(canvas);

    // แยกรายละเอียดยอดปกติ/ยอดค่าปรับรถไม่เข้ารับงานใน tooltip เท่านั้น — ตัวแท่งกราฟ
    // และ pill ค่ายอดด้านบนยังคงเป็นยอดรวมค่าเดียว (ตามที่ตกลง) ไม่แตกสี/แตกแท่ง
    const buildTooltipCallbacks = () => ({
      title: (items) => {
        const index = items?.[0]?.dataIndex ?? 0;
        return formatThaiDateLabel(dates[index]);
      },
      label: (tooltipCtx) => `  ยอดปรับรวม: ${formatCurrency(tooltipCtx.raw)}`,
      afterLabel: (tooltipCtx) => {
        const i = tooltipCtx.dataIndex;
        const lines = [`  ค่าปรับปกติ: ${formatCurrency(fineAmounts[i])} (${counts[i]} รายการ)`];
        if (debtAmounts[i] > 0) {
          lines.push(`  ค่าปรับรถไม่เข้ารับงาน: ${formatCurrency(debtAmounts[i])} (${debtCounts[i]} รายการ)`);
        }
        return lines;
      }
    });

    const ctx = canvas.getContext('2d');
    const barGrad = getBarGradient(ctx);
    const existingChart = chartInstances['dailyTrend'];

    if (existingChart) {
      existingChart.data.labels = labels;
      existingChart.data.datasets[0].data = amounts;
      existingChart.data.datasets[0].backgroundColor = barGrad;
      existingChart.options.plugins.tooltip.callbacks = buildTooltipCallbacks();
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
              autoSkip: true,
              autoSkipPadding: 6,
              maxRotation: 0,
              minRotation: 0,
              padding: 10,
              // จอแคบ: แสดงแค่เลขวัน (ไม่ต่อชื่อเดือนบรรทัดสอง ซึ่งเคยติดกันเป็น "ต.ค.ต.ค.")
              callback: function (value) {
                const label = this.getLabelForValue(value);
                return this.chart.width < 640 && Array.isArray(label) ? label[0] : label;
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
            callbacks: buildTooltipCallbacks()
          }
        }
      }
    });
  }



  // สีประจำลูกค้า (คงที่ ไม่ขึ้นกับอันดับยอด) — วงค่าปรับอื่นๆ กับวงรถไม่เข้ารับงานวางคู่กัน
  // ลูกค้าเดียวกันต้องเป็นสีเดียวกันทั้งสองวงถึงจะเทียบกันได้ · ลูกค้าใหม่ที่ไม่มีในรายการใช้สีสำรอง
  const CUSTOMER_COLORS = { FLASH: COLORS.blue, SPX: COLORS.orange, KEX: COLORS.purple, BEST: COLORS.teal, 'J&T': COLORS.red, SGT: COLORS.green };
  const FALLBACK_CUSTOMER_COLORS = [COLORS.indigo, COLORS.pink, COLORS.mint, COLORS.yellow, COLORS.gray];
  function customerColor(name, i) {
    return CUSTOMER_COLORS[String(name).toUpperCase()] || FALLBACK_CUSTOMER_COLORS[i % FALLBACK_CUSTOMER_COLORS.length];
  }

  // วงโดนัทสัดส่วนตามลูกค้า ใช้ร่วมกันทั้งค่าปรับอื่นๆ และรถไม่เข้ารับงาน · entries = [[ลูกค้า, ยอด], ...]
  function renderCustomerDoughnut({ canvasId, legendId, chartKey, entries, emptyText }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const sorted = entries.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(([name]) => name);
    const data = sorted.map(([, v]) => v);
    const colors = sorted.map(([name], i) => customerColor(name, i));
    const total = data.reduce((a, b) => a + b, 0);
    const tooltipLabel = (tooltipCtx) => ` ${tooltipCtx.label}: ${formatCurrency(tooltipCtx.raw)} (${total > 0 ? ((tooltipCtx.raw / total) * 100).toFixed(1) : '0.0'}%)`;

    const existingChart = chartInstances[chartKey];
    if (existingChart) {
      existingChart.data.labels = labels;
      existingChart.data.datasets[0].data = data;
      existingChart.data.datasets[0].backgroundColor = colors;
      existingChart.options.plugins.tooltip.callbacks = { label: tooltipLabel };
      existingChart.options.plugins.doughnutCenterText = { total: formatCurrency(total), label: 'ยอดรวม' };
      existingChart.update('none');
    } else {
      chartInstances[chartKey] = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
        plugins: [doughnutFocusPlugin, doughnutCenterText],
        options: {
          ...baseOptions,
          ...DOUGHNUT_HOVER,
          cutout: '72%',
          plugins: {
            ...baseOptions.plugins,
            tooltip: { ...baseOptions.plugins.tooltip, callbacks: { label: tooltipLabel } },
            doughnutCenterText: { total: formatCurrency(total), label: 'ยอดรวม' }
          }
        }
      });
    }

    const legendEl = document.getElementById(legendId);
    if (legendEl) {
      const legendHtml = sorted.length
        ? sorted.map(([name, v], i) => `
        <div class="chart-legend__item">
          <span class="chart-legend__color" style="background:${colors[i]}"></span>
          ${escapeHtml(name)}
          <span class="chart-legend__value">${formatCurrency(v)}</span>
        </div>
      `).join('')
        : `<div class="chart-legend__item">${escapeHtml(emptyText)}</div>`;
      setLegendItems(legendEl, legendHtml);
    }
  }

  // ── 2. Fine by Customer (Doughnut) — ค่าปรับอื่นๆ ──
  function renderCustomerChart(aggregates) {
    renderCustomerDoughnut({
      canvasId: 'chart-customer', legendId: 'legend-customer', chartKey: 'customerChart',
      entries: Object.entries(aggregates.customerBreakdown).map(([name, v]) => [name, v.fineTotal]),
      emptyText: 'ไม่มีค่าปรับอื่นๆในช่วงที่เลือก'
    });
  }

  // ── 2b. Fine by Customer (Doughnut) — ค่าปรับรถไม่เข้ารับงาน ──
  // ยอดต่อลูกค้าคิดแบบเดียวกับการ์ด "ค่าปรับรถไม่เข้ารับงาน · ค่าปรับทั้งหมด"
  // (data.js debtCustomerBreakdown) ยอดรวมกลางวงจึงเท่ากับการ์ดนั้นเสมอ
  function renderDebtCustomerChart(aggregates) {
    renderCustomerDoughnut({
      canvasId: 'chart-debt-customer', legendId: 'legend-debt-customer', chartKey: 'debtCustomerChart',
      entries: Object.entries(aggregates.debtCustomerBreakdown || {}),
      emptyText: 'ไม่มีค่าปรับรถไม่เข้ารับงานในช่วงที่เลือก'
    });
  }

  // ── 3. Top 10 Drivers (Redesigned — Professional list style) ──
  // ชื่อคนจริง: มีตัวอักษร (ไทย/อังกฤษ) อย่างน้อย 3 ตัว และไม่มีตัวเลขเลย — ทะเบียนรถ/รหัส
  // ทุกแบบที่พบในข้อมูลมีตัวเลขเสมอ ส่วนชื่อคนไม่มี · ตัดค่าว่าง/ขีด/(ไม่ระบุ) ออกด้วย
  function isDriverPersonName(name) {
    if (!name || name === '-' || name === '(ไม่ระบุ)') return false;
    if (/\d/.test(name)) return false;
    return (name.match(/[ก-ฮa-zA-Z]/g) || []).length >= 3;
  }

  function renderTopDrivers(aggregates) {
    const container = document.getElementById('chart-top-drivers-list');
    if (!container) return;

    // ช่อง "ชื่อ" ในชีตลูกค้าบางเจ้า (KEX/BEST/SGT/SPX) มักกรอกเป็นทะเบียนรถหรือรหัส เช่น
    // "ฒฉ2301", "3ฒอ1105", "70-7910", "732938" — ไม่ใช่ชื่อ พขร. จึงไม่นำมาจัดอันดับ
    // และรวมชื่อเดียวกันที่เว้นวรรคต่างกัน (เช่น "ธนนท์    บรรดาศักดิ") เป็นคนเดียว
    const merged = {};
    Object.entries(aggregates.driverCounts).forEach(([raw, count]) => {
      const name = String(raw || '').replace(/\s+/g, ' ').trim();
      if (!isDriverPersonName(name)) return;
      merged[name] = (merged[name] || 0) + count;
    });
    const sorted = Object.entries(merged)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th'))
      .slice(0, 10);

    if (sorted.length === 0) {
      setContainerHtml(container, `<div class="empty-state"><div class="empty-state__text">ไม่มีข้อมูล พขร. ที่ถูกปรับสำหรับเดือนนี้</div></div>`);
      return;
    }

    const maxCount = sorted[0][1];

    const html = sorted.map(([name, count], i) => {
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

    setContainerHtml(container, html);
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

    // "(รถไม่เข้ารับงาน)" คือคนละหน่วยนับกับ fine data (จำนวนคน พขร. ไม่ใช่จำนวน
    // รายการค่าปรับ) — ผสานอยู่ในวงเดียวกันตามที่ตกลง แต่แยก slice + สีชัดเจน
    // ไม่ให้ปนกับของเดิม
    const statusColors = {
      'ค่าปรับชำระแล้ว': COLORS.green,
      'ค่าปรับรอชำระ': COLORS.blue,
      'ปรับไม่ได้': COLORS.red,
      'ค่าปรับผ่อนชำระ (รถไม่เข้ารับงาน)': COLORS.indigo,
      'ค่าปรับชำระแล้ว (รถไม่เข้ารับงาน)': COLORS.mint,
      'ปรับไม่ได้ (รถไม่เข้ารับงาน)': COLORS.orange
    };
    const breakdown = aggregates.statusBreakdown || {};
    const driverCounts = aggregates.driverStatusCounts || {};
    const counts = {
      'ค่าปรับชำระแล้ว': breakdown.paidCount || 0,
      'ค่าปรับรอชำระ': breakdown.pendingCount || 0,
      'ปรับไม่ได้': breakdown.uncollectibleCount || 0,
      'ค่าปรับผ่อนชำระ (รถไม่เข้ารับงาน)': driverCounts.active || 0,
      'ค่าปรับชำระแล้ว (รถไม่เข้ารับงาน)': driverCounts.done || 0,
      'ปรับไม่ได้ (รถไม่เข้ารับงาน)': driverCounts.nonCollectible || 0
    };

    const entries = Object.entries(counts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(([k]) => k);
    const data = entries.map(([, v]) => v);
    const colors = entries.map(([k]) => statusColors[k] || COLORS.gray);

    // driverCounts (active/done/nonCollectible) นับจากจำนวนแถวข้อมูลหนี้ พขร. ตรงๆ
    // (data.js:getDriverStatusCounts) ไม่ได้ทำ dedupe ตามชื่อคนขับ — พขร. คนเดียวมี
    // หนี้ได้มากกว่า 1 รายการ นับซ้ำเป็นคนได้ถ้าใช้หน่วย "คน" หน่วยที่ถูกต้องคือ
    // "รายการ" เหมือนกับการ์ด KPI อื่นๆ ที่ใช้ตัวเลขชุดเดียวกัน (activeCases/
    // doneCases/totalCases ล้วนแปะป้าย "รายการ" ทั้งหมด)
    const labelUnit = () => 'รายการ';
    // กลางวง: จำนวนรายการทั้งหมด (ทุกสถานะรวมกัน) — วงนี้นับเป็นรายการ ไม่ใช่ยอดเงิน
    const totalCount = data.reduce((a, b) => a + b, 0);
    const centerText = { total: new Intl.NumberFormat('th-TH').format(totalCount), label: 'รายการทั้งหมด' };

    const existingChart = chartInstances['paymentStatus'];
    if (existingChart) {
      existingChart.data.labels = labels;
      existingChart.data.datasets[0].data = data;
      existingChart.data.datasets[0].backgroundColor = colors;
      existingChart.options.plugins.tooltip.callbacks = {
        label: (tooltipCtx) => ` ${tooltipCtx.label}: ${tooltipCtx.raw} ${labelUnit(tooltipCtx.label)}`
      };
      existingChart.options.plugins.doughnutCenterText = centerText;
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
      plugins: [doughnutFocusPlugin, doughnutCenterText],
      options: {
        ...baseOptions,
        ...DOUGHNUT_HOVER,
        cutout: '68%',
        plugins: {
          ...baseOptions.plugins,
          doughnutCenterText: centerText,
          tooltip: {
            ...baseOptions.plugins.tooltip,
            callbacks: {
              label: (tooltipCtx) => ` ${tooltipCtx.label}: ${tooltipCtx.raw} ${labelUnit(tooltipCtx.label)}`
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
          ${escapeHtml(k)}
          <span class="chart-legend__value">${count}</span>
        </div>
      `).join('');
      setLegendItems(legendEl, legendHtml);
    }
  }

  // ── 7. Full Route Table (NEW — shows complete route strings) ──
  function renderFullRoutes(filteredData, selectedMonth) {
    const container = document.getElementById('route-detail-list');
    if (!container) return;

    // Group by route (ตัดช่องว่างหน้า/หลัง/ซ้ำ ให้ " FSOCW1" กับ "FSOCW1" เป็นเส้นทางเดียวกัน)
    // แถวที่ไม่มีเส้นทางไม่นำมาแสดง (เดิมขึ้นเป็นแถวว่าง) · ยอดว่างนับเป็น 0 ไม่ให้รวมเป็น NaN
    const normRoute = (v) => String(v || '').replace(/\s+/g, ' ').trim();
    const routeCounts = {};
    filteredData.forEach(row => {
      const route = normRoute(row.route_raw);
      if (!route) return;
      if (!routeCounts[route]) {
        routeCounts[route] = { route, vehicle: row.vehicle_type || '', isDebt: false, count: 0, totalFine: 0 };
      }
      if (!routeCounts[route].vehicle && row.vehicle_type) routeCounts[route].vehicle = row.vehicle_type;
      routeCounts[route].count++;
      routeCounts[route].totalFine += Number(row.fine_amount) || 0;
    });

    // รวมเส้นทางจากค่าปรับรถไม่เข้ารับงานเข้าลิสต์เดียวกัน — คีย์แยกด้วย prefix
    // "debt:" กันชนกับ route_raw ปกติที่อาจซ้ำข้อความกันโดยบังเอิญ (คนละชุดข้อมูล
    // คนละความหมาย ไม่ควรถูกนับรวมเป็นแถวเดียวกัน) ยืนยันแล้วว่าเป็นข้อมูลคนละชุดกับ
    // ค่าปรับปกติเสมอ จึงนับจำนวน/รวมยอดแยกกันได้โดยไม่ทับซ้อน
    FineData.getFilteredDebtRows(selectedMonth).forEach(row => {
      const route = normRoute(row.route);
      if (!route || route === '-') return;
      const key = 'debt:' + route;
      if (!routeCounts[key]) {
        // ประเภทรถอ่านจากรหัสเส้นทาง (เช่น FD-4W-... → 4W) แบบเดียวกับค่าปรับปกติ ถ้าอ่านไม่ได้ไม่แสดง
        const vehicle = (route.match(/(?:^|-)(\d+W(?:J|\d+(?:\.\d+)?)?)(?=-|$)/i) || [])[1] || '';
        routeCounts[key] = { route, vehicle: vehicle.toUpperCase(), isDebt: true, count: 0, totalFine: 0 };
      }
      routeCounts[key].count++;
      routeCounts[key].totalFine += Number(row.total) || 0;
    });

    // เรียงตามจำนวนครั้ง แล้วตามยอดเงิน (เดิมจำนวนเท่ากันลำดับสุ่มตามลำดับข้อมูล)
    const sorted = Object.values(routeCounts).sort((a, b) => b.count - a.count || b.totalFine - a.totalFine);

    if (sorted.length === 0) {
      setContainerHtml(container, `<div class="empty-state"><div class="empty-state__text">ไม่มีข้อมูลเส้นทางสำหรับเดือนนี้</div></div>`);
      return;
    }

    const html = sorted.map(r => {
      // แสดงเฉพาะประเภทรถ (ถ้ามี) — ไม่แสดงสถานะเส้นทาง RO/RS1/RS2 แล้ว
      // เส้นทางจากค่าปรับรถไม่เข้ารับงานมีป้ายบอกที่มาเพิ่ม (ยอดเป็นยอดหนี้ พขร. ไม่ใช่ค่าปรับปกติ)
      const metaTags = `${r.vehicle ? `<span class="route-meta-tag">${escapeHtml(r.vehicle)}</span>` : ''}${r.isDebt ? '<span class="route-meta-tag route-meta-tag--debt">รถไม่เข้ารับงาน</span>' : ''}`;
      return `
        <div class="route-detail-row">
          <div class="route-detail-row__route">
            <code class="route-detail-row__path">${escapeHtml(r.route)}</code>
            ${metaTags ? `<div class="route-detail-row__meta">${metaTags}</div>` : ''}
          </div>
          <div class="route-detail-row__stats">
            <span class="route-detail-row__count">${r.count} <small>ครั้ง</small></span>
            <span class="route-detail-row__fine">${formatCurrency(r.totalFine)}</span>
          </div>
        </div>
      `;
    }).join('');

    setContainerHtml(container, html);
  }

  // ── Public API ──
  // แต่ละ renderXxx ทำงานเป็นอิสระจากกัน (คนละ container/canvas) แต่เดิมเรียกเรียง
  // กันตรงๆ โดยไม่มี try/catch — ถ้าตัวใดตัวหนึ่ง throw (เช่น renderDailyTrend หรือ
  // renderCustomerChart ซึ่งอยู่ก่อน renderTopDrivers ในลำดับนี้) ตัวที่เหลือทั้งหมด
  // จะไม่ทำงานเลยในรอบนั้น ทำให้การ์ดหลังๆ (เช่น "10 อันดับพนักงาน") ค้างอยู่ที่ค่า
  // เดิม/skeleton โดยไม่มี error ให้เห็นบนหน้าจอ — ครอบแต่ละตัวด้วย try/catch แยกกัน
  // เพื่อกันไม่ให้ความล้มเหลวของกราฟหนึ่งบล็อกกราฟอื่นที่ไม่เกี่ยวข้องกัน
  function safeRender(name, fn) {
    try {
      fn();
    } catch (err) {
      console.error(`[Fine Dashboard] Chart render failed: ${name}`, err);
    }
  }

  function renderAll(aggregates, filteredData, filters = {}) {
    safeRender('renderDailyTrend', () => renderDailyTrend(aggregates, filters.selectedMonth));
    safeRender('renderCustomerChart', () => renderCustomerChart(aggregates));
    safeRender('renderDebtCustomerChart', () => renderDebtCustomerChart(aggregates));
    safeRender('renderTopDrivers', () => renderTopDrivers(aggregates));
    safeRender('renderPaymentStatus', () => renderPaymentStatus(aggregates));
    safeRender('renderFullRoutes', () => renderFullRoutes(filteredData || FineData.getAll(), filters.selectedMonth));
  }

  function updateAll(aggregates, filteredData, filters = {}) {
    renderAll(aggregates, filteredData, filters);
  }

  return { renderAll, updateAll };
})();
