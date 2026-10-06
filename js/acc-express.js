/* ============================================================
   เปรียบเทียบค่าปรับ Acc Vs Express — แสดงผลใน dashboard หลัก
   (ต่อท้าย "สัดส่วนตามลูกค้า" ในแท็บภาพรวมแผนกบัญชี)

   ต่างจากโมดูลเดี่ยว xlsx-comparison/ ตรงที่ "ไม่อ่านไฟล์ .xlsx" แล้ว —
   อ่านจากคลังกลาง (แท็บ AccExpressData) ผ่าน action=acc_express_data
   ซึ่งเป็นข้อมูลที่หน้า xlsx-comparison อัพโหลดขึ้นไปเก็บไว้ ผู้ใช้จึงเห็น
   ข้อมูลได้ทันทีโดยไม่ต้องเลือกไฟล์ทุกครั้ง (ข้อมูลเปลี่ยนเดือนละครั้ง)

   ตรรกะการ render (โครงหัวตาราง/สี/การ scale ให้พอดีจอ) พอร์ตมาจาก
   xlsx-comparison/js/app.js ที่ตรวจสอบความถูกต้องกับไฟล์ต้นฉบับแล้ว 100%
   ต่างกันแค่แหล่งข้อมูล: cell error (#REF!) ถูก resolve เป็นข้อความมาแล้ว
   ตั้งแต่ตอนอัพโหลด และ hyperlink มาเป็น map { "B25": url } แทนการอ่าน
   จาก raw worksheet object
   ============================================================ */
const AccExpress = (() => {
  const cfg = window.FINE_DASHBOARD_CONFIG || {};
  const ENDPOINT = cfg.gasEndpoint || '';
  const TIMEOUT = cfg.requestTimeoutMs || 35000;

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_THAI = { Jan: 'มกราคม', Feb: 'กุมภาพันธ์', Mar: 'มีนาคม', Apr: 'เมษายน', May: 'พฤษภาคม', Jun: 'มิถุนายน', Jul: 'กรกฎาคม', Aug: 'สิงหาคม', Sep: 'กันยายน', Oct: 'ตุลาคม', Nov: 'พฤศจิกายน', Dec: 'ธันวาคม' };

  const ICONS = {
    money: `<svg width="22" height="22" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M200-200v-560 560Zm0 80q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v100h-80v-100H200v560h560v-100h80v100q0 33-23.5 56.5T760-120H200Zm320-160q-33 0-56.5-23.5T440-360v-240q0-33 23.5-56.5T520-680h280q33 0 56.5 23.5T880-600v240q0 33-23.5 56.5T800-280H520Zm280-80v-240H520v240h280Zm-117.5-77.5Q700-455 700-480t-17.5-42.5Q665-540 640-540t-42.5 17.5Q580-505 580-480t17.5 42.5Q615-420 640-420t42.5-17.5Z"/></svg>`,
    checkCircle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    ban: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
    alertTriangle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  };
  const TONE = {
    blue: { icon: 'kpi-card__icon--blue', accent: '#0071E3' },
    green: { icon: 'kpi-card__icon--green', accent: '#34C759' },
    red: { icon: 'kpi-card__icon--red', accent: '#FF3B30' },
    orange: { icon: 'kpi-card__icon--orange', accent: '#FF9500' },
    purple: { icon: 'kpi-card__icon--purple', accent: '#AF52DE' }
  };

  // แคชข้อมูลไว้ทั้ง session — comparison view ถูก re-render ทุกครั้งที่เปลี่ยนตัวกรอง
  // ถ้าไม่แคชจะยิง endpoint ซ้ำทุกครั้งโดยไม่จำเป็น (ข้อมูลชุดนี้ไม่ขึ้นกับตัวกรองเลย)
  let cache = null;      // { sheets: {name: {aoa, links}}, updated_at: {...} }
  let inFlight = null;
  let uploading = false;   // กำลังอัพโหลดอยู่ (กันกดซ้อน + คงสถานะปุ่มข้าม re-render)
  let uploadStatus = '';   // ข้อความสถานะอัพโหลดล่าสุด (HTML) คงไว้ข้าม re-render
  let cmpRegistry = {};    // ข้อมูลเต็มของการ์ดเทียบแต่ละใบ (id → detail) ใช้เปิด popup
  let sheetOrder = [];
  let currentSheetName = null;
  let rootEl = null;     // container ของ section นี้ในหน้า dashboard

  // ── transport (JSONP เหมือน debt.js/data.js ของ dashboard หลัก) ──
  function jsonp(params) {
    return new Promise((resolve, reject) => {
      if (!ENDPOINT) return reject(new Error('ยังไม่ได้ตั้งค่า gasEndpoint'));
      const cb = 'accExpCb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const url = new URL(ENDPOINT);
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) url.searchParams.set(k, v); });
      url.searchParams.set('callback', cb);
      url.searchParams.set('ts', Date.now());
      const s = document.createElement('script');
      const t = setTimeout(() => { cleanup(); reject(new Error('หมดเวลารอ Apps Script')); }, TIMEOUT);
      function cleanup() { clearTimeout(t); delete window[cb]; if (s.parentNode) s.parentNode.removeChild(s); }
      window[cb] = (d) => { cleanup(); resolve(d); };
      s.onerror = () => { cleanup(); reject(new Error('เรียก endpoint ไม่สำเร็จ')); };
      s.src = url.toString();
      document.head.appendChild(s);
    });
  }

  // ── Helpers (พอร์ตจาก xlsx-comparison/js/app.js) ──
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ข้อมูลจากคลังกลาง resolve cell error มาให้แล้วตั้งแต่ตอนอัพโหลด (buildResolvedAoa_)
  // จึงอ่านจาก AOA ตรงๆ ได้เลย ไม่ต้อง fallback ไป raw worksheet เหมือนโมดูลเดี่ยว
  function cell(aoa, r, c) {
    const row = aoa[r];
    const v = row ? (row[c] === undefined ? null : row[c]) : null;
    return v === undefined ? null : v;
  }

  // แปลง (row, col) เป็น address แบบ Excel ("B25") เพื่อค้น links map ที่เก็บมาตอนอัพโหลด
  function encodeCell(r, c) {
    let col = '';
    let n = c;
    do { col = String.fromCharCode(65 + (n % 26)) + col; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return col + (r + 1);
  }

  function linkTextHtml(sheet, aoa, r, c) {
    const v = cell(aoa, r, c);
    if (v === null || v === undefined || v === '') return '';
    const url = sheet.links ? sheet.links[encodeCell(r, c)] : null;
    if (url) return `<a class="acc-link" href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(v)}</a>`;
    return escHtml(v);
  }

  function isNum(v) { return typeof v === 'number' && !Number.isNaN(v); }
  function fmtNum(v) {
    if (!isNum(v)) return '';
    return v.toLocaleString('th-TH', { maximumFractionDigits: 0 });
  }
  function numCellHtml(v, extraClass) {
    if (v === null || v === undefined || v === '') return `<td class="${extraClass || ''}"></td>`;
    const neg = isNum(v) && v < 0;
    return `<td class="${extraClass || ''}${neg ? ' acc-cell--negative' : ''}">${isNum(v) ? fmtNum(v) : escHtml(v)}</td>`;
  }
  function numOrErrText(v) {
    if (isNum(v)) return fmtNum(v);
    return v === null || v === undefined ? '' : escHtml(v);
  }

  function kpiTile({ label, value, tone, icon, detail }) {
    const t = TONE[tone] || TONE.blue;
    const neg = isNum(value) && value < 0;
    return `
      <div class="kpi-tile" data-tone="${tone}">
        <div class="kpi-tile__eyebrow">
          <div class="kpi-card__icon ${t.icon}">${icon}</div>
          <span class="kpi-card__label">${escHtml(label)}</span>
        </div>
        <div class="kpi-card" style="--kpi-accent:${t.accent}">
          <div class="kpi-card__content">
            <div class="kpi-card__value"${neg ? ' style="color:#FF3B30"' : ''}>
              <span class="kpi-card__value-main">${isNum(value) ? fmtNum(value) : '—'}</span>
              <span class="kpi-card__value-suffix">฿</span>
            </div>
            <div class="kpi-card__detail">${escHtml(detail || '')}</div>
          </div>
        </div>
      </div>
    `;
  }

  function kpiPanel(labelText, cards) {
    return `
      <div class="kpi-panel kpi-panel--fine">
        <div class="kpi-panel__label">${escHtml(labelText)}</div>
        <div class="kpi-panel__grid">${cards.join('')}</div>
      </div>
    `;
  }

  function emptyCard(msg) {
    return `<div class="acc-card"><div class="acc-card__body"><div class="acc-empty">${escHtml(msg)}</div></div></div>`;
  }

  // ── Summary sheet ──
  function renderSummaryCard(sheet) {
    const aoa = sheet.aoa;

    const headerRowIdx = 2;
    const blocks = [];
    for (let c = 1; c < (aoa[headerRowIdx] || []).length; c++) {
      const v = cell(aoa, headerRowIdx, c);
      if (v !== null && v !== '') blocks.push({ label: String(v), col: c });
    }
    if (!blocks.length) return emptyCard('ไม่พบโครงสร้างหัวตารางในชีต Summary');

    const custStart = 5;
    const custRows = [];
    let r = custStart;
    while (cell(aoa, r, 0) !== null && cell(aoa, r, 0) !== '') { custRows.push(r); r++; }
    const totalRowIdx = r;

    const bandClass = (blockIdx) => blockIdx === 0 ? 'acc-band-0' : (blockIdx % 2 === 1 ? 'acc-band-b' : 'acc-band-c');

    let thead = `<tr><th rowspan="3" class="acc-cell--label">${escHtml(cell(aoa, headerRowIdx, 0) || 'รายการ')}</th>`;
    blocks.forEach((b, i) => { thead += `<th colspan="3" class="${bandClass(i)}">${escHtml(b.label)}</th>`; });
    thead += '</tr><tr>';
    blocks.forEach((b, i) => {
      for (let off = 0; off < 3; off++) thead += `<th class="${bandClass(i)}">${escHtml(cell(aoa, 3, b.col + off) ?? '')}</th>`;
    });
    thead += '</tr><tr>';
    blocks.forEach((b, i) => {
      for (let off = 0; off < 3; off++) thead += `<th class="${bandClass(i)}">${escHtml(cell(aoa, 4, b.col + off) ?? '')}</th>`;
    });
    thead += '</tr>';

    let tbody = '';
    custRows.forEach((cr) => {
      tbody += `<tr><td class="acc-cell--label acc-cell--customer-name">${escHtml(cell(aoa, cr, 0))}</td>`;
      blocks.forEach((b, i) => {
        for (let off = 0; off < 3; off++) tbody += numCellHtml(cell(aoa, cr, b.col + off), bandClass(i));
      });
      tbody += '</tr>';
    });

    if (cell(aoa, totalRowIdx, 1) !== null) {
      tbody += `<tr class="acc-row--total"><td class="acc-cell--label">รวม</td>`;
      blocks.forEach((b, i) => {
        for (let off = 0; off < 3; off++) tbody += numCellHtml(cell(aoa, totalRowIdx, b.col + off), bandClass(i));
      });
      tbody += '</tr>';
    }

    const y2026Label = blocks[0] ? blocks[0].label : 'รวมทั้งปี';
    // หัว KPI แสดงเป็น "(2026)" ไม่ใช่ "(Y2026)" — ตัดตัว "Y" นำหน้าออกเฉพาะจุดแสดงผล
    // นี้เท่านั้น หัวตารางด้านล่าง (แถบสี Y2026) ยังคงข้อความเดิมจากต้นฉบับไม่แตะ
    const y2026HeadingLabel = y2026Label.replace(/^Y(?=\d)/, '');
    const y2026Col = blocks[0] ? blocks[0].col : 1;
    const colLabel = (off) => [cell(aoa, 3, y2026Col + off), cell(aoa, 4, y2026Col + off)]
      .filter((x) => x !== null && x !== '').join(' ').replace(/\s+/g, ' ').trim();

    const kpiSection = `
      <div class="acc-kpi-scope acc-kpi-section">
        <div class="acc-kpi-section__title">
          <svg width="18" height="18" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M180-120q-24.75 0-42.37-17.63Q120-155.25 120-180v-600q0-24.75 17.63-42.38Q155.25-840 180-840h600q24.75 0 42.38 17.62Q840-804.75 840-780v600q0 24.75-17.62 42.37Q804.75-120 780-120H180Zm0-60h600v-600H180v600Zm90-90h60v-300h-60v300Zm150 0h60v-420h-60v420Zm150 0h60v-180h-60v180Z"/></svg>
          สรุปยอดรวมทั้งปี (${escHtml(y2026HeadingLabel)})
        </div>
        <div class="kpi-grid kpi-grid--grand">
          ${kpiTile({ label: colLabel(0), value: cell(aoa, totalRowIdx, y2026Col), tone: 'blue', icon: ICONS.money, detail: 'ยอดที่ลูกค้าแจ้งปรับทั้งปี' })}
          ${kpiTile({ label: colLabel(1), value: cell(aoa, totalRowIdx, y2026Col + 1), tone: 'green', icon: ICONS.checkCircle, detail: 'ยอดที่บัญชีเรียกเก็บได้จริง' })}
          ${kpiTile({ label: colLabel(2), value: cell(aoa, totalRowIdx, y2026Col + 2), tone: 'red', icon: ICONS.ban, detail: 'ส่วนต่างที่เรียกเก็บไม่ได้' })}
        </div>
      </div>
    `;

    return `
      <div class="acc-card">
        <div class="acc-card__body">
          ${kpiSection}
          <div class="acc-fit-wrap">
            <table class="acc-xls-table acc-xls-table--fit">
              <thead>${thead}</thead>
              <tbody>${tbody}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function findReconBlock(aoa, fromRow, prefix) {
    for (let r = fromRow; r < aoa.length; r++) {
      const v = cell(aoa, r, 0);
      if (typeof v === 'string' && v.indexOf(prefix) === 0) return { startRow: r, endRow: r + 2 };
    }
    return null;
  }

  function reconBlockHtml(aoa, block) {
    let rows = '';
    for (let r = block.startRow; r <= block.endRow; r++) {
      const label = cell(aoa, r, 0);
      const val = cell(aoa, r, 1);
      if (label === null) continue;
      const neg = isNum(val) && val < 0;
      rows += `<tr><td>${escHtml(label)}</td><td class="${neg ? 'acc-cell--negative' : ''}">${isNum(val) ? fmtNum(val) : escHtml(val)}</td></tr>`;
    }
    return `<div class="acc-recon__block"><table>${rows}</table></div>`;
  }

  // ── Month sheet ──
  // ── เทียบไฟล์ Acc Vs Express (เดือนนี้) กับข้อมูลในระบบเดือนเดียวกัน ──
  // จับคู่ตามที่ตกลงกับผู้ใช้:
  //   ค่าปรับอื่นๆ      : Express (แจ้งให้ปรับ) ↔ SUM(Mx)      | Acc (ปรับได้จริง) ↔ ปรับได้(Mx)
  //   รถไม่เข้ารับงาน  : Express ↔ Drivers(Mx) ยอดรวม           | Acc ↔ Drivers(Mx) ยอดชำระแล้ว
  // "ค่าปรับอื่นๆ" ฝั่งไฟล์ = แถว "รวม" ลบแถว "ค่าปรับรถไม่เข้ารับงาน" — ระบบแยกรถไม่เข้ารับ
  // งานไว้ที่ Drivers(Mx) อยู่แล้ว J&T จึงเทียบได้เองโดยไม่ต้องกรณีพิเศษ (SUM ไม่มี J&T แล้ว
  // เพราะซ้ำกับ Drivers) ข้อมูลระบบใช้ payload ชุดเดียวกับ dashboard หลัก (FineData) ซึ่งตัด
  // J&T/เคลมพัสดุ ไปแล้วฝั่ง backend และจัดเดือนตามชื่อชีต (source_sheet_month)
  const custKey = (v) => String(v == null ? '' : v).toUpperCase().replace(/\s+/g, '');

  function systemMonthData(monthNum) {
    const payload = (typeof FineData !== 'undefined' && FineData.getLastPayload) ? FineData.getLastPayload() : null;
    if (!payload) return null;
    const byCust = {};
    const get = (k) => (byCust[k] = byCust[k] || { sum: 0, sumRows: [], paid: 0, paidRows: [], drvTotal: 0, drvPaid: 0, drvRows: [] });
    // สถานะของแถว SUM หาจากชีตสถานะ (คีย์เดียวกับ js/data.js: บาร์โค้ด|วันที่|ยอด|เส้นทาง)
    const statusOf = {};
    Object.entries(payload.status_rows || {}).forEach(([type, rows]) => {
      (rows || []).forEach((r) => { statusOf[[r.barcode, r.fine_date, r.fine_amount, r.route_raw].join('|')] = type; });
    });
    (payload.rows || []).forEach((row) => {
      if (Number(row.source_sheet_month) !== monthNum) return;
      const c = get(custKey(row.customer));
      c.sum += row.fine_amount || 0;
      c.sumRows.push(Object.assign({}, row, { _status: statusOf[[row.barcode, row.fine_date, row.fine_amount, row.route_raw].join('|')] || 'ยังไม่จัดสถานะ' }));
    });
    ((payload.status_rows || {})['ปรับได้'] || []).forEach((row) => {
      if (Number(row.source_sheet_month) !== monthNum) return;
      const c = get(custKey(row.customer));
      c.paid += row.fine_amount || 0;
      c.paidRows.push(row);
    });
    (payload.debt_rows || []).forEach((row) => {
      if (String(row.month_label || '').toUpperCase() !== 'M' + monthNum) return;
      const c = get(custKey(row.customer));
      c.drvTotal += row.total || 0;
      c.drvPaid += row.paid || 0;
      c.drvRows.push(row);
    });
    return byCust;
  }

  // แถวเทียบ 1 บรรทัดในการ์ด: ชื่อ | ไฟล์ | ระบบ | ส่วนต่าง
  function cmpRowHtml(topic, fileLabel, fileVal, sysLabel, sysVal) {
    const diff = sysVal - fileVal;
    const ok = Math.round(diff) === 0;
    return `
      <div class="acc-cmp-row${ok ? '' : ' is-diff'}">
        <div class="acc-cmp-row__topic">${escHtml(topic)}</div>
        <div class="acc-cmp-row__pair">
          <div class="acc-cmp-row__item"><span>${escHtml(fileLabel)}</span><b>${fmtNum(fileVal) || '0'}</b></div>
          <div class="acc-cmp-row__item"><span>${escHtml(sysLabel)}</span><b>${fmtNum(sysVal) || '0'}</b></div>
        </div>
        <div class="acc-cmp-row__diff">${ok ? '✓ ตรงกัน' : `ส่วนต่าง ${diff > 0 ? '+' : ''}${fmtNum(diff)}`}</div>
      </div>`;
  }

  // การ์ดลูกค้า 1 ใบ: หัว (ชื่อ + ป้ายสถานะ) → แถวเทียบ → รายการในระบบ (กดเปิด)
  function cmpCardHtml(label, rows, listHtml, listCount, isTotal, detail) {
    const hasDiff = rows.some((r) => Math.round(r.sysVal - r.fileVal) !== 0);
    const id = 'cmp' + Object.keys(cmpRegistry).length;
    cmpRegistry[id] = Object.assign({ label, rows, hasDiff }, detail || {});
    return `
      <div class="acc-cmp-card${hasDiff ? ' is-diff' : ''}${isTotal ? ' is-total' : ''}" data-cmp-id="${id}" role="button" tabindex="0" title="คลิกเพื่อดูรายละเอียด">
        <div class="acc-cmp-card__head">
          <span class="acc-cmp-card__name">${escHtml(label)}</span>
          <span class="acc-cmp-badge ${hasDiff ? 'is-diff' : 'is-ok'}">${hasDiff ? 'มีส่วนต่าง' : 'ตรงกัน'}</span>
        </div>
        ${rows.map((r) => cmpRowHtml(r.topic, r.fileLabel, r.fileVal, r.sysLabel, r.sysVal)).join('')}
        <div class="acc-cmp-card__more">ดูรายละเอียดทั้งหมด${listCount ? ` · ระบบ ${listCount} รายการ` : ''} →</div>
      </div>`;
  }

  function systemReconHtml(name, aoa, groups, catRows, subtotalRowIdx) {
    const monthNum = MONTH_NAMES.indexOf(name) + 1;
    if (!monthNum) return '';
    const sys = systemMonthData(monthNum);
    if (!sys) {
      return `<div class="acc-section-title">เทียบกับข้อมูลในระบบ (M${monthNum})</div>
        <div class="acc-embed-state acc-embed-state--muted">ข้อมูลระบบยังโหลดไม่เสร็จ — เปิดแท็บนี้ใหม่อีกครั้งหลัง dashboard โหลดเสร็จ</div>`;
    }

    const num = (v) => (isNum(v) ? v : 0);
    const empty = { sum: 0, sumRows: [], paid: 0, paidRows: [], drvTotal: 0, drvPaid: 0, drvRows: [] };
    const driverRow = catRows.find((r) => String(cell(aoa, r, 0) || '').indexOf('รถไม่เข้ารับงาน') !== -1);
    const t = { fe: 0, fs: 0, fa: 0, fp: 0, de: 0, dt: 0, da: 0, dp: 0 };
    const fineCards = [];
    const drvCards = [];
    cmpRegistry = {};
    const allFineRows = [];
    const allDrvRows = [];
    const allFineCats = [];
    // แถวประเภทค่าปรับจากไฟล์ของลูกค้า 1 ราย (ไม่รวมแถวรถไม่เข้ารับงาน = ค่าปรับอื่นๆ)
    const fileCatsOf = (g, onlyDriver) => catRows
      .filter((r) => (r === driverRow) === onlyDriver)
      .map((r) => ({
        label: String(cell(aoa, r, 0) || ''),
        cust: num(cell(aoa, r, g.col)), exp: num(cell(aoa, r, g.col + 1)),
        acc: num(cell(aoa, r, g.col + 2)), unc: num(cell(aoa, r, g.col + 3))
      }));

    groups.forEach((g) => {
      const s = sys[custKey(g.label)] || empty;
      const drvExp = driverRow !== undefined ? num(cell(aoa, driverRow, g.col + 1)) : 0;
      const drvAcc = driverRow !== undefined ? num(cell(aoa, driverRow, g.col + 2)) : 0;
      const fineExp = num(cell(aoa, subtotalRowIdx, g.col + 1)) - drvExp;
      const fineAcc = num(cell(aoa, subtotalRowIdx, g.col + 2)) - drvAcc;
      t.fe += fineExp; t.fs += s.sum; t.fa += fineAcc; t.fp += s.paid;
      t.de += drvExp; t.dt += s.drvTotal; t.da += drvAcc; t.dp += s.drvPaid;

      const paidKeys = new Set(s.paidRows.map((r) => [r.barcode, r.fine_date, r.fine_amount].join('|')));
      const fineList = s.sumRows.length ? `<table class="acc-ledger">
          <thead><tr><th>วันที่</th><th>บาร์โค้ด</th><th>พขร.</th><th>ยอด</th><th>ปรับได้</th></tr></thead>
          <tbody>${s.sumRows.map((r) => `<tr><td>${escHtml(r.fine_date_raw || r.fine_date || '')}</td><td>${escHtml(r.barcode || '')}</td><td>${escHtml(r.driver_name || '')}</td><td class="num">${fmtNum(r.fine_amount)}</td><td>${paidKeys.has([r.barcode, r.fine_date, r.fine_amount].join('|')) ? '✓' : ''}</td></tr>`).join('')}</tbody>
        </table>` : '';
      const drvList = s.drvRows.length ? `<table class="acc-ledger">
          <thead><tr><th>วันที่เริ่ม</th><th>เส้นทาง</th><th>สถานะ</th><th>ยอดรวม</th><th>ชำระแล้ว</th></tr></thead>
          <tbody>${s.drvRows.map((r) => `<tr><td>${escHtml(r.start_date || '')}</td><td>${escHtml(r.route || '')}</td><td>${escHtml(r.status || '')}${r.collectible ? ' · ' + escHtml(r.collectible) : ''}</td><td class="num">${fmtNum(r.total)}</td><td class="num">${fmtNum(r.paid)}</td></tr>`).join('')}</tbody>
        </table>` : '';

      const fineCats = fileCatsOf(g, false);
      const drvCats = fileCatsOf(g, true);
      s.sumRows.forEach((r) => allFineRows.push(r));
      s.drvRows.forEach((r) => allDrvRows.push(r));
      fineCats.forEach((c) => allFineCats.push(Object.assign({ customer: g.label }, c)));

      fineCards.push(cmpCardHtml(g.label, [
        { topic: 'ยอดแจ้งปรับ', fileLabel: 'Acc Vs Express (ไฟล์)', fileVal: fineExp, sysLabel: 'ระบบ', sysVal: s.sum },
        { topic: 'ยอดปรับได้จริง', fileLabel: 'Acc Vs Express (ไฟล์)', fileVal: fineAcc, sysLabel: 'ระบบ', sysVal: s.paid }
      ], fineList, s.sumRows.length, false, { kind: 'fine', monthNum, fileCats: fineCats, sysRows: s.sumRows }));
      drvCards.push(cmpCardHtml(g.label, [
        { topic: 'ยอดแจ้งปรับ', fileLabel: 'Acc Vs Express (ไฟล์)', fileVal: drvExp, sysLabel: 'ระบบ', sysVal: s.drvTotal },
        { topic: 'ยอดปรับได้จริง', fileLabel: 'Acc Vs Express (ไฟล์)', fileVal: drvAcc, sysLabel: 'ระบบ', sysVal: s.drvPaid }
      ], drvList, s.drvRows.length, false, { kind: 'drv', monthNum, fileCats: drvCats, drvRows: s.drvRows }));
    });

    const fineTotal = cmpCardHtml('รวมทุกลูกค้า', [
      { topic: 'ยอดแจ้งปรับ', fileLabel: 'Acc Vs Express (ไฟล์)', fileVal: t.fe, sysLabel: 'ระบบ', sysVal: t.fs },
      { topic: 'ยอดปรับได้จริง', fileLabel: 'Acc Vs Express (ไฟล์)', fileVal: t.fa, sysLabel: 'ระบบ', sysVal: t.fp }
    ], '', allFineRows.length, true, { kind: 'fine', monthNum, isTotal: true, fileCats: allFineCats, sysRows: allFineRows });
    const drvTotal = cmpCardHtml('รวมทุกลูกค้า', [
      { topic: 'ยอดแจ้งปรับ', fileLabel: 'Acc Vs Express (ไฟล์)', fileVal: t.de, sysLabel: 'ระบบ', sysVal: t.dt },
      { topic: 'ยอดปรับได้จริง', fileLabel: 'Acc Vs Express (ไฟล์)', fileVal: t.da, sysLabel: 'ระบบ', sysVal: t.dp }
    ], '', allDrvRows.length, true, { kind: 'drv', monthNum, isTotal: true, fileCats: [], drvRows: allDrvRows });

    // ลูกค้าที่มีในระบบแต่ไม่มีคอลัมน์ในไฟล์ — แจ้งให้เห็น ไม่ปล่อยหายเงียบ
    const fileKeys = new Set(groups.map((g) => custKey(g.label)));
    const extra = Object.keys(sys).filter((k) => !fileKeys.has(k) && (sys[k].sum || sys[k].drvTotal));

    return `
      <div class="acc-cmp-section">
        <div class="acc-section-title">เทียบกับข้อมูลในระบบ · ค่าปรับอื่นๆ (M${monthNum})</div>
        <div class="acc-section-note">Acc Vs Express (ไฟล์) = แถว "รวม" หักแถวรถไม่เข้ารับงาน · ระบบ = SUM / ปรับได้ ของเดือน M${monthNum} · ส่วนต่าง = ระบบ − ไฟล์</div>
        <div class="acc-cmp-grid">${fineTotal}${fineCards.join('')}</div>
      </div>
      <div class="acc-cmp-section">
        <div class="acc-section-title">เทียบกับข้อมูลในระบบ · ค่าปรับรถไม่เข้ารับงาน (M${monthNum})</div>
        <div class="acc-section-note">Acc Vs Express (ไฟล์) = แถว "ค่าปรับรถไม่เข้ารับงาน" · ระบบ = Drivers(M${monthNum}) ยอดรวม / ยอดชำระแล้ว</div>
        <div class="acc-cmp-grid">${drvTotal}${drvCards.join('')}</div>
      </div>
      ${extra.length ? `<div class="acc-section-note acc-diff--bad">ลูกค้าในระบบที่ไม่มีคอลัมน์ในไฟล์: ${extra.map(escHtml).join(', ')}</div>` : ''}
    `;
  }

  // ══ Popup รายละเอียดการเทียบของการ์ด 1 ใบ ══
  const STATUS_ORDER = ['ปรับได้', 'รอปรับ', 'ปรับไม่ได้', 'ยังไม่จัดสถานะ'];
  const STATUS_TONE = { 'ปรับได้': 'ok', 'รอปรับ': 'wait', 'ปรับไม่ได้': 'bad', 'ยังไม่จัดสถานะ': 'none' };

  // แท่งเทียบ ไฟล์ vs ระบบ (ความยาวตามสัดส่วนของค่าที่มากกว่า) ให้เห็นภาพส่วนต่างทันที
  function cmpBarsHtml(r) {
    const max = Math.max(Math.abs(r.fileVal), Math.abs(r.sysVal), 1);
    const diff = r.sysVal - r.fileVal;
    const ok = Math.round(diff) === 0;
    const pct = (v) => Math.max(1.5, Math.abs(v) / max * 100);
    const topic = r.topic;
    const line = (label, val, cls) => `
      <div class="acc-pop-line">
        <div class="acc-pop-line__head">
          <span class="acc-pop-line__dot ${cls}"></span>
          <span class="acc-pop-line__label">${escHtml(label)}</span>
          <b class="acc-pop-line__val">${fmtNum(val) || '0'}</b>
        </div>
        <div class="acc-pop-line__track"><div class="acc-pop-line__fill ${cls}" style="width:${pct(val)}%"></div></div>
      </div>`;
    return `
      <div class="acc-pop-cmp${ok ? '' : ' is-diff'}">
        <div class="acc-pop-cmp__head">
          <span class="acc-pop-cmp__title">${escHtml(topic)}</span>
          <span class="acc-pop-cmp__status">${ok ? 'ตรงกัน' : 'ไม่ตรงกัน'}</span>
        </div>
        ${line(r.fileLabel, r.fileVal, 'is-file')}
        ${line(r.sysLabel, r.sysVal, 'is-sys')}
        <div class="acc-pop-cmp__foot">
          <span>ส่วนต่าง (ระบบ − ไฟล์)</span>
          <b>${ok ? '0' : `${diff > 0 ? '+' : ''}${fmtNum(diff)}`}</b>
        </div>
      </div>`;
  }

  function fileCatsTableHtml(d) {
    const cats = (d.fileCats || []).filter((c) => c.cust || c.exp || c.acc || c.unc);
    if (!cats.length) return '<div class="acc-pop-empty">ไฟล์ไม่มียอดในหมวดนี้</div>';
    const sum = (k) => cats.reduce((a, c) => a + c[k], 0);
    return `
      <table class="acc-ledger acc-pop-table">
        <thead><tr>${d.isTotal ? '<th>ลูกค้า</th>' : ''}<th>ประเภทค่าปรับ</th><th>Customer (ลูกค้าปรับ)</th><th>Express (แจ้งให้ปรับ)</th><th>Acc. (ปรับได้จริง)</th><th>Tatal ปรับไม่ได้</th></tr></thead>
        <tbody>
          ${cats.map((c) => `<tr>${d.isTotal ? `<td>${escHtml(c.customer)}</td>` : ''}<td>${escHtml(c.label)}</td><td class="num">${fmtNum(c.cust)}</td><td class="num">${fmtNum(c.exp)}</td><td class="num">${fmtNum(c.acc)}</td><td class="num${c.unc < 0 ? ' acc-cell--negative' : ''}">${fmtNum(c.unc)}</td></tr>`).join('')}
          <tr class="acc-ledger__subtotal"><td colspan="${d.isTotal ? 2 : 1}">รวม</td><td class="num">${fmtNum(sum('cust'))}</td><td class="num">${fmtNum(sum('exp'))}</td><td class="num">${fmtNum(sum('acc'))}</td><td class="num">${fmtNum(sum('unc'))}</td></tr>
        </tbody>
      </table>`;
  }

  function sysFineHtml(d) {
    const rows = d.sysRows || [];
    if (!rows.length) return '<div class="acc-pop-empty">ไม่มีรายการในระบบ (SUM) เดือนนี้</div>';
    const groups = {};
    rows.forEach((r) => { (groups[r._status] = groups[r._status] || []).push(r); });
    const chips = STATUS_ORDER.filter((k) => groups[k]).map((k) => {
      const amt = groups[k].reduce((a, r) => a + (r.fine_amount || 0), 0);
      return `<div class="acc-pop-chip is-${STATUS_TONE[k]}"><span>${escHtml(k)}</span><b>${fmtNum(amt)}</b><small>${groups[k].length} รายการ</small></div>`;
    }).join('');
    // ปรับได้ที่นับจากแถว SUM อาจไม่เท่ากับยอดชีต ปรับได้(Mx) (ที่ใช้บนการ์ด) เมื่อมีแถวซ้ำ —
    // แจ้งให้เห็นแทนการซ่อน จะได้ตามไปตรวจแถวซ้ำได้
    const paidFromSum = (groups['ปรับได้'] || []).reduce((a, r) => a + (r.fine_amount || 0), 0);
    const paidSheet = d.rows[1] ? d.rows[1].sysVal : paidFromSum;
    const paidNote = Math.round(paidFromSum - paidSheet) !== 0
      ? `<div class="acc-pop-warn">แถว SUM ที่จับคู่เป็น "ปรับได้" รวม ${fmtNum(paidFromSum)} แต่ชีต ปรับได้(M${d.monthNum}) รวม ${fmtNum(paidSheet)} (ต่าง ${fmtNum(paidFromSum - paidSheet)}) — น่าจะมีแถวซ้ำ (บาร์โค้ด/วันที่/ยอด/เส้นทางเดียวกัน) ใน SUM</div>`
      : '';
    const sorted = rows.slice().sort((a, b) => STATUS_ORDER.indexOf(a._status) - STATUS_ORDER.indexOf(b._status) || String(a.fine_date || '').localeCompare(String(b.fine_date || '')));
    return `
      <div class="acc-pop-chips">${chips}</div>
      ${paidNote}
      <div class="acc-ledger-wrap acc-pop-scroll">
        <table class="acc-ledger acc-pop-table">
          <thead><tr><th>#</th>${d.isTotal ? '<th>ลูกค้า</th>' : ''}<th>สถานะ</th><th>วันที่</th><th>บาร์โค้ด</th><th>เส้นทาง</th><th>พขร.</th><th>ผู้รับโอน</th><th>ยอดปรับ</th></tr></thead>
          <tbody>${sorted.map((r, i) => `<tr>
            <td>${i + 1}</td>${d.isTotal ? `<td>${escHtml(r.customer || '')}</td>` : ''}
            <td><span class="acc-pop-status is-${STATUS_TONE[r._status]}">${escHtml(r._status)}</span></td>
            <td>${escHtml(r.fine_date_raw || r.fine_date || '')}</td><td>${escHtml(r.barcode || '')}</td>
            <td>${escHtml(r.route_raw || '')}</td><td>${escHtml(r.driver_name || '')}</td><td>${escHtml(r.transfer_receiver_name || '')}</td>
            <td class="num">${fmtNum(r.fine_amount)}</td></tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  function sysDrvHtml(d) {
    const rows = d.drvRows || [];
    if (!rows.length) return '<div class="acc-pop-empty">ไม่มีรายการใน Drivers เดือนนี้</div>';
    const tot = rows.reduce((a, r) => a + (r.total || 0), 0);
    const paid = rows.reduce((a, r) => a + (r.paid || 0), 0);
    const bal = rows.reduce((a, r) => a + (r.balance || 0), 0);
    return `
      <div class="acc-pop-chips">
        <div class="acc-pop-chip is-none"><span>ยอดรวม</span><b>${fmtNum(tot)}</b><small>${rows.length} รายการ</small></div>
        <div class="acc-pop-chip is-ok"><span>ชำระแล้ว</span><b>${fmtNum(paid)}</b></div>
        <div class="acc-pop-chip is-wait"><span>คงเหลือ</span><b>${fmtNum(bal)}</b></div>
      </div>
      <div class="acc-ledger-wrap acc-pop-scroll">
        <table class="acc-ledger acc-pop-table">
          <thead><tr><th>#</th>${d.isTotal ? '<th>ลูกค้า</th>' : ''}<th>วันที่เริ่ม</th><th>เส้นทาง</th><th>สถานะ</th><th>การปรับ</th><th>ยอดรวม</th><th>ชำระแล้ว</th><th>คงเหลือ</th></tr></thead>
          <tbody>${rows.map((r, i) => `<tr>
            <td>${i + 1}</td>${d.isTotal ? `<td>${escHtml(r.customer || '')}</td>` : ''}
            <td>${escHtml(r.start_date || '')}</td><td>${escHtml(r.route || '')}</td><td>${escHtml(r.status || '')}</td>
            <td>${escHtml(r.collectible || '')}</td><td class="num">${fmtNum(r.total)}</td><td class="num">${fmtNum(r.paid)}</td><td class="num">${fmtNum(r.balance)}</td></tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  function openCmpPopup(id) {
    const d = cmpRegistry[id];
    if (!d) return;
    closeCmpPopup();
    const kindLabel = d.kind === 'drv' ? 'ค่าปรับรถไม่เข้ารับงาน' : 'ค่าปรับอื่นๆ';
    const listCount = (d.kind === 'drv' ? d.drvRows : d.sysRows || []).length;
    const ov = document.createElement('div');
    ov.className = 'acc-pop-overlay';
    ov.innerHTML = `
      <div class="acc-pop" role="dialog" aria-modal="true">
        <div class="acc-pop__head">
          <div>
            <div class="acc-pop__eyebrow">${escHtml(kindLabel)} · M${d.monthNum}</div>
            <div class="acc-pop__title">${escHtml(d.label)}
              <span class="acc-cmp-badge ${d.hasDiff ? 'is-diff' : 'is-ok'}">${d.hasDiff ? 'มีส่วนต่าง' : 'ตรงกัน'}</span>
            </div>
          </div>
          <button type="button" class="acc-pop__x" aria-label="ปิด">×</button>
        </div>
        <div class="acc-pop__tabs" role="tablist">
          <button type="button" class="acc-pop__tab is-active" data-pop-tab="0" role="tab">สรุปการเทียบ</button>
          <button type="button" class="acc-pop__tab" data-pop-tab="1" role="tab">Acc Vs Express (ไฟล์)</button>
          <button type="button" class="acc-pop__tab" data-pop-tab="2" role="tab">ระบบ${listCount ? ` <span class="acc-pop__tab-count">${listCount}</span>` : ''}</button>
        </div>
        <div class="acc-pop__body">
          <section class="acc-pop__panel" data-pop-panel="0">
            <div class="acc-pop-cmps">${d.rows.map(cmpBarsHtml).join('')}</div>
          </section>
          <section class="acc-pop__panel" data-pop-panel="1" hidden>
            <div class="acc-pop__panel-note">Acc Vs Express (ไฟล์) แยกตามประเภทค่าปรับ${d.kind === 'drv' ? ' (แถวค่าปรับรถไม่เข้ารับงาน)' : ' (ไม่รวมแถวค่าปรับรถไม่เข้ารับงาน)'}</div>
            ${fileCatsTableHtml(d)}
          </section>
          <section class="acc-pop__panel" data-pop-panel="2" hidden>
            <div class="acc-pop__panel-note">รายการจาก ${d.kind === 'drv' ? `Drivers(M${d.monthNum})` : `SUM(M${d.monthNum})`} ในระบบ</div>
            ${d.kind === 'drv' ? sysDrvHtml(d) : sysFineHtml(d)}
          </section>
        </div>
      </div>`;
    document.body.appendChild(ov);
    document.body.classList.add('acc-pop-open');
    ov.addEventListener('click', (e) => {
      if (e.target === ov || e.target.closest('.acc-pop__x')) { closeCmpPopup(); return; }
      const tab = e.target.closest('.acc-pop__tab');
      if (!tab) return;
      ov.querySelectorAll('.acc-pop__tab').forEach((t) => t.classList.toggle('is-active', t === tab));
      ov.querySelectorAll('.acc-pop__panel').forEach((pn) => { pn.hidden = pn.dataset.popPanel !== tab.dataset.popTab; });
    });
  }

  function closeCmpPopup() {
    document.querySelectorAll('.acc-pop-overlay').forEach((el) => el.remove());
    document.body.classList.remove('acc-pop-open');
  }

  // คลิก/Enter ที่การ์ดเทียบใดๆ → เปิด popup (delegate ครั้งเดียวทั้งหน้า ไม่ผูกซ้ำทุก render)
  document.addEventListener('click', (e) => {
    const card = e.target.closest && e.target.closest('.acc-cmp-card[data-cmp-id]');
    if (card) openCmpPopup(card.dataset.cmpId);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeCmpPopup(); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest && e.target.closest('.acc-cmp-card[data-cmp-id]');
      if (card) { e.preventDefault(); openCmpPopup(card.dataset.cmpId); }
    }
  });

  function renderMonthCard(name, sheet) {
    const aoa = sheet.aoa;
    const headerRowIdx = 0;
    const groups = [];
    for (let c = 1; c < (aoa[headerRowIdx] || []).length; c++) {
      const v = cell(aoa, headerRowIdx, c);
      if (v !== null && v !== '') groups.push({ label: String(v), col: c });
    }
    if (!groups.length) return emptyCard(`ไม่พบโครงสร้างหัวตารางในชีต ${escHtml(name)}`);

    const bandClass = (i) => (i % 2 === 0 ? 'acc-band-a' : 'acc-band-b');

    const catStart = 3;
    const catRows = [];
    let r = catStart;
    while (cell(aoa, r, 0) !== null && cell(aoa, r, 0) !== '') { catRows.push(r); r++; }
    const subtotalRowIdx = r;

    let thead = `<tr><th rowspan="3" class="acc-cell--label">${escHtml(cell(aoa, headerRowIdx, 0) || 'รายการ')}</th>`;
    groups.forEach((g, i) => { thead += `<th colspan="4" class="${bandClass(i)}">${escHtml(g.label)}</th>`; });
    thead += '</tr><tr>';
    groups.forEach((g, i) => { for (let off = 0; off < 4; off++) thead += `<th class="${bandClass(i)}">${escHtml(cell(aoa, 1, g.col + off) ?? '')}</th>`; });
    thead += '</tr><tr>';
    groups.forEach((g, i) => { for (let off = 0; off < 4; off++) thead += `<th class="${bandClass(i)}">${escHtml(cell(aoa, 2, g.col + off) ?? '')}</th>`; });
    thead += '</tr>';

    let tbody = '';
    catRows.forEach((cr) => {
      tbody += `<tr><td class="acc-cell--label">${escHtml(cell(aoa, cr, 0))}</td>`;
      groups.forEach((g, i) => { for (let off = 0; off < 4; off++) tbody += numCellHtml(cell(aoa, cr, g.col + off), bandClass(i)); });
      tbody += '</tr>';
    });
    if (cell(aoa, subtotalRowIdx, 1) !== null) {
      tbody += `<tr class="acc-row--subtotal"><td class="acc-cell--label">รวม</td>`;
      groups.forEach((g) => { for (let off = 0; off < 4; off++) tbody += numCellHtml(cell(aoa, subtotalRowIdx, g.col + off)); });
      tbody += '</tr>';
    }

    const glNote = cell(aoa, subtotalRowIdx + 1, 3);
    const custBlock = findReconBlock(aoa, subtotalRowIdx, 'Customer');
    const expBlock = findReconBlock(aoa, subtotalRowIdx, 'Express');

    // ledger — เก็บทั้งแถวรายการ (คอลัมน์ A เป็นเลขลำดับ) และแถวสรุปยอดคั่นกลาง
    // (คอลัมน์ A ไม่ใช่เลขลำดับแต่มียอดในคอลัมน์เดบิต/เครดิต/ยอดสะสม) — label ของแถว
    // สรุปดึงจากคอลัมน์ A ตรงๆ ถ้าต้นฉบับไม่มีข้อความกำกับก็ปล่อยว่าง ไม่เติมคำเอง
    const ledgerStart = (expBlock ? expBlock.endRow : subtotalRowIdx) + 1;
    const ledgerRows = [];
    let sawAnyLedgerRow = false;
    for (let lr = ledgerStart; lr < aoa.length; lr++) {
      const a = cell(aoa, lr, 0);
      const hasAmounts = [6, 7, 8].some((c) => cell(aoa, lr, c) !== null);
      if (isNum(a)) { ledgerRows.push({ row: lr, type: 'entry' }); sawAnyLedgerRow = true; }
      else if (hasAmounts) { ledgerRows.push({ row: lr, type: 'subtotal', label: a }); sawAnyLedgerRow = true; }
      else if (a === null) continue;
      else if (sawAnyLedgerRow) break;
    }

    const monthLabel = MONTH_THAI[name] || name;
    let kpiSection = '';
    if (custBlock || expBlock) {
      const custCards = custBlock ? [
        kpiTile({ label: cell(aoa, custBlock.startRow, 0), value: cell(aoa, custBlock.startRow, 1), tone: 'blue', icon: ICONS.money, detail: 'ยอดที่ลูกค้าแจ้งปรับเข้ามา' }),
        kpiTile({ label: cell(aoa, custBlock.startRow + 1, 0), value: cell(aoa, custBlock.startRow + 1, 1), tone: 'green', icon: ICONS.checkCircle, detail: 'ยอดที่บัญชีเรียกเก็บได้จริง' }),
        kpiTile({ label: cell(aoa, custBlock.startRow + 2, 0), value: cell(aoa, custBlock.startRow + 2, 1), tone: 'red', icon: ICONS.ban, detail: 'ส่วนต่างที่เรียกเก็บไม่ได้' })
      ] : [];
      const expCards = expBlock ? [
        kpiTile({ label: cell(aoa, expBlock.startRow, 0), value: cell(aoa, expBlock.startRow, 1), tone: 'purple', icon: ICONS.money, detail: 'ยอดที่ Express แจ้งปรับเข้ามา' }),
        kpiTile({ label: cell(aoa, expBlock.startRow + 1, 0), value: cell(aoa, expBlock.startRow + 1, 1), tone: 'green', icon: ICONS.checkCircle, detail: 'ยอดที่บัญชีเรียกเก็บได้จริง' }),
        kpiTile({ label: cell(aoa, expBlock.startRow + 2, 0), value: cell(aoa, expBlock.startRow + 2, 1), tone: 'orange', icon: ICONS.alertTriangle, detail: 'ส่วนต่างจากฝั่ง Express' })
      ] : [];
      kpiSection = `
        <div class="acc-kpi-scope acc-kpi-section">
          <div class="acc-kpi-section__title">
            <svg width="18" height="18" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M180-120q-24.75 0-42.37-17.63Q120-155.25 120-180v-600q0-24.75 17.63-42.38Q155.25-840 180-840h600q24.75 0 42.38 17.62Q840-804.75 840-780v600q0 24.75-17.62 42.37Q804.75-120 780-120H180Zm0-60h600v-600H180v600Zm90-90h60v-300h-60v300Zm150 0h60v-420h-60v420Zm150 0h60v-180h-60v180Z"/></svg>
            สรุปยอด${escHtml(monthLabel)}
          </div>
          <div class="kpi-groups">
            ${custCards.length ? kpiPanel('ฝั่งลูกค้าปรับ (Customer)', custCards) : ''}
            ${expCards.length ? kpiPanel('ฝั่ง Express', expCards) : ''}
          </div>
        </div>
      `;
    }

    return `
      <div class="acc-card">
        <div class="acc-card__header">
          <div class="acc-card__title">${escHtml(name)}</div>
          <div class="acc-card__meta">${catRows.length} รายการค่าปรับ · ${groups.length} ลูกค้า</div>
        </div>
        <div class="acc-card__body">
          ${kpiSection}
          <div class="acc-fit-wrap">
            <table class="acc-xls-table acc-xls-table--fit">
              <thead>${thead}</thead>
              <tbody>${tbody}</tbody>
            </table>
          </div>

          ${glNote !== null && glNote !== '' ? `<span class="acc-gl-note">${escHtml(glNote)}</span>` : ''}

          ${(custBlock || expBlock) ? `
            <div class="acc-section-title">สรุปยอดกระทบยอด</div>
            <div class="acc-recon">
              ${custBlock ? reconBlockHtml(aoa, custBlock) : ''}
              ${expBlock ? reconBlockHtml(aoa, expBlock) : ''}
            </div>
          ` : ''}

          ${systemReconHtml(name, aoa, groups, catRows, subtotalRowIdx)}

          ${ledgerRows.length ? `
            <div class="acc-section-title">รายการบัญชี (${ledgerRows.filter((x) => x.type === 'entry').length} รายการ)</div>
            <div class="acc-ledger-wrap">
              <table class="acc-ledger">
                <thead><tr>
                  <th>ลำดับ</th><th>เลขที่เอกสาร</th><th>วันที่</th><th>อ้างอิง</th>
                  <th>ลูกค้า</th><th>รายละเอียด</th><th>เดบิต</th><th>เครดิต</th><th>ยอดสะสม</th>
                </tr></thead>
                <tbody>
                  ${ledgerRows.map(({ row: lr, type, label }) => type === 'entry' ? `
                    <tr>
                      <td>${escHtml(cell(aoa, lr, 0))}</td>
                      <td>${linkTextHtml(sheet, aoa, lr, 1)}</td>
                      <td>${escHtml(cell(aoa, lr, 2))}</td>
                      <td>${linkTextHtml(sheet, aoa, lr, 3)}</td>
                      <td>${escHtml(cell(aoa, lr, 4))}</td>
                      <td>${escHtml(cell(aoa, lr, 5))}</td>
                      <td class="num">${fmtNum(cell(aoa, lr, 6))}</td>
                      <td class="num">${fmtNum(cell(aoa, lr, 7))}</td>
                      <td class="num">${numOrErrText(cell(aoa, lr, 8))}</td>
                    </tr>
                  ` : `
                    <tr class="acc-ledger__subtotal">
                      <td colspan="6">${label !== null && label !== undefined && label !== '' ? escHtml(label) : ''}</td>
                      <td class="num">${fmtNum(cell(aoa, lr, 6))}</td>
                      <td class="num">${fmtNum(cell(aoa, lr, 7))}</td>
                      <td class="num">${numOrErrText(cell(aoa, lr, 8))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // ตารางหลักกว้างผันแปรตามจำนวนเดือน/ลูกค้า — ปล่อยให้มีขนาดธรรมชาติ (ไม่ตัดคำ)
  // แล้ววัดความกว้างจริงย่อด้วย transform:scale ให้พอดีการ์ดเสมอ (สเกลอัตโนมัติเมื่อ
  // มีคอลัมน์เพิ่มในอนาคต โดยไม่ต้องแก้โค้ด)
  function fitWideTables() {
    if (!rootEl) return;
    rootEl.querySelectorAll('.acc-fit-wrap').forEach((wrap) => {
      const table = wrap.querySelector('table');
      if (!table) return;
      table.style.transform = 'none';
      table.style.width = 'max-content';
      const naturalWidth = table.scrollWidth;
      const naturalHeight = table.scrollHeight;
      const availWidth = wrap.clientWidth;
      const scale = naturalWidth > availWidth ? availWidth / naturalWidth : 1;
      table.style.transform = `scale(${scale})`;
      wrap.style.height = `${naturalHeight * scale}px`;
    });
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitWideTables, 150);
  });

  function renderSheet(name) {
    const sheet = cache.sheets[name];
    const contentEl = rootEl.querySelector('.acc-content');
    if (!sheet || !contentEl) return;
    currentSheetName = name;
    contentEl.innerHTML = name === 'Summary' ? renderSummaryCard(sheet) : renderMonthCard(name, sheet);
    requestAnimationFrame(fitWideTables);
  }

  // หัวการ์ด + ปุ่มอัพโหลดไฟล์ .xlsx (ใช้ร่วมกันทั้งตอนมีข้อมูล/ว่าง/error เพื่อให้อัพโหลด
  // ได้เสมอ แม้ฐานข้อมูลยังว่างหรือโหลดไม่สำเร็จ)
  function headerHtml(subtitle) {
    return `
      <div class="chart-card__header acc-embed-header">
        <div>
          <div class="chart-card__title">เปรียบเทียบค่าปรับ Acc Vs Express</div>
          <div class="chart-card__subtitle">${subtitle}</div>
        </div>
        <label class="btn btn-primary acc-upload-btn${uploading ? ' is-loading' : ''}">
          <input type="file" accept=".xlsx,.xls" hidden data-role="acc-upload-input"${uploading ? ' disabled' : ''}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          อัพโหลดไฟล์ Acc Vs Express
        </label>
      </div>
      <div class="acc-upload-status" data-role="acc-upload-status"${uploadStatus ? '' : ' hidden'}>${uploadStatus}</div>
    `;
  }

  function wireUpload() {
    const input = rootEl && rootEl.querySelector('[data-role="acc-upload-input"]');
    if (!input) return;
    input.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ''; // เลือกไฟล์เดิมซ้ำได้
      if (file) uploadFile(file);
    });
  }

  function setUploadStatus(tone, text) {
    uploadStatus = text ? `<span class="acc-upload-status__${tone}">${escHtml(text)}</span>` : '';
    const el = rootEl && rootEl.querySelector('[data-role="acc-upload-status"]');
    if (!el) return;
    el.hidden = !uploadStatus;
    el.innerHTML = uploadStatus;
  }

  function setUploadButtonLoading(on) {
    const btn = rootEl && rootEl.querySelector('.acc-upload-btn');
    if (btn) btn.classList.toggle('is-loading', on);
    const input = rootEl && rootEl.querySelector('[data-role="acc-upload-input"]');
    if (input) input.disabled = on;
  }

  // อ่านไฟล์ในเบราว์เซอร์ (SheetJS) เฉพาะชีต Summary + ชีตเดือน (Jan..Dec) — resolve cell
  // error (#REF! ฯลฯ) เป็นข้อความที่ Excel แสดง และเก็บ hyperlink เป็น { "B25": url }
  // (รูปแบบเดียวกับหน้า xlsx-comparison/ ที่ renderer ด้านบนอ่านอยู่แล้ว)
  function parseWorkbook(buffer) {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
    const out = {};
    wb.SheetNames
      .filter((n) => n === 'Summary' || MONTH_NAMES.includes(n))
      .forEach((name) => {
        const ws = wb.Sheets[name];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
        const maxCols = aoa.reduce((max, row) => Math.max(max, row ? row.length : 0), 0);
        const resolved = aoa.map((row, r) => {
          const outRow = new Array(maxCols);
          for (let c = 0; c < maxCols; c++) {
            let v = row && row[c] !== undefined ? row[c] : null;
            if (v === null) {
              const raw = ws[XLSX.utils.encode_cell({ r, c })];
              if (raw && raw.t === 'e') v = raw.w || null;
            }
            outRow[c] = v;
          }
          return outRow;
        });
        const links = {};
        Object.keys(ws).forEach((addr) => {
          if (addr[0] === '!') return;
          const cellObj = ws[addr];
          if (cellObj && cellObj.l && cellObj.l.Target) links[addr] = String(cellObj.l.Target);
        });
        out[name] = { aoa: resolved, links };
      });
    return out;
  }

  // POST action=acc_express_upload (upsert ตามชื่อชีต — ชีตที่ไม่ได้ส่งมาไม่ถูกแตะ) แล้ว
  // ล้างแคชและโหลดจากฐานข้อมูลใหม่ ให้สิ่งที่เห็นบนจอคือสิ่งที่บันทึกจริง
  function uploadFile(file) {
    if (uploading) return;
    if (typeof XLSX === 'undefined') { setUploadStatus('error', 'ตัวอ่าน .xlsx ยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง'); return; }
    if (!ENDPOINT) { setUploadStatus('error', 'ยังไม่ได้ตั้งค่า gasEndpoint'); return; }

    const reader = new FileReader();
    reader.onerror = () => setUploadStatus('error', 'อ่านไฟล์ไม่สำเร็จ');
    reader.onload = async (e) => {
      let sheets;
      try {
        sheets = parseWorkbook(e.target.result);
      } catch (err) {
        console.error('[AccExpress] parse failed', err);
        setUploadStatus('error', 'อ่านไฟล์ไม่สำเร็จ: ' + err.message);
        return;
      }
      const names = Object.keys(sheets);
      if (!names.length) {
        setUploadStatus('error', 'ไม่พบชีต "Summary" หรือชีตรายเดือน (Jan, Feb, ...) ในไฟล์นี้');
        return;
      }

      const body = JSON.stringify({ action: 'acc_express_upload', source_file_name: file.name, sheets });
      const sizeKb = Math.round(new Blob([body]).size / 1024);
      uploading = true;
      setUploadButtonLoading(true);
      setUploadStatus('loading', `กำลังบันทึก ${names.length} ชีต (${sizeKb.toLocaleString('th-TH')} KB): ${names.join(', ')}`);
      try {
        // text/plain โดยตั้งใจ — Apps Script ตอบ preflight (OPTIONS) ไม่ได้ ถ้าใช้
        // application/json เบราว์เซอร์จะ preflight แล้วพังด้วย CORS
        const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
        const data = await res.json();
        if (!data || data.ok === false) throw new Error((data && data.error) || 'บันทึกไม่สำเร็จ');
        uploading = false;
        setUploadStatus('success', `บันทึกแล้ว ${(data.updated_keys || names).length} ชีต จากไฟล์ ${file.name}`);
        cache = null;
        render(rootEl.id);
      } catch (err) {
        uploading = false;
        setUploadButtonLoading(false);
        console.error('[AccExpress] upload failed', err);
        setUploadStatus('error', 'บันทึกลงฐานข้อมูลไม่สำเร็จ: ' + (err instanceof TypeError ? 'เชื่อมต่อฐานข้อมูลไม่ได้ ลองใหม่อีกครั้ง' : err.message));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function renderLoaded() {
    const latest = Object.values(cache.updated_at || {}).sort().pop();
    const updatedText = latest ? new Date(latest).toLocaleString('th-TH') : '—';

    rootEl.innerHTML = `
      ${headerHtml(`ข้อมูลจากไฟล์เปรียบเทียบของแผนกบัญชี · อัปเดตล่าสุด ${escHtml(updatedText)}`)}
      <div class="acc-embed">
        <div class="acc-tabs">
          ${sheetOrder.map((name, i) => `
            <button type="button" class="acc-tabs__btn${i === 0 ? ' is-active' : ''}" data-sheet="${escHtml(name)}">${escHtml(name)}</button>
          `).join('')}
        </div>
        <div class="acc-content"></div>
      </div>
    `;

    const tabsEl = rootEl.querySelector('.acc-tabs');
    tabsEl.querySelectorAll('.acc-tabs__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        tabsEl.querySelectorAll('.acc-tabs__btn').forEach((b) => b.classList.toggle('is-active', b === btn));
        renderSheet(btn.dataset.sheet);
      });
    });

    renderSheet(sheetOrder[0]);
    wireUpload();
  }

  function renderState(html) {
    rootEl.innerHTML = `
      ${headerHtml('ข้อมูลจากไฟล์เปรียบเทียบของแผนกบัญชี')}
      ${html}
    `;
    wireUpload();
  }

  // ── entry point: เรียกจาก comparison.js หลัง render section "สัดส่วนตามลูกค้า" ──
  function render(containerId) {
    rootEl = document.getElementById(containerId);
    if (!rootEl) return;

    if (cache) { renderLoaded(); return; }

    renderState(`<div class="acc-embed-state"><span class="acc-embed-spinner"></span>กำลังโหลดข้อมูลเปรียบเทียบ...</div>`);

    // ถ้ามีคำขอวิ่งอยู่แล้วให้เกาะไปด้วย ไม่ยิงซ้ำ (comparison view re-render ได้บ่อย)
    const req = inFlight || (inFlight = jsonp({ action: 'acc_express_data' }));

    req.then((data) => {
      inFlight = null;
      if (!data || data.ok === false) throw new Error((data && data.error) || 'โหลดข้อมูลไม่สำเร็จ');

      // normalize: รูปแบบเก่าเก็บเป็น AOA ล้วน (ไม่มี links), รูปแบบใหม่เป็น {aoa, links}
      const sheets = {};
      Object.entries(data.sheets || {}).forEach(([name, val]) => {
        sheets[name] = Array.isArray(val) ? { aoa: val, links: {} } : { aoa: val.aoa || [], links: val.links || {} };
      });

      const order = Object.keys(sheets)
        .filter((n) => n === 'Summary' || MONTH_NAMES.includes(n))
        .sort((a, b) => {
          if (a === 'Summary') return -1;
          if (b === 'Summary') return 1;
          return MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b);
        });

      if (!order.length) {
        renderState(`<div class="acc-embed-state acc-embed-state--muted">ยังไม่มีข้อมูลในฐานข้อมูล — กด "อัพโหลดไฟล์ Acc Vs Express" ด้านบนเพื่อเพิ่มไฟล์ "เปรียบเทียบค่าปรับ Acc Vs Express.xlsx"</div>`);
        return;
      }

      cache = { sheets, updated_at: data.updated_at || {} };
      sheetOrder = order;
      renderLoaded();
    }).catch((err) => {
      inFlight = null;
      console.error('[AccExpress] load failed', err);
      renderState(`<div class="acc-embed-state acc-embed-state--error">โหลดข้อมูลเปรียบเทียบไม่สำเร็จ: ${escHtml(err.message)}</div>`);
    });
  }

  return { render };
})();
