/* ============================================================
   Fine Dashboard — KPI Cards
   Computation, rendering, count-up animation
   All icons use inline SVG — no emoji
   ============================================================ */

const KPICards = (() => {
  let container = null;

  // ── SVG Icons ──
  const ICONS = {
    clipboard: `<svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 -960 960 960" width="22" fill="#5985E1"><path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/></svg>`,
    money: `<svg width="22" height="22" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M200-200v-560 560Zm0 80q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v100h-80v-100H200v560h560v-100h80v100q0 33-23.5 56.5T760-120H200Zm320-160q-33 0-56.5-23.5T440-360v-240q0-33 23.5-56.5T520-680h280q33 0 56.5 23.5T880-600v240q0 33-23.5 56.5T800-280H520Zm280-80v-240H520v240h280Zm-117.5-77.5Q700-455 700-480t-17.5-42.5Q665-540 640-540t-42.5 17.5Q580-505 580-480t17.5 42.5Q615-420 640-420t42.5-17.5Z"/></svg>`,
    checkCircle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    clock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    trendUp: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
    alertTriangle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  };

  function formatNumber(num) {
    return new Intl.NumberFormat('th-TH').format(num);
  }

  function formatCurrency(num) {
    return new Intl.NumberFormat('th-TH').format(num) + ' ฿';
  }

  function formatPercent(num) {
    return num.toFixed(1) + '%';
  }

  function buildMetricValueMarkup(formattedValue) {
    const text = String(formattedValue ?? '').trim();
    if (!text) {
      return '<span class="kpi-card__value-main">0</span>';
    }

    if (text.endsWith(' ฿')) {
      const main = text.slice(0, -2).trim();
      return `<span class="kpi-card__value-main">${main}</span><span class="kpi-card__value-suffix">฿</span>`;
    }

    if (text.endsWith('%')) {
      const main = text.slice(0, -1).trim();
      return `<span class="kpi-card__value-main">${main}</span><span class="kpi-card__value-suffix">%</span>`;
    }

    return `<span class="kpi-card__value-main">${text}</span>`;
  }

  function setMetricValue(element, formattedValue) {
    if (!element) return;
    element.innerHTML = buildMetricValueMarkup(formattedValue);
  }

  function animateValue(element, start, end, duration, formatter) {
    const startTime = performance.now();
    const diff = end - start;

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setMetricValue(element, formatter(Math.round(current * 10) / 10));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  const cardConfigs = [
    {
      id: 'total-fine',
      label: 'ยอดปรับรวม',
      icon: ICONS.money,
      iconClass: 'kpi-card__icon--red',
      getValue: (agg) => agg.totalFine,
      format: formatCurrency,
      getDetail: (agg) => `จาก ${formatNumber(agg.count)} รายการปรับ`
    },
    {
      id: 'paid-amount',
      label: 'ชำระค่าปรับแล้ว',
      icon: ICONS.checkCircle,
      iconClass: 'kpi-card__icon--green',
      getValue: (agg) => agg.paidCompletedAmount,
      format: formatCurrency,
      getDetail: (agg) => {
        const paidCount = (agg.statusBreakdown && agg.statusBreakdown.paidCount) || 0;
        return `${paidCount} รายการที่ปรับได้`;
      }
    },
    {
      id: 'remaining-amount',
      label: 'ยอดคงเหลือ',
      icon: ICONS.alertTriangle,
      iconClass: 'kpi-card__icon--orange',
      getValue: (agg) => agg.totalRemaining,
      format: formatCurrency,
      getDetail: (agg) => {
        const pendingCount = (agg.statusBreakdown && agg.statusBreakdown.pendingCount) || 0;
        const errorCount = agg.paymentStatusCounts['data_error'] || 0;
        const parts = [];
        if (pendingCount > 0) parts.push(`${pendingCount} รายการรอปรับ`);
        if (errorCount > 0) parts.push(`${errorCount} รายการต้องตรวจสอบ`);
        return parts.join(' • ') || 'ไม่มีรายการที่ต้องติดตาม';
      }
    },
    {
      id: 'collection-rate',
      label: 'อัตราการเรียกเก็บเงิน',
      icon: ICONS.trendUp,
      iconClass: 'kpi-card__icon--teal',
      getValue: (agg) => agg.collectionRate,
      format: formatPercent,
      getDetail: (agg) => `${formatCurrency(agg.paidCompletedAmount)} จาก ${formatCurrency(agg.totalFine)}`
    }
  ];

  function render(aggregates) {
    if (!container) container = document.getElementById('kpi-grid');
    if (!container) return;

    container.innerHTML = cardConfigs.map(config => {
      const value = config.getValue(aggregates);
      return `
        <div class="kpi-card" id="kpi-${config.id}">
          <div class="kpi-card__header-row">
            <span class="kpi-card__label">${config.label}</span>
            <div class="kpi-card__icon ${config.iconClass}">${config.icon}</div>
          </div>
          <div class="kpi-card__content">
            <div class="kpi-card__value" data-value="${value}">${buildMetricValueMarkup(config.format(0))}</div>
            <div class="kpi-card__detail">${config.getDetail(aggregates)}</div>
          </div>
        </div>
      `;
    }).join('');

    requestAnimationFrame(() => {
      container.querySelectorAll('.kpi-card__value').forEach((el, idx) => {
        const target = parseFloat(el.dataset.value);
        const config = cardConfigs[idx];
        animateValue(el, 0, target, 800, config.format);
      });
    });
  }

  function update(aggregates) {
    if (!container) container = document.getElementById('kpi-grid');
    if (!container) return;

    cardConfigs.forEach((config) => {
      const card = document.getElementById(`kpi-${config.id}`);
      if (!card) return;

      const valueEl = card.querySelector('.kpi-card__value');
      const detailEl = card.querySelector('.kpi-card__detail');
      const newValue = config.getValue(aggregates);
      const oldValue = parseFloat(valueEl.dataset.value) || 0;

      valueEl.dataset.value = newValue;
      detailEl.textContent = config.getDetail(aggregates);

      animateValue(valueEl, oldValue, newValue, 500, config.format);
    });
  }

  return { render, update };
})();
