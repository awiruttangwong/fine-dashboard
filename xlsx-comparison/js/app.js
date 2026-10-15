/* ============================================================
   เปรียบเทียบค่าปรับ Acc Vs Express — parser + renderer
   โมดูลทดลอง แยกจาก dashboard หลัก (framework เดียวกัน: vanilla JS,
   ไม่มี build step, ใช้ XLSX.js ตัวเดียวกับ js/debt.js) — เมื่อพอใจ
   แล้วค่อย merge เข้า dashboard หลักตามที่ผู้ใช้ขอ

   แนวทางอ่านไฟล์: เทมเพลต (โครงหัวตาราง/สี/ลำดับคอลัมน์) เป็นของบริษัท
   คงที่ — ตรวจสอบแล้วด้วยไฟล์ต้นฉบับจริงว่าทุกชีตเดือน (Jan-Jun) มี
   โครงเหมือนกันทุกกระเบียดนิ้ว จึงสแกนหา "ตำแหน่งของป้ายหัวข้อ" แบบ
   ไดนามิก (ไม่ hardcode เลขแถว/คอลัมน์ตรงๆ) เพื่อให้ยังใช้ได้ถ้าเดือน
   ใหม่ๆ (Jul, Aug, ...) ถูกเพิ่มเข้ามาในไฟล์ แต่ "หน้าตา/สี" ของตาราง
   ยึดตามค่าที่สกัดจากไฟล์จริงเป๊ะ (ดูคอมเมนต์บนสุดของ css/style.css)
   ============================================================ */

(() => {
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_THAI = { Jan: 'มกราคม', Feb: 'กุมภาพันธ์', Mar: 'มีนาคม', Apr: 'เมษายน', May: 'พฤษภาคม', Jun: 'มิถุนายน', Jul: 'กรกฎาคม', Aug: 'สิงหาคม', Sep: 'กันยายน', Oct: 'ตุลาคม', Nov: 'พฤศจิกายน', Dec: 'ธันวาคม' };

  // ไอคอนชุดเดียวกับ js/kpi.js (ICONS) ของหน้าหลักเป๊ะ ให้การ์ดสรุปหน้าตาตระกูล
  // เดียวกัน ไม่ต้องออกแบบชุดใหม่
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

  const fileInput = document.getElementById('acc-file-input');
  const uploadCard = document.getElementById('upload-card');
  const uploadTitle = document.getElementById('upload-title');
  const uploadHint = document.getElementById('upload-hint');
  const errorBox = document.getElementById('acc-error');
  const tabsEl = document.getElementById('acc-tabs');
  const contentEl = document.getElementById('acc-content');
  const uploadDbBox = document.getElementById('acc-upload-db');
  const uploadDbStatus = document.getElementById('acc-upload-db-status');
  const uploadDbDetail = document.getElementById('acc-upload-db-detail');
  const uploadDbRetry = document.getElementById('acc-upload-db-retry');

  let sheetsData = {}; // { sheetName: AOA }
  let rawSheets = {}; // { sheetName: XLSX worksheet object } — ใช้หา error cell (#REF! ฯลฯ)
  let sheetOrder = [];

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    loadFile(file);
  });

  function showError(msg) {
    errorBox.hidden = false;
    errorBox.textContent = msg;
  }
  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  function loadFile(file) {
    clearError();
    if (typeof XLSX === 'undefined') { showError('ตัวอ่าน .xlsx ยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง'); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: false });
        sheetsData = {};
        rawSheets = {};
        wb.SheetNames.forEach((name) => {
          sheetsData[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true });
          rawSheets[name] = wb.Sheets[name];
        });

        sheetOrder = wb.SheetNames.filter((n) => n === 'Summary' || MONTH_NAMES.includes(n));
        if (!sheetOrder.length) { showError('ไม่พบชีต "Summary" หรือชีตรายเดือน (Jan, Feb, ...) ในไฟล์นี้'); return; }

        uploadCard.classList.add('is-loaded');
        uploadTitle.textContent = file.name;
        uploadHint.textContent = `พบ ${sheetOrder.length} ชีต: ${sheetOrder.join(', ')}`;

        renderTabs();
        renderSheet(sheetOrder[0]);

        // บันทึกขึ้นฐานข้อมูลทันทีที่อ่านไฟล์เสร็จ — จบในขั้นตอนเดียว ไม่ต้องให้ผู้ใช้
        // กดปุ่มเพิ่ม (ข้อมูลเปลี่ยนอย่างมากเดือนละครั้ง และระบบ upsert ทับของเดิมให้
        // อยู่แล้ว การอัพโหลดซ้ำจึงปลอดภัยเสมอ)
        uploadToDatabase();
      } catch (err) {
        console.error('[Acc vs Express] parse failed', err);
        showError('อ่านไฟล์ไม่สำเร็จ: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function renderTabs() {
    tabsEl.hidden = false;
    tabsEl.innerHTML = sheetOrder.map((name, i) => `
      <button class="acc-tabs__btn${i === 0 ? ' is-active' : ''}" data-sheet="${escHtml(name)}">${escHtml(name)}</button>
    `).join('');
    tabsEl.querySelectorAll('.acc-tabs__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        tabsEl.querySelectorAll('.acc-tabs__btn').forEach((b) => b.classList.toggle('is-active', b === btn));
        renderSheet(btn.dataset.sheet);
      });
    });
  }

  let currentSheetName = null;

  function renderSheet(name) {
    const aoa = sheetsData[name];
    if (!aoa) return;
    currentSheetName = name;
    contentEl.innerHTML = name === 'Summary' ? renderSummaryCard(aoa) : renderMonthCard(name, aoa);
    requestAnimationFrame(fitWideTables);
  }

  // ── Helpers ──
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // sheet_to_json (raw:true) คืนค่า null ให้ cell ที่เป็น error ของสูตร (#REF!, #DIV/0! ฯลฯ)
  // ทำให้ตารางโชว์ช่องว่างเงียบๆ ทั้งที่ต้นฉบับจริงมีข้อผิดพลาดของสูตรโชว์อยู่ (พบใน
  // ชีต May คอลัมน์ "ยอดสะสม" ที่มีสูตรอ้างอิงชีต Apr ที่ถูกลบ/ย้ายไปแล้ว) — ต้องเช็ค
  // raw worksheet cell (.t === 'e') แล้วใช้ .w (ข้อความที่ Excel แสดง) แทน เพื่อให้
  // ตรงกับต้นฉบับ 100% จริงๆ ไม่ใช่แค่ตัวเลขที่ parse สำเร็จ
  function cell(aoa, r, c) {
    const row = aoa[r];
    const v = row ? (row[c] === undefined ? null : row[c]) : null;
    if (v !== null) return v;
    const rawWs = rawSheets[currentSheetName];
    if (rawWs) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const rawCell = rawWs[addr];
      if (rawCell && rawCell.t === 'e') return rawCell.w || null;
    }
    return null;
  }
  // hyperlink ของ cell จาก raw worksheet (.l.Target) — ต้นฉบับเป็นเว็บลิงก์
  // (คลิกที่เลขเอกสารแล้วเด้งเข้าเว็บ) แต่ sheet_to_json (header:1) ทิ้ง .l ไปหมด
  // จึงต้องอ่านจาก raw cell ตรงๆ เพื่อทำเป็น <a> ให้คลิกได้เหมือนเดิม
  function link(aoa, r, c) {
    const rawWs = rawSheets[currentSheetName];
    if (!rawWs) return null;
    const rawCell = rawWs[XLSX.utils.encode_cell({ r, c })];
    return (rawCell && rawCell.l && rawCell.l.Target) ? String(rawCell.l.Target) : null;
  }
  // แสดงค่าพร้อมทำ hyperlink ถ้าต้นฉบับมี (cell แบบข้อความ)
  function linkTextHtml(aoa, r, c) {
    const v = cell(aoa, r, c);
    if (v === null || v === undefined || v === '') return '';
    const url = link(aoa, r, c);
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
  // ตัวเลข หรือ error text ("#REF!" ฯลฯ) จาก cell() — ต่างจาก fmtNum ตรงที่ไม่ทิ้งค่า
  // string ที่ไม่ใช่ตัวเลข (fmtNum คืน '' เงียบๆ ถ้าไม่ใช่ number)
  function numOrErrText(v) {
    if (isNum(v)) return fmtNum(v);
    return v === null || v === undefined ? '' : escHtml(v);
  }
  // ── การ์ดสรุป KPI (มาร์กอัปตรงกับ js/kpi.js ของหน้าหลักเป๊ะ — kpi-tile > kpi-card) ──
  // ตัวเลขทุกใบดึงจากค่าที่ parse+ตรวจสอบแล้วเท่านั้น (recon block / แถวรวมของ Summary)
  // ไม่มีการคำนวณใหม่ จึงไม่มีความเสี่ยงตัวเลขเพี้ยนจากที่ตารางด้านล่างแสดง
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

  // ============================================================
  // Summary sheet
  //   แถว0(row1) = ชื่อไฟล์/หัวเรื่อง, แถว2(row3) = ป้ายกลุ่ม (Y2026, JAN, ...)
  //   แถว3(row4) = "Customer/Acc./Tatal", แถว4(row5) = ป้ายย่อย
  //   แถวลูกค้า เริ่มแถว5(row6) จนกว่าคอลัมน์ A จะว่าง แถวถัดไป = รวม
  // ============================================================
  function renderSummaryCard(aoa) {
    const title = cell(aoa, 0, 0) || 'Summary';

    // หา block หัวข้อในแถว index 2 (แถว Excel ที่ 3) เริ่มจากคอลัมน์ B (index1)
    const headerRowIdx = 2;
    const blocks = [];
    for (let c = 1; c < (aoa[headerRowIdx] || []).length; c++) {
      const v = cell(aoa, headerRowIdx, c);
      if (v !== null && v !== '') blocks.push({ label: String(v), col: c });
    }
    if (!blocks.length) return emptyCard('ไม่พบโครงสร้างหัวตารางในชีต Summary');

    // แถวลูกค้า: เริ่มหลังแถวป้ายย่อย (index4) จนกว่าคอลัมน์ A จะว่าง
    const custStart = 5;
    const custRows = [];
    let r = custStart;
    while (cell(aoa, r, 0) !== null && cell(aoa, r, 0) !== '') { custRows.push(r); r++; }
    const totalRowIdx = r; // แถวถัดจากลูกค้าคนสุดท้าย = แถวรวม

    const bandClass = (blockIdx) => blockIdx === 0 ? 'acc-band-0' : (blockIdx % 2 === 1 ? 'acc-band-b' : 'acc-band-c');

    let thead = `<tr><th rowspan="3" class="acc-cell--label">${escHtml(cell(aoa, headerRowIdx, 0) || 'รายการ')}</th>`;
    blocks.forEach((b) => { thead += `<th colspan="3" class="${bandClass(blocks.indexOf(b))}">${escHtml(b.label)}</th>`; });
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

    // การ์ดสรุป KPI — ใช้ค่าจากแถว "รวม" ของ block แรก (Y2026 ยอดรวมทั้งปี) ตรงๆ
    // เป็นตัวเลขชุดเดียวกับที่ตารางด้านล่างแสดง ไม่มีการคำนวณซ้ำ ป้ายการ์ดต่อคำเดิม
    // จากหัวตาราง 2 แถว (row4+row5) ตรงๆ ไม่เรียบเรียงคำใหม่ เช่นเดียวกับตาราง
    const y2026Label = blocks[0] ? blocks[0].label : 'รวมทั้งปี';
    const y2026Col = blocks[0] ? blocks[0].col : 1;
    const colLabel = (off) => [cell(aoa, 3, y2026Col + off), cell(aoa, 4, y2026Col + off)]
      .filter((x) => x !== null && x !== '').join(' ').replace(/\s+/g, ' ').trim();
    const kpiSection = `
      <div class="acc-kpi-scope acc-kpi-section">
        <div class="acc-kpi-section__title">
          <svg width="18" height="18" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M180-120q-24.75 0-42.37-17.63Q120-155.25 120-180v-600q0-24.75 17.63-42.38Q155.25-840 180-840h600q24.75 0 42.38 17.62Q840-804.75 840-780v600q0 24.75-17.62 42.37Q804.75-120 780-120H180Zm0-60h600v-600H180v600Zm90-90h60v-300h-60v300Zm150 0h60v-420h-60v420Zm150 0h60v-180h-60v180Z"/></svg>
          สรุปยอดรวมทั้งปี (${escHtml(y2026Label)})
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
        <div class="acc-card__header">
          <div class="acc-card__title">${escHtml(title)}</div>
          <div class="acc-card__meta">${custRows.length} ลูกค้า · ${blocks.length} กลุ่มคอลัมน์</div>
        </div>
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

  // ตารางหลัก (Summary และตารางรายการค่าปรับของทุกชีตเดือน) มีจำนวนคอลัมน์ผันแปร
  // ตามจำนวนกลุ่มลูกค้า/เดือนที่มีข้อมูล (ตอนนี้ Jan-Jun = 25 คอลัมน์ต่อชีตเดือน,
  // Summary 6 เดือน = 19 คอลัมน์ → อนาคตเต็มปี 12 เดือนยิ่งกว้างกว่านี้อีก) การบีบ
  // คอลัมน์ด้วย CSS ทำให้คำอย่าง "Customer" ถูกตัดกลางคำ จึงปล่อยตารางมีขนาด
  // ธรรมชาติ (nowrap เหมือนต้นฉบับ ไม่ตัดคำ) แล้ววัดความกว้างจริงด้วย JS แล้วย่อ
  // ทั้งตารางด้วย transform:scale ให้พอดีความกว้างการ์ดเสมอ ใช้กับทุก
  // .acc-fit-wrap ในการ์ดที่กำลังแสดง (ทั้ง Summary และตารางรายเดือน) ไม่ใช่แค่
  // Summary — สเกลลงอัตโนมัติเมื่อมีคอลัมน์เพิ่มขึ้นโดยไม่ต้องแก้โค้ด
  function fitWideTables() {
    contentEl.querySelectorAll('.acc-fit-wrap').forEach((wrap) => {
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

  // ============================================================
  // Month sheet (Jan..Jun, ...):
  //   1) grid หลัก: แถว0(row1)=ชื่อลูกค้า(กลุ่มละ4คอลัมน์), แถว1-2=หัวย่อย,
  //      แถวรายการ(cat) เริ่ม index3 จนคอลัมน์ A ว่าง, แถวถัดไป = รวมย่อย
  //   2) reconciliation: หา "Customer (ลูกค้าปรับ)" และ "Express (แจ้งให้ปรับ)"
  //   3) ledger: แถวที่คอลัมน์ A เป็นตัวเลขล้วนหลังจาก reconciliation
  // ============================================================
  function renderMonthCard(name, aoa) {
    const headerRowIdx = 0;
    const groups = [];
    for (let c = 1; c < (aoa[headerRowIdx] || []).length; c++) {
      const v = cell(aoa, headerRowIdx, c);
      if (v !== null && v !== '') groups.push({ label: String(v), col: c });
    }
    if (!groups.length) return emptyCard(`ไม่พบโครงสร้างหัวตารางในชีต ${escHtml(name)}`);

    const bandClass = (i) => (i % 2 === 0 ? 'acc-band-a' : 'acc-band-b');

    // แถวรายการค่าปรับ
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

    // ป้าย "GL" ที่ D (index3) แถวถัดจากรวมย่อย — พบในทุกชีตเดือนของต้นฉบับ ไม่มีที่มา
    // ชัดเจนแต่เป็นข้อความที่มีอยู่จริง จึงต้องแสดงไว้เพื่อความครบถ้วน 100%
    const glNote = cell(aoa, subtotalRowIdx + 1, 3);

    // reconciliation block — สแกนหาป้ายในคอลัมน์ A ทั้งชีตหลังแถว subtotal
    const custBlock = findReconBlock(aoa, subtotalRowIdx, 'Customer');
    const expBlock = findReconBlock(aoa, subtotalRowIdx, 'Express');

    // ledger — สแกนทุกแถวหลัง reconciliation block จนจบชีต เก็บทั้ง 2 แบบ:
    //   "entry" (คอลัมน์ A เป็นเลขลำดับรายการ) และ "subtotal" (คอลัมน์ A ไม่ใช่เลขลำดับ
    //   แต่มียอดเดบิต/เครดิต/ยอดสะสมอยู่ — พบเป็นแถวคั่นกลางรายการในบางเดือน เช่น Mar ที่มี
    //   รายการ 2 ช่วงคั่นด้วยแถวสรุปยอดกลางตาราง) เรียงตามลำดับแถวจริงเสมอ label ของแถว
    //   subtotal ดึงจากคอลัมน์ A ตรงๆ ถ้าต้นฉบับไม่มีข้อความกำกับ (เป็น null) ก็ปล่อยว่าง
    //   ไม่เติมคำเอง (เช่น "ยอดรวมย่อย") เพราะต้นฉบับแต่ละเดือนอาจไม่มีข้อความนี้ และไม่รู้
    //   ว่าจะตีความหมายแบบไหนถ้าเทมเพลตเปลี่ยนไปในอนาคต — ถ้าต้นฉบับมีข้อความกำกับจริงๆ
    //   (เทมเพลตในอนาคตอาจเปลี่ยนมาใส่) ก็แสดงข้อความนั้นตรงๆ เช่นกัน ไม่ break ทิ้งรายการ
    //   ถัดไปแค่เพราะคอลัมน์ A ไม่ใช่ตัวเลข
    const ledgerStart = (expBlock ? expBlock.endRow : subtotalRowIdx) + 1;
    const ledgerRows = [];
    let sawAnyLedgerRow = false;
    for (let lr = ledgerStart; lr < aoa.length; lr++) {
      const a = cell(aoa, lr, 0);
      const hasAmounts = [6, 7, 8].some((c) => cell(aoa, lr, c) !== null);
      if (isNum(a)) { ledgerRows.push({ row: lr, type: 'entry' }); sawAnyLedgerRow = true; }
      else if (hasAmounts) { ledgerRows.push({ row: lr, type: 'subtotal', label: a }); sawAnyLedgerRow = true; }
      else if (a === null) continue; // แถวว่างล้วนคั่นได้
      else if (sawAnyLedgerRow) break;
    }

    // การ์ดสรุป KPI ประจำเดือนนี้ — ดึงจาก custBlock/expBlock (reconciliation) ที่ตรวจ
    // สอบความถูกต้องกับต้นฉบับแล้ว 100% ไม่ใช่ค่าที่คำนวณใหม่ จึงสลับเดือนแล้วตัวเลขบน
    // การ์ดตรงกับตาราง "สรุปยอดกระทบยอด" ด้านล่างเสมอ
    const monthLabel = MONTH_THAI[name] || name;
    let kpiSection = '';
    if (custBlock || expBlock) {
      // ป้ายการ์ดดึงจากคอลัมน์ A ของ recon block ตรงๆ (คำเดิมจากไฟล์เป๊ะ ไม่มีการ
      // เรียบเรียงคำใหม่) — ตรงกับสิ่งที่ตาราง "สรุปยอดกระทบยอด" ด้านล่างแสดงทุกตัวอักษร
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
                      <td>${linkTextHtml(aoa, lr, 1)}</td>
                      <td>${escHtml(cell(aoa, lr, 2))}</td>
                      <td>${linkTextHtml(aoa, lr, 3)}</td>
                      <td>${escHtml(cell(aoa, lr, 4))}</td>
                      <td>${escHtml(cell(aoa, lr, 5))}</td>
                      <td class="num">${fmtNum(cell(aoa, lr, 6))}</td>
                      <td class="num">${fmtNum(cell(aoa, lr, 7))}</td>
                      <td class="num">${numOrErrText(cell(aoa, lr, 8))}</td>
                    </tr>
                  ` : `
                    <tr class="acc-ledger__subtotal">
                      <td colspan="6">${label !== null && label !== '' ? escHtml(label) : ''}</td>
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

  // หา block กระทบยอด 3 แถวติดกัน เริ่มจากแถวที่คอลัมน์ A ขึ้นต้นด้วย prefix ที่กำหนด
  function findReconBlock(aoa, fromRow, prefix) {
    for (let r = fromRow; r < aoa.length; r++) {
      const v = cell(aoa, r, 0);
      if (typeof v === 'string' && v.indexOf(prefix) === 0) {
        return { startRow: r, endRow: r + 2 };
      }
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

  function emptyCard(msg) {
    return `<div class="acc-card"><div class="acc-card__body"><div class="acc-empty">${escHtml(msg)}</div></div></div>`;
  }

  // ── บันทึกขึ้นฐานข้อมูล (Google Sheet ผ่าน backend/live-gas) ──
  // ทำงานอัตโนมัติทันทีที่อ่านไฟล์เสร็จ (เรียกจาก loadFile) ไม่มีปุ่มให้กดเอง
  // ปุ่ม "ลองใหม่" โผล่เฉพาะตอนล้มเหลว เพื่อไม่ให้ผู้ใช้ต้องเลือกไฟล์ใหม่ทั้งไฟล์
  uploadDbRetry.addEventListener('click', uploadToDatabase);

  // แสดงสถานะการบันทึก: state = 'loading' | 'success' | 'error'
  function setUploadState(state, statusText, detailText) {
    uploadDbBox.hidden = false;
    uploadDbBox.className = 'acc-upload-db is-' + state;
    uploadDbStatus.textContent = statusText;
    uploadDbDetail.textContent = detailText || '';
    uploadDbRetry.hidden = state !== 'error';
  }

  // สร้าง AOA ของชีตหนึ่งที่ "resolve" cell error (#REF! ฯลฯ) แล้ว — ใช้ cell() ตัวเดิม
  // (บรรทัดด้านบน) ที่ fallback ไปอ่าน rawSheets ให้อยู่แล้วตอน render จึงไม่ต้องเขียน
  // ตรรกะ resolve ซ้ำ แค่สลับ currentSheetName ชั่วคราวให้ cell() อ้างอิง rawSheets ของ
  // ชีตที่ต้องการ (ปกติ cell() อ่านจาก currentSheetName ที่กำลังแสดงอยู่บนจอเท่านั้น)
  // ผลลัพธ์เป็น AOA ที่สมบูรณ์ในตัวเอง ไม่ต้องพึ่ง rawSheets ตอนอ่านข้อมูลนี้กลับมาทีหลัง
  function buildResolvedAoa_(name) {
    const aoa = sheetsData[name];
    if (!aoa) return [];
    const prevSheetName = currentSheetName;
    currentSheetName = name;
    const maxCols = aoa.reduce((max, row) => Math.max(max, row ? row.length : 0), 0);
    const resolved = aoa.map((row, r) => {
      const out = new Array(maxCols);
      for (let c = 0; c < maxCols; c++) out[c] = cell(aoa, r, c);
      return out;
    });
    currentSheetName = prevSheetName;
    return resolved;
  }

  // เก็บ hyperlink ของชีตหนึ่งเป็น { "B25": "https://..." } จาก raw worksheet
  function buildLinkMap_(name) {
    const ws = rawSheets[name];
    if (!ws) return {};
    const links = {};
    Object.keys(ws).forEach((addr) => {
      if (addr[0] === '!') return; // ข้าม metadata (!ref, !merges, ฯลฯ)
      const c = ws[addr];
      if (c && c.l && c.l.Target) links[addr] = String(c.l.Target);
    });
    return links;
  }

  async function uploadToDatabase() {
    if (!sheetOrder.length) return;
    if (!window.ACC_XLS_CONFIG || !window.ACC_XLS_CONFIG.gasEndpoint) {
      setUploadState('error', 'บันทึกลงฐานข้อมูลไม่สำเร็จ', 'ไม่พบการตั้งค่า endpoint (js/api-config.js)');
      return;
    }

    setUploadState('loading', 'กำลังบันทึกลงฐานข้อมูล...', `กำลังเตรียมข้อมูล ${sheetOrder.length} ชีต: ${sheetOrder.join(', ')}`);

    // เก็บ hyperlink ไปด้วย ({ "B25": url }) เพราะฝั่งที่อ่านข้อมูลกลับไปแสดง (dashboard
    // หลัก) ไม่มี raw worksheet ให้ดึง .l.Target อีก — ถ้าไม่เก็บ ลิงก์คลิกได้ของเลขที่
    // เอกสาร/อ้างอิงในตารางรายการบัญชีจะหายไปจากหน้า dashboard
    const sheets = {};
    sheetOrder.forEach((name) => {
      sheets[name] = { aoa: buildResolvedAoa_(name), links: buildLinkMap_(name) };
    });

    const payload = {
      action: 'acc_express_upload',
      source_file_name: uploadTitle.textContent || '',
      sheets
    };
    const body = JSON.stringify(payload);
    const sizeKb = Math.round(new Blob([body]).size / 1024);
    const startedAt = Date.now();

    setUploadState('loading', 'กำลังบันทึกลงฐานข้อมูล...', `กำลังส่งข้อมูล ${sheetOrder.length} ชีต (${sizeKb.toLocaleString('th-TH')} KB) — ${sheetOrder.join(', ')}`);

    try {
      // Content-Type: text/plain (ไม่ใช่ application/json) โดยตั้งใจ — GAS Web App
      // ตอบ preflight OPTIONS ไม่ได้ ถ้าตั้ง application/json เบราว์เซอร์จะยิง
      // preflight ก่อนแล้วพังด้วย CORS; text/plain เป็น "simple request" ไม่ต้อง
      // preflight จึงเขียนข้าม origin ได้ตรงๆ (doPost อ่าน e.postData.contents เอง)
      const res = await fetch(window.ACC_XLS_CONFIG.gasEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body
      });
      const data = await res.json();
      if (!data || data.ok === false) throw new Error((data && data.error) || 'บันทึกไม่สำเร็จ');

      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      const keys = data.updated_keys || [];
      setUploadState(
        'success',
        `บันทึกลงฐานข้อมูลแล้ว ${keys.length} ชีต`,
        `${keys.join(', ')} · ${sizeKb.toLocaleString('th-TH')} KB · ใช้เวลา ${seconds} วินาที · ${new Date(data.updated_at).toLocaleString('th-TH')}`
      );
    } catch (err) {
      console.error('[Acc vs Express] upload failed', err);
      // TypeError จาก fetch = ต่อเน็ต/endpoint ไม่ได้ (ข้อความดิบเป็นภาษาอังกฤษอย่าง
      // "Failed to fetch") แปลงเป็นข้อความที่ผู้ใช้อ่านแล้วรู้ว่าต้องทำอะไรต่อ
      const detail = (err instanceof TypeError)
        ? 'เชื่อมต่อฐานข้อมูลไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วกด "ลองใหม่"'
        : err.message;
      setUploadState('error', 'บันทึกลงฐานข้อมูลไม่สำเร็จ', detail);
    }
  }
})();
