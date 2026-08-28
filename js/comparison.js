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

  // เหลือเฉพาะไอคอนที่หัวตารางในหน้านี้ใช้จริง — ไอคอนของการ์ด KPI ย้ายไปอยู่กับ
  // ชุดการ์ดกลางใน js/kpi.js แล้ว (หน้านี้เรียกผ่าน KPICards.renderScope)
  const ICONS = {
    file: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></svg>`,
    pie: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`
  };

  // ตัวชี้วัดที่กราฟ "แนวโน้มค่าปรับรายเดือน" สลับดูได้ทีละตัว (toggle) — ใช้สูตร/ฟิลด์
  // เดียวกับ monthlyData ใน getYearlyComparisonModel (js/data.js) ที่คำนวณตรงกับ
  // getAggregates ของโหมดปกติอยู่แล้ว ไม่มีการคำนวณใหม่ซ้ำในไฟล์นี้
  // ป้ายปุ่มใช้คำเดียวกับที่ตั้งไว้ในป๊อปอัปที่มาของยอด (kpi.js) เป๊ะ — totalPaid/
  // totalRemaining เป็นยอดฝั่ง "ค่าปรับอื่นๆ" เท่านั้น, installmentActive/Done เป็น
  // ฝั่ง "รถไม่เข้ารับงาน" เท่านั้น ต้องระบุที่มาให้ชัด ไม่งั้นชนกับป้าย "ค่าปรับ
  // ชำระแล้ว" ที่ใช้ทั้ง 2 ฝั่ง (totalFine/nonCollectible รวมทั้ง 2 แหล่งจึงไม่ต้อง
  // ระบุ ใช้คำว่า "ทั้งหมด" แทน)
  const TREND_METRICS = [
    {
      key: 'totalFine', label: 'ค่าปรับทั้งหมด', color: '#0071E3',
      getValue: (m) => m.totalFine, getCount: (m) => m.count,
      chartSubtitle: 'ค่าปรับทั้งหมดรายเดือน'
    },
    {
      key: 'totalPaid', label: 'ค่าปรับอื่นๆชำระแล้ว', color: '#34C759',
      getValue: (m) => m.totalPaid, getCount: (m) => m.paidCount,
      chartSubtitle: 'ค่าปรับอื่นๆชำระแล้วรายเดือน'
    },
    {
      key: 'totalRemaining', label: 'ค่าปรับรอชำระอื่นๆ', color: '#FF9500',
      getValue: (m) => m.totalRemaining, getCount: (m) => m.pendingCount,
      chartSubtitle: 'ค่าปรับรอชำระอื่นๆรายเดือน'
    },
    {
      key: 'installmentActive', label: 'ค่าปรับผ่อนชำระรถไม่เข้ารับงาน', color: '#5856D6',
      getValue: (m) => m.installment.totalRemainingAmount, getCount: (m) => m.installment.activeCases,
      chartSubtitle: 'ค่าปรับผ่อนชำระรถไม่เข้ารับงานรายเดือน'
    },
    {
      key: 'installmentDone', label: 'ค่าปรับรถไม่เข้ารับงานชำระแล้ว', color: '#00C7BE',
      getValue: (m) => m.installment.doneAmount, getCount: (m) => m.installment.doneCases,
      chartSubtitle: 'ค่าปรับรถไม่เข้ารับงานชำระแล้วรายเดือน'
    },
    {
      key: 'nonCollectible', label: 'ปรับไม่ได้ทั้งหมด', color: '#FF3B30',
      getValue: (m) => m.uncollectibleAmount + m.nonCollectibleDebt.totalAmount,
      getCount: (m) => m.uncollectibleCount + m.nonCollectibleDebt.totalCases,
      chartSubtitle: 'ยอดปรับไม่ได้ทั้งหมดรายเดือน'
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

  // โครงเดียวกับ #section-grand-summary + #section-kpi ใน index.html เป๊ะ (คลาสชุด
  // เดียวกันทุกตัว) ต่างแค่ id ของ container ที่เติม yearly- กันชนกับของโหมดรายเดือน
  // ที่ยังอยู่ใน DOM (แค่ถูกซ่อน) — ตัวการ์ดข้างในเรนเดอร์โดย KPICards.renderScope()
  // ด้วย config/สูตร/ป๊อปอัปที่มาของยอดชุดเดียวกับหน้าหลักทั้งหมด
  function renderYearlyKpiSections() {
    return `
      <section class="section" id="yearly-section-grand-summary">
        <div class="section__title">
          <svg width="18" height="18" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
            <path d="M180-120q-24.75 0-42.37-17.63Q120-155.25 120-180v-600q0-24.75 17.63-42.38Q155.25-840 180-840h600q24.75 0 42.38 17.62Q840-804.75 840-780v600q0 24.75-17.62 42.37Q804.75-120 780-120H180Zm0-60h600v-600H180v600Zm90-90h60v-300h-60v300Zm150 0h60v-420h-60v420Zm150 0h60v-180h-60v180Z"/>
          </svg>
          ยอดรวมค่าปรับทั้งหมด
        </div>
        <div class="kpi-grid kpi-grid--grand" id="yearly-kpi-grand-grid"></div>
      </section>

      <section class="section" id="yearly-section-kpi">
        <div class="section__title">
          <svg width="18" height="18" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
            <path d="M440-520v-280h440v280H440ZM80-160v-280h400v280H80Zm0-360v-280h280v280H80Zm440-80h280v-120H520v120ZM160-240h240v-120H160v120Zm0-360h120v-120H160v120Zm360 0ZM400-360ZM280-600ZM680-80l-12-60q-12-5-22.5-10.5T624-164l-58 18-40-68 46-40q-2-13-2-26t2-26l-46-40 40-68 58 18q11-8 21.5-13.5T668-420l12-60h80l12 60q12 5 22.5 10.5T816-396l58-18 40 68-46 40q2 13 2 26t-2 26l46 40-40 68-58-18q-11 8-21.5 13.5T772-140l-12 60h-80Zm96.5-143.5Q800-247 800-280t-23.5-56.5Q753-360 720-360t-56.5 23.5Q640-313 640-280t23.5 56.5Q687-200 720-200t56.5-23.5Z"/>
          </svg>
          สรุปภาพรวม
        </div>
        <div class="kpi-groups">
          <div class="kpi-panel kpi-panel--fine">
            <div class="kpi-panel__label">
              <svg class="kpi-panel__label-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm720 0v-120q0-44-24.5-84.5T666-434q51 6 96 20.5t84 35.5q36 20 55 44.5t19 53.5v120H760ZM247-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47Zm466 0q-47 47-113 47-11 0-28-2.5t-28-5.5q27-32 41.5-71t14.5-81q0-42-14.5-81T544-792q14-5 28-6.5t28-1.5q66 0 113 47t47 113q0 66-47 113ZM120-240h480v-32q0-11-5.5-20T580-306q-54-27-109-40.5T360-360q-56 0-111 13.5T140-306q-9 5-14.5 14t-5.5 20v32Zm296.5-343.5Q440-607 440-640t-23.5-56.5Q393-720 360-720t-56.5 23.5Q280-673 280-640t23.5 56.5Q327-560 360-560t56.5-23.5ZM360-240Zm0-400Z"/></svg>
              ค่าปรับอื่นๆ
            </div>
            <div class="kpi-panel__grid" id="yearly-kpi-grid-fine"></div>
          </div>
          <div class="kpi-panel kpi-panel--debt">
            <div class="kpi-panel__label">
              <svg class="kpi-panel__label-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm720 0v-120q0-44-24.5-84.5T666-434q51 6 96 20.5t84 35.5q36 20 55 44.5t19 53.5v120H760ZM247-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47Zm466 0q-47 47-113 47-11 0-28-2.5t-28-5.5q27-32 41.5-71t14.5-81q0-42-14.5-81T544-792q14-5 28-6.5t28-1.5q66 0 113 47t47 113q0 66-47 113ZM120-240h480v-32q0-11-5.5-20T580-306q-54-27-109-40.5T360-360q-56 0-111 13.5T140-306q-9 5-14.5 14t-5.5 20v32Zm296.5-343.5Q440-607 440-640t-23.5-56.5Q393-720 360-720t-56.5 23.5Q280-673 280-640t23.5 56.5Q327-560 360-560t56.5-23.5ZM360-240Zm0-400Z"/></svg>
              ค่าปรับรถไม่เข้ารับงาน
            </div>
            <div class="kpi-panel__grid" id="yearly-kpi-grid-debt"></div>
          </div>
        </div>
      </section>
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
      // ต้องใช้เวลาไทย (UTC+7) เหมือนทุกจุดที่ตัดสิน "เดือนปัจจุบัน" ในแอป —
      // new Date() ดิบอิงโซนเวลาเครื่องผู้ใช้ จึงไฮไลต์ผิดแถวช่วงคาบเกี่ยวสิ้นเดือน
      // เมื่อเปิดจากเครื่อง/เบราว์เซอร์ที่ตั้งโซนเวลาอื่น
      // FineData ประกาศด้วย const ระดับสคริปต์ จึงไม่ได้ถูกแขวนไว้บน window —
      // เช็ค window.FineData เดิมเป็น false เสมอ ทำให้ตกไปใช้ new Date() (โซนเวลา
      // เครื่องผู้ใช้) ทุกครั้ง ผิดเจตนาเดิมที่ต้องอิงเวลาไทยเหมือนทุกจุดในแอป
      const nowTh = (typeof FineData !== 'undefined' && FineData.nowInThailand) ? FineData.nowInThailand() : new Date();
      const isCurrentMonth = m.index === nowTh.getMonth() + 1;
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
              <th style="text-align:right">ค่าปรับ</th>
              <th style="text-align:right">ค่าปรับชำระแล้ว</th>
              <th style="text-align:right">ค่าปรับคงเหลือ</th>
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
              <th style="text-align:right;white-space:nowrap">ค่าปรับรวม</th>
              <th style="text-align:right;white-space:nowrap">ค่าปรับชำระแล้ว</th>
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

        ${renderYearlyKpiSections()}

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

        <div class="chart-card comparison-yearly-table-card">
          ${renderMonthlyTable(model)}
        </div>

        <!-- กราฟสัดส่วน + ตารางสัดส่วนตามลูกค้า มาจากข้อมูลชุดเดียวกัน (customerBreakdown)
             จึงวางคู่กันแบ่งฝั่งละ 50% แทนการวางเรียงเต็มความกว้างทีละการ์ด (เดิมการ์ด
             โดนัทกว้างเต็มจอทำให้มีพื้นที่ว่างเปล่ามหาศาลรอบๆ วงกลม/legend ที่มีขนาด
             เล็กกว่าการ์ดมาก) ดู .comparison-customer-row ใน css/comparison.css -->
        <div class="comparison-customer-row">
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
                  <strong id="yearly-customer-total">0</strong>
                  <span>ยอดรวมทั้งปี</span>
                </div>
              </div>
              <div class="comparison-customer-legend" id="yearly-customer-legend"></div>
            </div>
          </div>

          <div class="chart-card">
            ${renderCustomerYearlyTable(model)}
          </div>
        </div>
      </section>
    `;

    // การ์ด KPI รายปี — ใช้โมดูลเดียวกับหน้าหลัก (config/สูตร/ป๊อปอัปที่มาของยอด/
    // อนิเมชันนับเลข เหมือนกันทุกอย่าง) ต่างแค่ป้อน yearly.aggregates แทน aggregates
    // รายเดือน จึงไม่มีทางที่ดีไซน์ 2 โหมดจะหลุดจากกันเวลาแก้การ์ดในอนาคต
    if (typeof KPICards !== 'undefined' && yearly.aggregates) {
      KPICards.renderScope(
        { grand: 'yearly-kpi-grand-grid', fine: 'yearly-kpi-grid-fine', debt: 'yearly-kpi-grid-debt' },
        yearly.aggregates,
        'yearly-'
      );
    }

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

    const { customerBreakdown } = model;
    const entries = Object.entries(customerBreakdown)
      .filter(([, data]) => data.fineTotal > 0)
      .sort((a, b) => b[1].fineTotal - a[1].fineTotal);

    if (!entries.length) {
      canvas.hidden = true;
      return;
    }

    // ยอดรวมกลางวงกลม + % ต้องคำนวณจากผลรวมของ "ก้อนที่แสดงอยู่จริง" (customerBreakdown)
    // เท่านั้น — เดิมยอดกลางใช้ yearly.totalFine ซึ่งเป็นคนละสูตร (หัก uncollectible +
    // บวกยอดหนี้ พขร.) ทำให้ยอดกลางไม่เท่ากับผลรวมของก้อนพายที่มองเห็น และ % ที่โชว์ตอน
    // hover ก็ไม่รวมกันได้ 100% ข้าม customer — แก้ให้ยอดกลาง/tooltip/legend ใช้ total
    // เดียวกันทั้งหมด จึงบวกกันได้ 100% เสมอ และตรงกับตัวเลขที่ตารางด้านข้างแสดงเป๊ะ
    const total = entries.reduce((sum, [, data]) => sum + data.fineTotal, 0);
    const totalEl = document.getElementById('yearly-customer-total');
    if (totalEl) totalEl.textContent = formatCurrency(total);

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
                const pct = total > 0 ? ((context.raw / total) * 100).toFixed(1) : '0.0';
                return ` ${context.label}: ${formatCurrency(context.raw)} (${pct}%)`;
              }
            }
          }
        }
      }
    });

    const legendEl = document.getElementById('yearly-customer-legend');
    if (legendEl) {
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
