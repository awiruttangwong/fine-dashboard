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
    alertTriangle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    ban: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`
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

  function parseMetricValue(formattedValue) {
    const text = String(formattedValue ?? '').trim();
    if (!text) return { main: '0', suffix: '' };
    if (text.endsWith(' ฿')) return { main: text.slice(0, -2).trim(), suffix: '฿' };
    if (text.endsWith('%')) return { main: text.slice(0, -1).trim(), suffix: '%' };
    return { main: text, suffix: '' };
  }

  function buildMetricValueMarkup(formattedValue) {
    const { main, suffix } = parseMetricValue(formattedValue);
    return suffix
      ? `<span class="kpi-card__value-main">${main}</span><span class="kpi-card__value-suffix">${suffix}</span>`
      : `<span class="kpi-card__value-main">${main}</span>`;
  }

  // อัปเดตเฉพาะ "ค่าข้อความ" ในโครงสร้าง span เดิม (แก้ nodeValue ของ text node ตรงๆ)
  // ไม่แตะ childList เลย — เดิม setMetricValue เขียน element.innerHTML ใหม่ทุกเฟรมของ
  // count-up animation (~60fps × 6 การ์ด) ทำให้ <span> ถูกสร้าง/ทำลายทิ้งทุกเฟรม เป็น
  // ต้นเหตุการ "กระพริบ" ของการ์ด KPI. โครงสร้างจะถูกสร้างครั้งเดียว (จาก render template
  // หรือครั้งแรกที่ยังไม่มี/ต้องสลับมี-ไม่มี suffix) หลังจากนั้นทุกเฟรมแค่แก้ตัวเลข
  function setMetricValue(element, formattedValue) {
    if (!element) return;
    const { main, suffix } = parseMetricValue(formattedValue);
    const mainEl = element.querySelector('.kpi-card__value-main');
    const suffixEl = element.querySelector('.kpi-card__value-suffix');

    // โครงสร้างไม่ตรง (ครั้งแรก หรือสถานะมี/ไม่มี suffix เปลี่ยน) → สร้างใหม่ครั้งเดียว
    if (!mainEl || (suffix && !suffixEl) || (!suffix && suffixEl)) {
      element.innerHTML = buildMetricValueMarkup(formattedValue);
      return;
    }

    setTextInPlace_(mainEl, main);
    if (suffixEl) setTextInPlace_(suffixEl, suffix);
  }

  // แก้ค่าของ text node เดิมโดยไม่ add/remove node (characterData mutation ล้วน ไม่ใช่
  // childList) — ป้องกันการกระพริบและลดงาน DOM ระหว่าง animation ให้เหลือน้อยที่สุด
  function setTextInPlace_(el, value) {
    if (el.firstChild && el.firstChild.nodeType === 3) {
      if (el.firstChild.nodeValue !== value) el.firstChild.nodeValue = value;
    } else if (el.textContent !== value) {
      el.textContent = value;
    }
  }

  function animateValue(element, start, end, duration, formatter) {
    // ยกเลิก animation ก่อนหน้าบน element เดียวกันก่อนเสมอ — เดิมไม่ยกเลิก ทำให้เวลา
    // เปลี่ยน filter ถี่ๆ (หรือ update ทับระหว่าง animation แรกยังไม่จบ) มีหลาย RAF loop
    // วิ่งพร้อมกันบนการ์ดเดียว เขียนค่าแย่งกัน = กระพริบ/ตัวเลขกระตุกหนักขึ้น
    if (element.__kpiRaf) cancelAnimationFrame(element.__kpiRaf);
    const startTime = performance.now();
    const diff = end - start;

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setMetricValue(element, formatter(Math.round(current * 10) / 10));
      if (progress < 1) {
        element.__kpiRaf = requestAnimationFrame(step);
      } else {
        element.__kpiRaf = null;
      }
    }
    element.__kpiRaf = requestAnimationFrame(step);
  }

  const cardConfigs = [
    {
      // "ยอดรวมค่าปรับอื่นๆ" = เฉพาะฝั่งค่าปรับอื่นๆเท่านั้น (ไม่รวมรถไม่เข้ารับงาน)
      // แต่รวม "ปรับไม่ได้" กลับเข้ามาแล้ว (agg.totalFine ดิบ = ปรับได้+รอปรับ+ปรับไม่ได้
      // ครบทุกสถานะ) — กดการ์ดดูที่มาแยก 3 สถานะได้ผ่าน getBreakdown
      id: 'total-fine',
      label: 'ค่าปรับทั้งหมด',
      icon: ICONS.money,
      iconClass: 'kpi-card__icon--red',
      getValue: (agg) => agg.totalFine,
      format: formatCurrency,
      getDetail: (agg) => `จาก ${formatNumber(agg.count)} รายการ`,
      getBreakdown: (agg) => {
        const paidAmount = agg.statusBreakdown.paidAmount || 0;
        const paidCount = agg.statusBreakdown.paidCount || 0;
        const pendingAmount = agg.statusBreakdown.pendingAmount || 0;
        const pendingCount = agg.statusBreakdown.pendingCount || 0;
        const uncollectibleAmount = agg.statusBreakdown.uncollectibleAmount || 0;
        const uncollectibleCount = agg.statusBreakdown.uncollectibleCount || 0;
        return {
          title: 'ที่มาของค่าปรับทั้งหมด',
          totalLabel: 'ยอดค่าปรับทั้งหมด',
          rows: [
            { label: 'ค่าปรับชำระแล้ว', amount: paidAmount, count: paidCount, tone: 'blue' },
            { label: 'ค่าปรับรอชำระ', amount: pendingAmount, count: pendingCount, tone: 'blue' },
            { label: 'ปรับไม่ได้', amount: uncollectibleAmount, count: uncollectibleCount, tone: 'red' }
          ],
          total: paidAmount + pendingAmount + uncollectibleAmount
        };
      }
    },
    {
      id: 'paid-amount',
      label: 'ค่าปรับชำระแล้ว',
      icon: ICONS.checkCircle,
      iconClass: 'kpi-card__icon--green',
      getValue: (agg) => agg.paidCompletedAmount,
      format: formatCurrency,
      getDetail: (agg) => {
        const paidCount = (agg.statusBreakdown && agg.statusBreakdown.paidCount) || 0;
        return paidCount > 0 ? `${paidCount} รายการที่ปรับได้` : 'ไม่มีรายการชำระ';
      }
    },
    {
      id: 'remaining-amount',
      label: 'ค่าปรับรอชำระ',
      icon: ICONS.clock,
      iconClass: 'kpi-card__icon--orange',
      getValue: (agg) => agg.totalRemaining,
      format: formatCurrency,
      getDetail: (agg) => {
        const pendingCount = (agg.statusBreakdown && agg.statusBreakdown.pendingCount) || 0;
        const errorCount = agg.paymentStatusCounts['data_error'] || 0;
        const parts = [];
        if (pendingCount > 0) parts.push(`${pendingCount} รายการรอปรับ`);
        if (errorCount > 0) parts.push(`${errorCount} รายการต้องตรวจสอบ`);
        return parts.join(' • ') || 'ไม่มีรายการที่รอปรับ';
      }
    },
    {
      // แยกออกมาเป็นการ์ดของตัวเองในกลุ่ม "ค่าปรับอื่นๆ" — เดิมยอดนี้ถูกรวมเข้ากับ
      // "ปรับไม่ได้" ฝั่งรถไม่เข้ารับงานเป็นการ์ดเดียว (ดูการ์ด non-collectible ด้านล่าง
      // ซึ่งตอนนี้เหลือเฉพาะฝั่งรถไม่เข้ารับงานแล้ว) เพื่อให้แต่ละกลุ่มเห็นยอดปรับไม่ได้
      // ของตัวเองชัดเจน ไม่ต้องกดดู breakdown ถึงจะรู้สัดส่วน
      id: 'non-collectible-fine',
      label: 'ปรับไม่ได้',
      icon: ICONS.ban,
      iconClass: 'kpi-card__icon--red',
      getValue: (agg) => agg.statusBreakdown.uncollectibleAmount || 0,
      format: formatCurrency,
      getDetail: (agg) => {
        const count = agg.statusBreakdown.uncollectibleCount || 0;
        return count > 0 ? `${formatNumber(count)} รายการ` : 'ไม่มีรายการปรับไม่ได้';
      }
    },
    {
      // "ยอดรวมค่าปรับรถไม่เข้ารับงาน" — สมมาตรกับการ์ด "ยอดรวมค่าปรับอื่นๆ" ในกลุ่มบน:
      // รวมทั้ง 3 สถานะในกลุ่มนี้ (กำลังผ่อนชำระ + ชำระแล้ว + ปรับไม่ได้) getValue รวม
      // จาก field เดียวกับที่ใช้ใน getBreakdown ตรงๆ การันตีว่าป๊อปอัปรวมได้เท่ากับ
      // ตัวเลขบนการ์ดเป๊ะๆ เสมอ
      id: 'debt-total',
      label: 'ค่าปรับทั้งหมด',
      icon: ICONS.money,
      iconClass: 'kpi-card__icon--red',
      getValue: (agg) => agg.installment.totalRemainingAmount + agg.installment.doneAmount + (agg.nonCollectibleDebt.totalAmount || 0),
      format: formatCurrency,
      getDetail: (agg) => {
        const count = (agg.installment.activeCases || 0) + (agg.installment.doneCases || 0) + (agg.nonCollectibleDebt.totalCases || 0);
        return `จาก ${formatNumber(count)} รายการ`;
      },
      getBreakdown: (agg) => {
        const activeAmount = agg.installment.totalRemainingAmount;
        const activeCount = agg.installment.activeCases || 0;
        const doneAmount = agg.installment.doneAmount;
        const doneCount = agg.installment.doneCases || 0;
        const uncollectibleAmount = agg.nonCollectibleDebt.totalAmount || 0;
        const uncollectibleCount = agg.nonCollectibleDebt.totalCases || 0;
        return {
          title: 'ที่มาของค่าปรับทั้งหมด',
          totalLabel: 'ยอดค่าปรับทั้งหมด',
          rows: [
            { label: 'ค่าปรับผ่อนชำระ', amount: activeAmount, count: activeCount, tone: 'blue' },
            { label: 'ค่าปรับชำระแล้ว', amount: doneAmount, count: doneCount, tone: 'blue' },
            { label: 'ปรับไม่ได้', amount: uncollectibleAmount, count: uncollectibleCount, tone: 'red' }
          ],
          total: activeAmount + doneAmount + uncollectibleAmount
        };
      }
    },
    {
      // สลับมาไว้ลำดับที่ 2 ต่อจาก "ยอดรวมค่าปรับรถไม่เข้ารับงาน" ตามที่ผู้ใช้ขอ — สี
      // เปลี่ยนจาก mint เป็น green ให้ตรงกับการ์ด "ชำระค่าปรับอื่นๆแล้ว" (paid-amount)
      // เพราะทั้งคู่สื่อความหมายเดียวกัน (ชำระ/ปิดยอดแล้ว)
      id: 'installment-done',
      label: 'ค่าปรับชำระแล้ว',
      icon: ICONS.checkCircle,
      iconClass: 'kpi-card__icon--green',
      getValue: (agg) => agg.installment.doneAmount,
      format: formatCurrency,
      getDetail: (agg) => {
        const { doneCases } = agg.installment;
        return doneCases > 0 ? `${formatNumber(doneCases)} รายการ` : 'ไม่มีรายการชำระ';
      }
    },
    {
      // เดิมเป็นการ์ดเดียว "ผ่อนชำระ" ที่รวม 2 สถานะ (กำลังผ่อน/เสร็จแล้ว) ไว้ในบรรทัด
      // detail เดียวกัน — พอมีทั้งคู่พร้อมกัน ข้อความยาวจนล้นออกนอกกล่อง (วัดจริงแล้ว
      // scrollWidth > clientWidth ที่ 1400px) จึงแยกเป็น 2 การ์ดคนละตัวเลขหลักไปเลย
      // แทนที่จะพยายามยัดทั้ง 2 สถานะไว้ในบรรทัดเดียว
      id: 'installment-active',
      label: 'ค่าปรับผ่อนชำระ',
      icon: ICONS.clock,
      iconClass: 'kpi-card__icon--orange',
      getValue: (agg) => agg.installment.totalRemainingAmount,
      format: formatCurrency,
      getDetail: (agg) => {
        const { activeCases } = agg.installment;
        return activeCases > 0 ? `${formatNumber(activeCases)} รายการ` : 'ไม่มีรายการที่กำลังผ่อน';
      }
    },
    {
      // เดิมการ์ดนี้รวมยอดปรับไม่ได้ทั้ง 2 แหล่ง (ค่าปรับอื่นๆ + รถไม่เข้ารับงาน) เข้า
      // ด้วยกัน — ตอนนี้ฝั่งค่าปรับอื่นๆ แยกไปเป็นการ์ด non-collectible-fine ของตัวเอง
      // ในกลุ่มด้านบนแล้ว การ์ดนี้จึงเหลือเฉพาะยอดปรับไม่ได้ของหนี้ พขร. (รถไม่เข้ารับงาน)
      id: 'non-collectible',
      label: 'ปรับไม่ได้',
      icon: ICONS.ban,
      iconClass: 'kpi-card__icon--red',
      getValue: (agg) => agg.nonCollectibleDebt.totalAmount || 0,
      format: formatCurrency,
      getDetail: (agg) => {
        const count = agg.nonCollectibleDebt.totalCases || 0;
        return count > 0 ? `${formatNumber(count)} รายการ` : 'ไม่มีรายการปรับไม่ได้';
      }
    }
  ];

  // ── การ์ดสรุปยอดใหญ่ (เหนือ "สรุปภาพรวม") — รวม 2 แหล่งแบบ "เต็มจำนวน" ไม่หักลบ
  // อะไรออก ต่างจากการ์ด "ยอดปรับรวม"/"ยอดคงเหลือ" ด้านล่างที่หัก "ปรับไม่ได้" ออก
  // เพื่อให้เห็นยอดที่เก็บได้จริง — การ์ดชุดนี้ตอบคำถาม "ยอดทั้งหมดในระบบมีเท่าไหร่"
  // และ "เก็บมาแล้วเท่าไหร่" แบบไม่แยกว่าเก็บได้จริงหรือไม่
  // getValue ของ grand-total/grand-paid แยกเป็นฟังก์ชันตั้งชื่อไว้ เพื่อให้การ์ด
  // "ค่าปรับคงเหลือทั้งหมด" คำนวณจากสูตรเดียวกันเป๊ะๆ (ผลต่างของอีก 2 การ์ด) แทนที่จะ
  // คัดลอก logic มาเขียนซ้ำ ป้องกันตัวเลข 3 การ์ดเพี้ยนไม่ตรงกันถ้า logic เปลี่ยนในอนาคต
  const grandTotalValue = (agg) => {
    const fineRaw = agg.totalFine;
    const debtRaw = (agg.debtGrandTotal ? agg.debtGrandTotal.amount + agg.debtGrandTotal.deducted : 0);
    return fineRaw + debtRaw;
  };
  const grandPaidValue = (agg) => agg.paidCompletedAmount + agg.installment.doneAmount;

  const grandConfigs = [
    {
      id: 'grand-total',
      label: 'ค่าปรับทั้งหมด',
      icon: ICONS.money,
      iconClass: 'kpi-card__icon--red',
      getValue: grandTotalValue,
      format: formatCurrency,
      getDetail: (agg) => {
        const debtCount = (agg.debtGrandTotal && agg.debtGrandTotal.count) || 0;
        return `จาก ${formatNumber(agg.count + debtCount)} รายการ`;
      },
      getBreakdown: (agg) => {
        const fineRaw = agg.totalFine;
        const uncollectibleAmount = agg.statusBreakdown.uncollectibleAmount || 0;
        const uncollectibleCount = agg.statusBreakdown.uncollectibleCount || 0;
        const paidAmount = agg.statusBreakdown.paidAmount || 0;
        const paidCount = agg.statusBreakdown.paidCount || 0;
        const pendingAmount = agg.statusBreakdown.pendingAmount || 0;
        const pendingCount = agg.statusBreakdown.pendingCount || 0;

        const debtGrand = agg.debtGrandTotal || {};
        const debtCount = debtGrand.count || 0;
        const debtDeducted = debtGrand.deducted || 0;
        const debtNet = debtGrand.amount || 0;
        const debtRaw = debtNet + debtDeducted;

        return {
          title: 'ที่มาของค่าปรับทั้งหมด',
          rows: [
            {
              label: 'ค่าปรับอื่นๆ', amount: fineRaw, count: agg.count, tone: 'red',
              subRows: [
                { label: 'ค่าปรับชำระแล้ว', amount: paidAmount, count: paidCount },
                { label: 'ค่าปรับรอชำระ', amount: pendingAmount, count: pendingCount },
                { label: 'ปรับไม่ได้', amount: uncollectibleAmount, count: uncollectibleCount }
              ]
            },
            {
              label: 'ค่าปรับรถไม่เข้ารับงาน', amount: debtRaw, count: debtCount, tone: 'blue',
              // ใช้ตัวเลขชุดเดียวกับการ์ด "ชำระค่าปรับรถไม่เข้ารับงานแล้ว"/"กำลังผ่อนชำระ
              // รถไม่เข้ารับงาน" (agg.installment) ตรงๆ แทนที่จะคำนวณแยกชุดใหม่ — กันไม่ให้
              // ตัวเลขใน popup นี้เพี้ยนไปจากการ์ดจริงถ้า logic การคำนวณเปลี่ยนในอนาคต
              subRows: [
                { label: 'ค่าปรับรถไม่เข้ารับงานชำระแล้ว', amount: agg.installment.doneAmount, count: agg.installment.doneCases },
                { label: 'ค่าปรับผ่อนชำระรถไม่เข้ารับงาน', amount: agg.installment.totalRemainingAmount, count: agg.installment.activeCases },
                { label: 'ปรับไม่ได้', amount: debtDeducted, count: agg.nonCollectibleDebt.totalCases || 0 }
              ]
            }
          ],
          total: fineRaw + debtRaw
        };
      }
    },
    {
      id: 'grand-paid',
      label: 'ค่าปรับชำระแล้ว',
      icon: ICONS.checkCircle,
      iconClass: 'kpi-card__icon--green',
      getValue: grandPaidValue,
      format: formatCurrency,
      getDetail: (agg) => {
        const paidCount = (agg.statusBreakdown && agg.statusBreakdown.paidCount) || 0;
        const doneCount = agg.installment.doneCases || 0;
        return `จาก ${formatNumber(paidCount + doneCount)} รายการ`;
      },
      getBreakdown: (agg) => {
        const paidAmount = agg.paidCompletedAmount;
        const paidCount = (agg.statusBreakdown && agg.statusBreakdown.paidCount) || 0;
        const doneAmount = agg.installment.doneAmount;
        const doneCount = agg.installment.doneCases || 0;
        return {
          title: 'ที่มาของยอดค่าปรับชำระแล้ว',
          totalLabel: 'ยอดค่าปรับชำระแล้วทั้งหมด',
          rows: [
            { label: 'ค่าปรับอื่นๆชำระแล้ว', hint: 'จากสถานะ "ปรับได้"', amount: paidAmount, count: paidCount, tone: 'blue' },
            { label: 'ค่าปรับรถไม่เข้ารับงานชำระแล้ว', hint: 'จากรายการค่าปรับชำระแล้ว (ไม่รวมรายการค่าปรับผ่อนชำระ)', amount: doneAmount, count: doneCount, tone: 'red' }
          ],
          total: paidAmount + doneAmount
        };
      }
    },
    {
      // ยอดคงเหลือระดับภาพรวม = รอปรับ (ค่าปรับอื่นๆ) + กำลังผ่อนชำระ (รถไม่เข้ารับงาน)
      // เท่านั้น — เฉพาะยอดที่ยังมีลุ้นเก็บได้จริง "ปรับไม่ได้" ทั้ง 2 แหล่งถูกแยกออกไป
      // อยู่การ์ด "ปรับไม่ได้ทั้งหมด" (grand-uncollectible) ต่างหากแล้ว จึงไม่นับซ้ำที่นี่
      // getValue รวมจาก 2 field ตรงๆ (ไม่ใช้ grandTotal-grandPaid) เพราะฝั่งรถไม่เข้า
      // รับงานมีรายการที่ผ่อนจ่ายบางส่วนแล้ว — total-paid จะขาดหักยอดที่จ่ายบางส่วนนั้น
      // ออกไป ทำให้ตัวเลขเพี้ยนสูงกว่าความเป็นจริง
      id: 'grand-remaining',
      label: 'ค่าปรับคงเหลือ',
      icon: ICONS.clock,
      iconClass: 'kpi-card__icon--orange',
      getValue: (agg) => {
        const pendingAmount = (agg.statusBreakdown && agg.statusBreakdown.pendingAmount) || 0;
        return pendingAmount + agg.installment.totalRemainingAmount;
      },
      format: formatCurrency,
      getDetail: (agg) => {
        const pendingCount = (agg.statusBreakdown && agg.statusBreakdown.pendingCount) || 0;
        const activeCases = agg.installment.activeCases || 0;
        return `จาก ${formatNumber(pendingCount + activeCases)} รายการ`;
      },
      getBreakdown: (agg) => {
        const pendingAmount = (agg.statusBreakdown && agg.statusBreakdown.pendingAmount) || 0;
        const pendingCount = (agg.statusBreakdown && agg.statusBreakdown.pendingCount) || 0;
        const installmentAmount = agg.installment.totalRemainingAmount;
        const installmentCount = agg.installment.activeCases || 0;

        return {
          title: 'ที่มาของยอดคงเหลือ',
          totalLabel: 'ยอดค่าปรับคงเหลือทั้งหมด',
          rows: [
            { label: 'ค่าปรับรอชำระอื่นๆ', amount: pendingAmount, count: pendingCount, tone: 'orange' },
            { label: 'ค่าปรับผ่อนชำระรถไม่เข้ารับงาน', amount: installmentAmount, count: installmentCount, tone: 'orange' }
          ],
          total: pendingAmount + installmentAmount
        };
      }
    },
    {
      // การ์ดแยกเฉพาะยอด "ปรับไม่ได้" ทั้งระบบ — ตัวเลขนี้ถูกนับรวมอยู่ใน
      // "ค่าปรับคงเหลือทั้งหมด" อยู่แล้ว (ดูคอมเมนต์ grand-remaining ด้านบน) การ์ดนี้
      // แค่ดึงออกมาโชว์แยกให้เห็นชัดว่าปรับไม่ได้มีเท่าไหร่ ไม่ใช่การหักลบหรือคำนวณใหม่
      id: 'grand-uncollectible',
      label: 'ปรับไม่ได้',
      icon: ICONS.ban,
      iconClass: 'kpi-card__icon--red',
      getValue: (agg) => {
        const fineUncollectible = (agg.statusBreakdown && agg.statusBreakdown.uncollectibleAmount) || 0;
        const debtUncollectible = (agg.debtGrandTotal && agg.debtGrandTotal.deducted) || 0;
        return fineUncollectible + debtUncollectible;
      },
      format: formatCurrency,
      getDetail: (agg) => {
        const fineCount = (agg.statusBreakdown && agg.statusBreakdown.uncollectibleCount) || 0;
        const debtCount = (agg.nonCollectibleDebt && agg.nonCollectibleDebt.totalCases) || 0;
        return `จาก ${formatNumber(fineCount + debtCount)} รายการ`;
      },
      getBreakdown: (agg) => {
        const fineAmount = (agg.statusBreakdown && agg.statusBreakdown.uncollectibleAmount) || 0;
        const fineCount = (agg.statusBreakdown && agg.statusBreakdown.uncollectibleCount) || 0;
        const debtAmount = (agg.debtGrandTotal && agg.debtGrandTotal.deducted) || 0;
        const debtCount = (agg.nonCollectibleDebt && agg.nonCollectibleDebt.totalCases) || 0;

        return {
          title: 'ที่มาของยอดปรับไม่ได้ทั้งหมด',
          totalLabel: 'ยอดปรับไม่ได้รวมทั้งหมด',
          rows: [
            { label: 'ค่าปรับอื่นๆที่ปรับไม่ได้', amount: fineAmount, count: fineCount, tone: 'red' },
            { label: 'ค่าปรับรถไม่เข้ารับงานที่ปรับไม่ได้', amount: debtAmount, count: debtCount, tone: 'red' }
          ],
          total: fineAmount + debtAmount
        };
      }
    }
  ];

  // idPrefix ให้เรนเดอร์การ์ดชุดเดียวกันได้มากกว่า 1 ที่ในหน้าเดียว (โหมดปกติ = ราย
  // เดือน, โหมด "ภาพรวม" = รายปี) โดย id ไม่ชนกัน — สไตล์ผูกกับ data-kpi ไม่ใช่ id
  // (css/components.css) การ์ดทั้ง 2 ชุดจึงหน้าตาเหมือนกันเป๊ะโดยไม่ต้องก๊อป CSS
  function renderGrid(containerId, configs, aggregates, idPrefix = '') {
    const el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML = configs.map(config => {
      const value = config.getValue(aggregates);
      const clickable = typeof config.getBreakdown === 'function';
      return `
        <div class="kpi-tile${clickable ? ' kpi-tile--clickable' : ''}" id="kpi-${idPrefix}${config.id}" data-kpi="${config.id}"${clickable ? ' role="button" tabindex="0" aria-haspopup="dialog" title="ดูที่มาของยอด"' : ''}>
          <div class="kpi-tile__eyebrow">
            <div class="kpi-card__icon ${config.iconClass}">${config.icon}</div>
            <span class="kpi-card__label">${config.label}</span>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__content">
              <div class="kpi-card__value" data-value="${value}">${buildMetricValueMarkup(config.format(0))}</div>
              <div class="kpi-card__detail">${config.getDetail(aggregates)}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    configs.forEach((config) => {
      const card = document.getElementById(`kpi-${idPrefix}${config.id}`);
      if (!card) return;
      // เก็บ aggregates ของรอบเรนเดอร์นี้ไว้เป็น property บน element โดยตรง (ไม่ใช่ผูก
      // เข้ากับ closure ตรงๆ) เพราะตัวแปร filter ทุกตัวหลังโหลดหน้าแรก (เปลี่ยนเดือน/
      // ลูกค้า/สถานะ ฯลฯ) วิ่งผ่าน KPICards.update() → updateGrid() ไม่ใช่ renderGrid()
      // เดิม handler ผูก aggregates ของตอนโหลดหน้าแรกไว้เฉยๆ ไม่เคยอัปเดต ทำให้กด
      // popup ทีหลังเห็นตัวเลขเก่าค้าง ไม่ตรงกับตัวเลขบนการ์ดที่ update() รีเฟรชแล้ว —
      // updateGrid ด้านล่างเขียนทับ property นี้ทุกครั้ง ส่วน handler อ่านค่าสดจาก
      // การ์ดตอนคลิก จึงตรงกับตัวเลขบนจอเสมอ ไม่ว่าจะกดตอนไหน
      card.__kpiAggregates = aggregates;
      if (typeof config.getBreakdown !== 'function') return;
      const open = () => showBreakdown(config, card.__kpiAggregates);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });

    requestAnimationFrame(() => {
      el.querySelectorAll('.kpi-card__value').forEach((valueEl, idx) => {
        const target = parseFloat(valueEl.dataset.value);
        const config = configs[idx];
        animateValue(valueEl, 0, target, 800, config.format);
      });
    });
  }

  function updateGrid(configs, aggregates, idPrefix = '') {
    configs.forEach((config) => {
      const card = document.getElementById(`kpi-${idPrefix}${config.id}`);
      if (!card) return;

      // รีเฟรชอ้างอิงที่ click handler อ่านตอนเปิด popup breakdown — กันไม่ให้ popup
      // ค้างข้อมูลรอบ render แรก (ดูคอมเมนต์ยาวใน renderGrid)
      card.__kpiAggregates = aggregates;

      const valueEl = card.querySelector('.kpi-card__value');
      const detailEl = card.querySelector('.kpi-card__detail');
      const newValue = config.getValue(aggregates);
      const oldValue = parseFloat(valueEl.dataset.value) || 0;

      valueEl.dataset.value = newValue;
      detailEl.textContent = config.getDetail(aggregates);

      animateValue(valueEl, oldValue, newValue, 500, config.format);
    });
  }

  function render(aggregates) {
    if (!container) container = document.getElementById('kpi-grid');
    if (!container) return;
    lastAgg = aggregates;

    renderScope({ grand: 'kpi-grand-grid', fine: 'kpi-grid-fine', debt: 'kpi-grid-debt' }, aggregates);
  }

  // เรนเดอร์การ์ดชุดเดียวกัน (config/สูตร/ดีไซน์ชุดเดียวกันทั้งหมด) ลง container ใดก็ได้
  // ใช้โดยโหมด "ภาพรวม" (รายปี) ที่ต้องการหน้าตาเหมือนโหมดรายเดือนเป๊ะ ต่างแค่ที่มา
  // ของตัวเลข (yearly aggregates) — ไม่มีการคัดลอก config/มาร์กอัปไปเขียนซ้ำที่อื่น
  function renderScope(targets, aggregates, idPrefix = '') {
    renderGrid(targets.grand, grandConfigs, aggregates, idPrefix);
    // คนละกลุ่มข้อมูล ("ค่าปรับอื่นๆ" vs "ค่าปรับรถไม่เข้ารับงาน") จึงแยกเรนเดอร์คนละ
    // panel — ลำดับใน cardConfigs คงเดิม แค่แบ่งเป็น 2 container ตาม index
    renderGrid(targets.fine, cardConfigs.slice(0, 4), aggregates, idPrefix);
    renderGrid(targets.debt, cardConfigs.slice(4), aggregates, idPrefix);
  }

  function update(aggregates) {
    if (!container) container = document.getElementById('kpi-grid');
    if (!container) return;
    lastAgg = aggregates;

    updateGrid(grandConfigs, aggregates);
    updateGrid(cardConfigs, aggregates);
  }

  // ── Popup แยกที่มาของยอด (breakdown) — เปิดเมื่อกดการ์ดที่มี getBreakdown ──
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function showBreakdown(config, aggregates) {
    const agg = aggregates || lastAgg;
    if (!agg || typeof config.getBreakdown !== 'function') return;
    const data = config.getBreakdown(agg);

    const rowsHtml = data.rows.map(r => `
      <div class="kpi-bd__row kpi-bd__row--${r.tone || 'neutral'}">
        <span class="kpi-bd__dot"></span>
        <div class="kpi-bd__info">
          <span class="kpi-bd__label">${escHtml(r.label)}</span>
          ${r.hint ? `<span class="kpi-bd__hint">${escHtml(r.hint)}</span>` : ''}
          ${r.subRows && r.subRows.length ? `
            <div class="kpi-bd__sub">
              ${r.subRows.map(s => `<span class="kpi-bd__sub-item">${escHtml(s.label)} ${formatCurrency(s.amount)} · ${formatNumber(s.count)} รายการ</span>`).join('')}
            </div>
          ` : ''}
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
            <span class="kpi-bd__total-label">${escHtml(data.totalLabel || 'ยอดปรับรวมทั้งหมด')}</span>
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

  return { render, update, renderScope };
})();
