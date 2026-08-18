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
  let inFlight = null;   // Promise ของคำขอที่กำลังวิ่งอยู่ (กันยิงซ้อน)
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

  function renderLoaded() {
    const latest = Object.values(cache.updated_at || {}).sort().pop();
    const updatedText = latest ? new Date(latest).toLocaleString('th-TH') : '—';

    rootEl.innerHTML = `
      <div class="chart-card__header">
        <div>
          <div class="chart-card__title">เปรียบเทียบค่าปรับ Acc Vs Express</div>
          <div class="chart-card__subtitle">ข้อมูลจากไฟล์เปรียบเทียบของแผนกบัญชี · อัปเดตล่าสุด ${escHtml(updatedText)}</div>
        </div>
      </div>
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
  }

  function renderState(html) {
    rootEl.innerHTML = `
      <div class="chart-card__header">
        <div>
          <div class="chart-card__title">เปรียบเทียบค่าปรับ Acc Vs Express</div>
          <div class="chart-card__subtitle">ข้อมูลจากไฟล์เปรียบเทียบของแผนกบัญชี</div>
        </div>
      </div>
      ${html}
    `;
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
        renderState(`<div class="acc-embed-state acc-embed-state--muted">ยังไม่มีข้อมูลในฐานข้อมูล — อัพโหลดไฟล์ "เปรียบเทียบค่าปรับ Acc Vs Express.xlsx" ที่หน้าอัพโหลดก่อน</div>`);
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
