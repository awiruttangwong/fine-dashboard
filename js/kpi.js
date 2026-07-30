/* ============================================================
   Fine Dashboard — KPI Cards
   Computation, rendering, count-up animation
   All icons use inline SVG — no emoji
   ============================================================ */

const KPICards = (() => {
  let container = null;
  let lastAgg = null; // เก็บ aggregates ล่าสุดไว้ให้ popup ที่มา (breakdown) ใช้ตอนกดการ์ด

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
      // "ยอดปรับรวม" = ภาพรวมเงินทั้งหมดของทั้ง 2 ชุดข้อมูลที่แยกกันในระบบ:
      //   (1) ค่าปรับปกติ (หัก "ปรับไม่ได้" ออกแล้ว เพราะเก็บเงินก้อนนั้นไม่ได้จริง)
      //   (2) ค่าปรับรถไม่เข้ารับงาน "ยอดปรับรวมทั้งหมด" (agg.debtGrandTotal — สูตรเดียว
      //       กับหน้าโมดูล debt: กลุ่มปรับได้เต็มยอด + กลุ่มปรับไม่ได้เฉพาะที่จ่ายแล้ว)
      // ทั้งคู่เป็น "ยอดทั้งหมด" คนละชุด ไม่ทับซ้อน จึงบวกรวมเป็นภาพเดียวได้ (agg.totalFine
      // ดิบยังเก็บยอดค่าปรับปกติทั้งหมดไว้ ใช้ต่อใน collectionRate/comparison ไม่กระทบ)
      id: 'total-fine',
      label: 'ยอดปรับรวม',
      icon: ICONS.money,
      iconClass: 'kpi-card__icon--red',
      getValue: (agg) => {
        const fineNet = agg.totalFine - (agg.statusBreakdown.uncollectibleAmount || 0);
        const debtTotal = (agg.debtGrandTotal && agg.debtGrandTotal.amount) || 0;
        return fineNet + debtTotal;
      },
      format: formatCurrency,
      getDetail: (agg) => {
        // แสดงจำนวนรายการรวมทั้ง 2 ส่วน (ค่าปรับปกติ + รถไม่เข้ารับงาน) แบบเดิม —
        // ส่วนที่มาของยอดเงินแยกละเอียดไปอยู่ใน popup ที่กดจากการ์ดแทน
        const netCount = agg.count - (agg.statusBreakdown.uncollectibleCount || 0);
        const debtCount = (agg.debtGrandTotal && agg.debtGrandTotal.count) || 0;
        return `จาก ${formatNumber(netCount + debtCount)} รายการ`;
      },
      // กดการ์ดนี้แล้วเด้ง popup แยกที่มาของยอดปรับรวม (ให้ผู้บริหารเห็นว่าประกอบจากอะไร)
      getBreakdown: (agg) => {
        const fineNet = agg.totalFine - (agg.statusBreakdown.uncollectibleAmount || 0);
        const fineCount = agg.count - (agg.statusBreakdown.uncollectibleCount || 0);
        const debtTotal = (agg.debtGrandTotal && agg.debtGrandTotal.amount) || 0;
        const debtCount = (agg.debtGrandTotal && agg.debtGrandTotal.count) || 0;
        return {
          title: 'ที่มาของยอดปรับรวม',
          rows: [
            { label: 'ค่าปรับ (ปกติ)', hint: `หัก "ปรับไม่ได้" ออกแล้ว`, amount: fineNet, count: fineCount, tone: 'red' },
            { label: 'ค่าปรับรถไม่เข้ารับงาน', hint: 'ยอดปรับรวมทั้งหมด', amount: debtTotal, count: debtCount, tone: 'blue' }
          ],
          total: fineNet + debtTotal
        };
      }
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
      // เดิมเป็นการ์ดเดียว "ผ่อนชำระ" ที่รวม 2 สถานะ (กำลังผ่อน/เสร็จแล้ว) ไว้ในบรรทัด
      // detail เดียวกัน — พอมีทั้งคู่พร้อมกัน ข้อความยาวจนล้นออกนอกกล่อง (วัดจริงแล้ว
      // scrollWidth > clientWidth ที่ 1400px) จึงแยกเป็น 2 การ์ดคนละตัวเลขหลักไปเลย
      // แทนที่จะพยายามยัดทั้ง 2 สถานะไว้ในบรรทัดเดียว
      id: 'installment-active',
      label: 'กำลังผ่อน',
      icon: ICONS.clock,
      iconClass: 'kpi-card__icon--blue',
      getValue: (agg) => agg.installment.totalRemainingAmount,
      format: formatCurrency,
      getDetail: (agg) => {
        const { activeCases } = agg.installment;
        return activeCases > 0 ? `${formatNumber(activeCases)} รายการ` : 'ไม่มีรายการที่กำลังผ่อน';
      }
    },
    {
      id: 'installment-done',
      label: 'ผ่อนเสร็จแล้ว',
      icon: ICONS.checkCircle,
      iconClass: 'kpi-card__icon--mint',
      getValue: (agg) => agg.installment.doneAmount,
      format: formatCurrency,
      getDetail: (agg) => {
        const { doneCases } = agg.installment;
        return doneCases > 0 ? `${formatNumber(doneCases)} รายการ` : 'ยังไม่มีรายการผ่อนเสร็จ';
      }
    },
    {
      // "ปรับไม่ได้" รวม 2 แหล่งที่เป็นความหมายเดียวกัน (ยอดเก็บไม่ได้) เข้าด้วยกัน:
      // (1) ค่าปรับลูกค้าที่เก็บไม่ได้ จากชีต ปรับไม่ได้(Mx) และ (2) หนี้ พขร.
      // ที่ตัดเป็นปรับไม่ได้ จาก Drivers(Mx) — ทั้งสองกรองตามตัวกรองเดือนเดียวกัน
      // (month_label ของ Drivers/Payments ยืนยันแล้วว่าคือเดือนปฏิทินจริง เหมือน
      // fine_date) รายละเอียดแสดงยอดรวมเดียว (ไม่แยกที่มา) ตามที่ตกลง — ดูรายละเอียด
      // แยกที่มาได้จากตารางอยู่แล้ว ไม่จำเป็นต้องพูดซ้ำในการ์ดสรุป
      id: 'non-collectible',
      label: 'ปรับไม่ได้',
      icon: ICONS.alertTriangle,
      iconClass: 'kpi-card__icon--red',
      getValue: (agg) => (agg.statusBreakdown.uncollectibleAmount || 0) + (agg.nonCollectibleDebt.totalAmount || 0),
      format: formatCurrency,
      getDetail: (agg) => {
        const total = (agg.statusBreakdown.uncollectibleCount || 0) + (agg.nonCollectibleDebt.totalCases || 0);
        return total > 0 ? `${formatNumber(total)} รายการ` : 'ไม่มีรายการปรับไม่ได้';
      }
    }
  ];

  function render(aggregates) {
    if (!container) container = document.getElementById('kpi-grid');
    if (!container) return;
    lastAgg = aggregates;

    container.innerHTML = cardConfigs.map(config => {
      const value = config.getValue(aggregates);
      const clickable = typeof config.getBreakdown === 'function';
      return `
        <div class="kpi-card${clickable ? ' kpi-card--clickable' : ''}" id="kpi-${config.id}"${clickable ? ' role="button" tabindex="0" aria-haspopup="dialog" title="ดูที่มาของยอด"' : ''}>
          <div class="kpi-card__header-row">
            <span class="kpi-card__label">${config.label}</span>
            <div class="kpi-card__icon ${config.iconClass}">${config.icon}</div>
          </div>
          <div class="kpi-card__content">
            <div class="kpi-card__value" data-value="${value}">${buildMetricValueMarkup(config.format(0))}</div>
            <div class="kpi-card__detail">${config.getDetail(aggregates)}</div>
          </div>
          ${clickable ? '<span class="kpi-card__more" aria-hidden="true">ดูที่มา</span>' : ''}
        </div>
      `;
    }).join('');

    cardConfigs.forEach((config) => {
      if (typeof config.getBreakdown !== 'function') return;
      const card = document.getElementById(`kpi-${config.id}`);
      if (!card) return;
      const open = () => showBreakdown(config);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });

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
    lastAgg = aggregates;

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

  // ── Popup แยกที่มาของยอด (breakdown) — เปิดเมื่อกดการ์ดที่มี getBreakdown ──
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function showBreakdown(config) {
    if (!lastAgg || typeof config.getBreakdown !== 'function') return;
    const data = config.getBreakdown(lastAgg);

    const rowsHtml = data.rows.map(r => `
      <div class="kpi-bd__row kpi-bd__row--${r.tone || 'neutral'}">
        <span class="kpi-bd__dot"></span>
        <div class="kpi-bd__info">
          <span class="kpi-bd__label">${escHtml(r.label)}</span>
          ${r.hint ? `<span class="kpi-bd__hint">${escHtml(r.hint)}</span>` : ''}
        </div>
        <div class="kpi-bd__figures">
          <span class="kpi-bd__amount">${formatCurrency(r.amount)}</span>
          <span class="kpi-bd__count">จาก ${formatNumber(r.count)} รายการ</span>
        </div>
      </div>
    `).join('<div class="kpi-bd__plus">+</div>');

    const ov = document.createElement('div');
    ov.className = 'kpi-bd-overlay';
    ov.innerHTML = `
      <div class="kpi-bd" role="dialog" aria-modal="true" aria-label="${escHtml(data.title)}">
        <div class="kpi-bd__head">
          <h5>${escHtml(data.title)}</h5>
          <button class="kpi-bd__x" aria-label="ปิด">&times;</button>
        </div>
        <div class="kpi-bd__body">
          ${rowsHtml}
          <div class="kpi-bd__total">
            <span class="kpi-bd__total-label">ยอดปรับรวมทั้งหมด</span>
            <span class="kpi-bd__total-amount">${formatCurrency(data.total)}</span>
          </div>
        </div>
      </div>`;
    document.body.appendChild(ov);

    const close = () => { ov.classList.remove('is-show'); setTimeout(() => { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 180); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    ov.querySelector('.kpi-bd__x').addEventListener('click', close);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => ov.classList.add('is-show'));
  }

  return { render, update };
})();
