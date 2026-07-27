/* ============================================================
   Native Debt Tracker (ค่าปรับรถไม่เข้ารับงาน)
   Design ported 1:1 from the original ค่าปรับค้าง พขร page.
   Data: JSONP GET to the central warehouse (debt_* actions).
   No iframe, no google.script.run.
   ============================================================ */
const DebtTracker = (() => {
  const cfg = window.FINE_DASHBOARD_CONFIG || {};
  const ENDPOINT = cfg.gasEndpoint || '';
  const TIMEOUT = cfg.requestTimeoutMs || 25000;
  const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const TYPE_COLORS = ['primary', 'success', 'warning', 'danger', 'info', 'secondary', 'dark'];

  const state = {
    month: 'all', drivers: [], customers: ['FLASH', 'SPX', 'KEX', 'BEST', 'J&T', 'SGT'],
    fineTypes: [], statusFilter: 'active', search: '', typeFilter: '', busy: false, loaded: false
  };
  let container = null;

  // ── transport ──
  function jsonp(params) {
    return new Promise((resolve, reject) => {
      if (!ENDPOINT) return reject(new Error('ยังไม่ได้ตั้งค่า gasEndpoint'));
      const cb = 'debtCb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const url = new URL(ENDPOINT);
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) url.searchParams.set(k, v); });
      url.searchParams.set('callback', cb); url.searchParams.set('ts', Date.now());
      const s = document.createElement('script');
      const t = setTimeout(() => { cleanup(); reject(new Error('หมดเวลารอ Apps Script')); }, TIMEOUT);
      function cleanup() { clearTimeout(t); delete window[cb]; if (s.parentNode) s.parentNode.removeChild(s); }
      window[cb] = (d) => { cleanup(); resolve(d); };
      s.onerror = () => { cleanup(); reject(new Error('เรียก endpoint ไม่สำเร็จ')); };
      s.src = url.toString(); document.head.appendChild(s);
    });
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('th-TH');
  const monthThai = (label) => { const n = Number(String(label).replace(/[^0-9]/g, '')); return THAI_MONTHS[n - 1] || label; };
  const currentMonthLabel = () => 'M' + ((window.FineData && FineData.nowInThailand ? FineData.nowInThailand() : new Date()).getMonth() + 1);
  const monthFromId = (id) => { const m = String(id || '').match(/^D-(\d+)-/); return m ? 'M' + m[1] : (state.month !== 'all' ? state.month : currentMonthLabel()); };
  function fmtDate(v) { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || ''); }

  // ── data ──
  // ป้องกัน race: ถ้าผู้ใช้สลับเดือนเร็ว ๆ (หรือสลับก่อน load แรกจะกลับมา) คำขอหลาย
  // อันจะวิ่งพร้อมกัน ตัวที่ตอบกลับ "ช้าสุด" อาจไม่ใช่ "คำขอล่าสุด" — ผูก seq ให้ทุก
  // load แล้วรับเฉพาะผลของคำขอล่าสุดเท่านั้น กันตารางแสดงข้อมูลเดือนผิดกับ dropdown
  let loadSeq = 0;
  async function load(silent) {
    const seq = ++loadSeq;
    const reqMonth = state.month;
    if (!silent) renderInto('debt-groups', '<div class="debt-loading">กำลังโหลดข้อมูล…</div>');
    let res;
    try {
      res = await jsonp({ action: 'debt_dashboard', month: reqMonth });
      if (!res || res.ok === false) throw new Error((res && res.error) || 'โหลดข้อมูลไม่สำเร็จ');
    } catch (err) {
      if (seq !== loadSeq) return; // มี load ใหม่กว่าเข้ามาแล้ว — ทิ้ง error ของคำขอเก่า
      if (!silent) {
        renderInto('debt-groups', '<div class="debt-error">โหลดข้อมูลไม่สำเร็จ: ' + esc(err.message) + '<br><br><button class="btn btn-primary" id="debt-retry">ลองใหม่</button></div>');
        const r = document.getElementById('debt-retry'); if (r) r.onclick = () => load(false);
      } else toast('รีเฟรชไม่สำเร็จ: ' + err.message, 'error');
      return;
    }
    if (seq !== loadSeq) return; // คำขอนี้ถูกแทนที่ด้วย load ที่ใหม่กว่าแล้ว — ไม่ apply ผลเก่า
    state.drivers = res.drivers || [];
    if (Array.isArray(res.customers) && res.customers.length) state.customers = res.customers;
    state.fineTypes = res.fine_types || [];
    state.loaded = true;
    renderTypeOptions();
    renderData();
  }

  async function write(action, params, okMsg) {
    if (state.busy) return;
    state.busy = true;
    try {
      const res = await jsonp(Object.assign({ action, month: state.month }, params));
      if (!res || res.ok === false) throw new Error((res && res.error) || 'บันทึกไม่สำเร็จ');
      if (okMsg) toast(okMsg, 'success');
      await load(true);
      return res;
    } catch (err) { toast(err.message, 'error'); throw err; }
    finally { state.busy = false; }
  }

  // ══ shell ══
  function show(mountEl) { container = mountEl; container.hidden = false; container.innerHTML = shellHtml(); wireShell(); load(false); }
  function hide() { if (container) container.hidden = true; }

  function shellHtml() {
    const monthOpts = '<option value="all"' + (state.month === 'all' ? ' selected' : '') + '>ทุกเดือน</option>' +
      THAI_MONTHS.map((m, i) => `<option value="M${i + 1}"${state.month === 'M' + (i + 1) ? ' selected' : ''}>${m}</option>`).join('');
    return `
      <div class="debt">
        <div class="debt-actions">
          <button class="btn btn-outline-dark" id="debt-import">
            <svg width="15" height="15" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-320 280-520l56-58 104 104v-286h80v286l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>
            Import ข้อมูล
          </button>
          <button class="btn btn-dark" id="debt-add">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            เพิ่ม พขร. ใหม่
          </button>
        </div>
        <div class="section-label">
          <svg width="18" height="18" viewBox="0 -960 960 960" fill="currentColor"><path d="M120-120v-80l80-80v240h-80Zm160 0v-320l80-80v400h-80Zm160 0v-400l80 81v319h-80Zm160 0v-319l80-80v399h-80Zm160 0v-479l80-80v559h-80ZM120-360v-113l280-280 160 160 280-280v113L560-480 400-640 120-360Z"/></svg>
          สรุปภาพรวม
        </div>
        <div class="debt-summary" id="debt-summary"></div>
        <div class="content-box">
          <div class="debt-tabs" id="debt-tabs">
            <button class="debt-tab is-active" data-status="active">กำลังผ่อน</button>
            <button class="debt-tab" data-status="done">ผ่อนเสร็จแล้ว</button>
            <button class="debt-tab" data-status="all">ทั้งหมด</button>
          </div>
          <div class="toolbar">
            <p class="content-box__title" style="margin:0">รายละเอียดรายบุคคล</p>
            <div class="toolbar__controls">
              <div class="toolbar__search">
                <svg class="toolbar__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="debt-search" class="toolbar__input" placeholder="ค้นหาชื่อผู้รับโอน / ชื่อ พขร...">
              </div>
              <select id="debt-type" class="toolbar__select"><option value="">สาเหตุ</option></select>
              <div class="toolbar__month">
                <svg class="toolbar__month-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <select id="debt-month" class="toolbar__select toolbar__month-select">${monthOpts}</select>
              </div>
              <button class="toolbar__clear-btn" id="debt-clear">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                ล้างตัวกรอง
              </button>
            </div>
          </div>
          <div id="debt-groups"></div>
        </div>
      </div>`;
  }

  function wireShell() {
    const $ = (id) => document.getElementById(id);
    $('debt-add').onclick = openAddModal;
    $('debt-import').onclick = openImportModal;
    $('debt-search').oninput = (e) => { state.search = e.target.value.trim().toLowerCase(); renderData(); };
    $('debt-type').onchange = (e) => { state.typeFilter = e.target.value; renderData(); };
    $('debt-month').onchange = (e) => { state.month = e.target.value; load(false); };
    $('debt-clear').onclick = () => { state.search = ''; state.typeFilter = ''; $('debt-search').value = ''; $('debt-type').value = ''; renderData(); };
    container.querySelectorAll('.debt-tab').forEach(b => b.onclick = () => {
      container.querySelectorAll('.debt-tab').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active'); state.statusFilter = b.dataset.status; renderData();
    });
  }

  function renderTypeOptions() {
    const sel = document.getElementById('debt-type');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">สาเหตุ</option>' + state.fineTypes.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    sel.value = cur;
  }

  function renderInto(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }

  function renderData() { renderSummary(); renderGroups(); }

  // ── summary (over the whole loaded month scope, before tab/search filters) ──
  function renderSummary() {
    const el = document.getElementById('debt-summary'); if (!el) return;
    const all = state.drivers;
    const yes = all.filter(d => d.collectible !== 'ปรับไม่ได้');
    const no = all.filter(d => d.collectible === 'ปรับไม่ได้');
    const sum = (a, k) => a.reduce((s, d) => s + (d[k] || 0), 0);
    // "ยอดปรับรวมทั้งหมด" หักยอดคงเหลือของกลุ่ม "ปรับไม่ได้" ออก เพราะยอดนั้นเก็บไม่ได้จริง
    // สูตร: sum(all,total) - sum(no,balance) = sum(yes,total) + sum(no,paid)
    //   → กลุ่มปรับได้นับเต็มยอด, กลุ่มปรับไม่ได้นับเฉพาะที่จ่ายมาแล้ว (ส่วนคงเหลือคือส่วนที่สูญ)
    // เมื่อกด "ดึงกลับปรับได้" แถวนั้นย้ายจาก no→yes (backend เก็บ total/paid/balance ไว้เดิม
    // แค่พลิก flag) ยอด balance ที่เคยถูกหักออกจึงไหลกลับเข้ายอดรวมโดยอัตโนมัติเมื่อ re-render
    el.innerHTML = `
      <div class="stat-card">
        <div class="stat-card__head">
          <div class="stat-card__title">
            <span class="stat-card__icon stat-card__icon--accent"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg></span>
            ยอดปรับรวม
          </div>
          <span class="pill pill--muted">${all.length} รายการ</span>
        </div>
        <div class="stat-card__metrics stat-card__metrics--single">
          <div><span class="stat-card__metric-label">ยอดปรับรวมทั้งหมด</span><span class="stat-card__metric-value stat-card__metric-value--accent">${num(sum(all, 'total') - sum(no, 'balance'))} ฿</span></div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__head">
          <div class="stat-card__title">
            <span class="stat-card__icon stat-card__icon--green"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
            ปรับได้
          </div>
          <span class="pill pill--green">${yes.length} รายการ</span>
        </div>
        <div class="stat-card__metrics">
          <div><span class="stat-card__metric-label">ยอดคงเหลือ</span><span class="stat-card__metric-value stat-card__metric-value--danger">${num(sum(yes, 'balance'))} ฿</span></div>
          <div><span class="stat-card__metric-label">ชำระค่าปรับแล้ว</span><span class="stat-card__metric-value stat-card__metric-value--success">${num(sum(yes, 'paid'))} ฿</span></div>
        </div>
      </div>
      <div class="stat-card stat-card--danger">
        <div class="stat-card__head">
          <div class="stat-card__title">
            <span class="stat-card__icon stat-card__icon--danger"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></span>
            ปรับไม่ได้
          </div>
          <span class="pill pill--danger">${no.length} รายการ</span>
        </div>
        <div class="stat-card__metrics stat-card__metrics--single">
          <div><span class="stat-card__metric-label">ยอดปรับไม่ได้</span><span class="stat-card__metric-value stat-card__metric-value--danger">${num(sum(no, 'balance'))} ฿</span></div>
        </div>
      </div>`;
  }

  function filtered() {
    return state.drivers.filter(d => {
      if (state.statusFilter === 'active' && d.balance <= 0) return false;
      if (state.statusFilter === 'done' && d.balance > 0) return false;
      if (state.search) { const hay = ((d.name || '') + ' ' + (d.driverName || '') + ' ' + (d.customer || '')).toLowerCase(); if (!hay.includes(state.search)) return false; }
      if (state.typeFilter && d.fineType !== state.typeFilter) return false;
      return true;
    });
  }

  function typeColor(type) { const i = state.fineTypes.indexOf(type); return i < 0 ? 'secondary' : TYPE_COLORS[i % TYPE_COLORS.length]; }

  function rowHtml(d) {
    const badge = d.fineType ? `<span class="type-badge type-badge--${typeColor(d.fineType)}">${esc(d.fineType)}</span>` : '<span class="type-badge type-badge--light">ไม่ระบุ</span>';
    const edit = `<button class="btn btn-outline-dark btn-action" data-act="edit" data-id="${esc(d.id)}" title="แก้ไข"><svg viewBox="0 -960 960 960" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T846-647L319-120H120Z"/></svg></button>`;
    let actions;
    if (d.collectible === 'ปรับไม่ได้') {
      actions = edit + `<button class="btn btn-outline-success btn-action" data-act="moveback" data-id="${esc(d.id)}">ดึงกลับปรับได้</button>`;
    } else {
      const pay = d.balance > 0 ? `<button class="btn btn-primary btn-action" data-act="pay" data-id="${esc(d.id)}">จ่ายเงิน</button>` : '<span class="cell-done">ครบ</span>';
      const move = d.balance > 0 ? `<button class="btn btn-outline-secondary btn-action" data-act="movenon" data-id="${esc(d.id)}">ย้ายไปปรับไม่ได้</button>` : '';
      actions = edit + pay + move;
    }
    const sub = `${esc(d.route)} · ${esc(fmtDate(d.startDate))}${d.customer ? ' · ลูกค้า ' + esc(d.customer) : ''}`;
    return `<tr>
      <td>
        <div class="cell-driver__name" title="${esc(d.name)}">${esc(d.name)}</div>
        ${d.driverName ? `<div class="cell-driver__driver">พขร. ${esc(d.driverName)}</div>` : ''}
        <div class="cell-driver__sub" title="${sub}">${sub}</div>
      </td>
      <td class="cell-center">${badge}</td>
      <td class="cell-balance">${num(d.balance)}</td>
      <td class="cell-progress"><small>${d.paidInstallments}/${d.totalInst}</small></td>
      <td><div class="cell-actions">${actions}</div></td>
    </tr>`;
  }

  function groupBlock(cls, mod, iconSvg, label, rows) {
    const body = rows.length ? rows.map(rowHtml).join('') : '<tr><td colspan="5"><div class="debt-empty">ไม่มีรายการ</div></td></tr>';
    return `
      <div class="table-block">
        <div class="table-group-title table-group-title--${mod}">
          <div class="table-group-title__left">
            <span class="table-group-title__icon">${iconSvg}</span>
            <span class="table-group-title__text">${label}</span>
          </div>
          <span class="table-group-title__count">${rows.length} คน</span>
        </div>
        <div class="table-responsive">
          <table class="debt-table">
            <colgroup><col class="col-driver"><col class="col-type"><col class="col-balance"><col class="col-progress"><col class="col-action"></colgroup>
            <thead><tr><th>ชื่อผู้รับโอน / ชื่อ พขร / เส้นทาง</th><th class="cell-center">สาเหตุ</th><th class="cell-center">คงเหลือ</th><th class="cell-center">คืบหน้า</th><th class="cell-center">จัดการ</th></tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderGroups() {
    const rows = filtered();
    const yes = rows.filter(d => d.collectible !== 'ปรับไม่ได้');
    const no = rows.filter(d => d.collectible === 'ปรับไม่ได้');
    const iconYes = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    const iconNo = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>';
    renderInto('debt-groups', groupBlock('yes', 'yes', iconYes, 'ปรับได้', yes) + groupBlock('no', 'no', iconNo, 'ปรับไม่ได้', no));
    document.querySelectorAll('#debt-groups [data-act]').forEach(b => b.onclick = () => handleAction(b.dataset.act, b.dataset.id));
  }

  function driverById(id) { return state.drivers.find(d => String(d.id) === String(id)); }
  function handleAction(act, id) {
    const d = driverById(id); if (!d) return;
    if (act === 'edit') return openEditModal(d);
    if (act === 'pay') return openPayModal(d);
    if (act === 'movenon') return moveNon(d);
    if (act === 'moveback') return moveBack(d);
  }

  // ══ modals ══
  function modal(title, bodyHtml, opts) {
    opts = opts || {};
    const ov = document.createElement('div');
    ov.className = 'debt-modal-overlay';
    ov.innerHTML = `<div class="debt-modal${opts.lg ? ' debt-modal--lg' : ''}"><div class="debt-modal__head"><h5>${esc(title)}</h5><button class="debt-modal__x">×</button></div><div class="debt-modal__body">${bodyHtml}</div><div class="debt-modal__foot">${opts.foot || ''}</div></div>`;
    document.body.appendChild(ov);
    const close = () => { if (ov.parentNode) ov.parentNode.removeChild(ov); };
    ov.querySelector('.debt-modal__x').onclick = close;
    ov.onclick = (e) => { if (e.target === ov) close(); };
    return { ov, close, $: (id) => ov.querySelector('#' + id) };
  }
  const custOpts = (sel) => '<option value="">-- เลือกลูกค้า --</option>' + state.customers.map(c => `<option value="${esc(c)}"${c === sel ? ' selected' : ''}>${esc(c)}</option>`).join('');
  const typeOpts = (sel) => '<option value="">-- เลือกสาเหตุ --</option>' + state.fineTypes.map(t => `<option value="${esc(t)}"${t === sel ? ' selected' : ''}>${esc(t)}</option>`).join('');

  function openAddModal() {
    const foot = '<button class="btn btn-dark" id="a-ok" style="flex:1">บันทึกข้อมูล</button>';
    const m = modal('เพิ่มรายชื่อ พขร. ใหม่', `
      <div class="ef">
        <div class="ef__field"><label class="ef__label">ชื่อผู้รับโอน *</label><input class="ef__input" id="a-name"></div>
        <div class="ef__field"><label class="ef__label">ชื่อ พขร</label><input class="ef__input" id="a-driver"></div>
        <div class="ef__field"><label class="ef__label">ลูกค้า *</label><select class="ef__input" id="a-customer">${custOpts('')}</select></div>
        <div class="ef__field"><label class="ef__label">สาเหตุ *</label><select class="ef__input" id="a-type">${typeOpts('')}</select></div>
        <div class="ef__field"><label class="ef__label">สถานะการปรับ</label>
          <div class="ef__radio"><label><input type="radio" name="a-col" value="ปรับได้" checked> ปรับได้</label><label><input type="radio" name="a-col" value="ปรับไม่ได้"> ปรับไม่ได้</label></div>
        </div>
        <div class="ef__field"><label class="ef__label">เส้นทาง</label><input class="ef__input" id="a-route"></div>
        <div class="ef__field"><label class="ef__label">วันที่เริ่ม</label><input class="ef__input" type="date" id="a-date"></div>
        <div class="ef__row">
          <div class="ef__field"><label class="ef__label">ยอดรวม (บาท)</label><input class="ef__input" type="number" id="a-total" min="0"></div>
          <div class="ef__field" id="a-inst-wrap"><label class="ef__label">งวด (1-12)</label><input class="ef__input" type="number" id="a-inst" min="1" max="12" value="12"></div>
        </div>
        <div class="debt-note-box"><strong>หมายเหตุ:</strong> คนเดียวกันแต่ต่างประเภท → เพิ่มได้เลย ระบบจะแยกติดตามอิสระกัน</div>
      </div>`, { foot });
    m.ov.querySelectorAll('input[name=a-col]').forEach(r => r.onchange = () => { m.ov.querySelector('#a-inst-wrap').style.display = m.ov.querySelector('input[name=a-col]:checked').value === 'ปรับไม่ได้' ? 'none' : ''; });
    m.$('a-ok').onclick = async () => {
      const g = (id) => m.$(id).value.trim();
      const collectible = m.ov.querySelector('input[name=a-col]:checked').value;
      const date = g('a-date');
      const data = { name: g('a-name'), driverName: g('a-driver'), customer: g('a-customer'), fineType: g('a-type'), route: g('a-route'), date, total: g('a-total') || '0', installments: g('a-inst') || '12', collectible };
      if (!data.name || !data.customer || !data.fineType) { toast('ชื่อผู้รับโอน, ลูกค้า และสาเหตุ จำเป็นต้องระบุ', 'error'); return; }
      // target month: viewing a specific month → that month; viewing all → derive from start date, else current
      let targetMonth = state.month;
      if (targetMonth === 'all') { const md = date.match(/^\d{4}-(\d{2})-/); targetMonth = md ? 'M' + Number(md[1]) : currentMonthLabel(); }
      m.$('a-ok').disabled = true;
      try { await write('debt_add', Object.assign({ month: targetMonth }, data), 'เพิ่ม ' + data.name + ' แล้ว'); m.close(); }
      catch (e) { m.$('a-ok').disabled = false; }
    };
  }

  function openEditModal(d) {
    const foot = '<button class="btn btn-outline-secondary" id="e-del" style="flex:0 0 auto">ลบ</button><button class="btn btn-primary" id="e-ok" style="flex:1">บันทึก</button>';
    const m = modal('แก้ไขข้อมูล', `
      <div class="ef">
        <div class="ef__field"><label class="ef__label">ชื่อผู้รับโอน *</label><input class="ef__input" id="e-name" value="${esc(d.name)}"></div>
        <div class="ef__field"><label class="ef__label">ชื่อ พขร</label><input class="ef__input" id="e-driver" value="${esc(d.driverName || '')}"></div>
        <div class="ef__field"><label class="ef__label">ลูกค้า *</label><select class="ef__input" id="e-customer">${custOpts(d.customer || '')}</select></div>
        <div class="ef__field"><label class="ef__label">เส้นทาง</label><input class="ef__input" id="e-route" value="${esc(d.route || '')}"></div>
        <div class="ef__field"><label class="ef__label">สาเหตุ</label><select class="ef__input" id="e-type">${typeOpts(d.fineType || '')}</select></div>
        <div class="ef__row">
          <div class="ef__field"><label class="ef__label">ยอดรวม (บาท)</label><input class="ef__input" type="number" id="e-total" min="0" value="${esc(d.total)}"></div>
          <div class="ef__field"><label class="ef__label">งวด (1-12)</label><input class="ef__input" type="number" id="e-inst" min="1" max="12" value="${esc(d.totalInst)}"></div>
        </div>
      </div>`, { foot });
    m.$('e-del').onclick = () => { m.close(); confirmDelete(d); };
    m.$('e-ok').onclick = async () => {
      const g = (id) => m.$(id).value.trim();
      if (!g('e-name')) { toast('กรุณากรอกชื่อผู้รับโอน', 'error'); return; }
      if (!g('e-customer')) { toast('กรุณาเลือกลูกค้า', 'error'); return; }
      m.$('e-ok').disabled = true;
      try { await write('debt_update', { month: monthFromId(d.id), driverId: d.id, name: g('e-name'), driverName: g('e-driver'), customer: g('e-customer'), route: g('e-route'), fineType: g('e-type'), total: g('e-total') || '0', installments: g('e-inst') || '12' }, 'แก้ไขแล้ว'); m.close(); }
      catch (e) { m.$('e-ok').disabled = false; }
    };
  }

  function openPayModal(d) {
    const foot = '<button class="btn btn-primary" id="p-ok" style="flex:1">ยืนยันบันทึก</button>';
    const m = modal('บันทึกชำระเงิน', `
      <h4 class="debt-inst-heading">งวดที่ ${d.nextInst}</h4>
      <div class="debt-suggest"><small>ยอดแนะนำ</small><h3>${num(d.suggestedAmount)} ฿</h3></div>
      <div class="ef"><div class="ef__field"><label class="ef__label">จำนวนเงินที่จ่ายจริง</label><input class="ef__input" type="number" id="p-amount" min="1" value="${d.suggestedAmount || ''}"></div></div>`, { foot });
    m.$('p-ok').onclick = async () => {
      const amt = m.$('p-amount').value.trim();
      if (!(Number(amt) > 0)) { toast('จำนวนเงินไม่ถูกต้อง', 'error'); return; }
      m.$('p-ok').disabled = true;
      try { await write('debt_pay', { month: monthFromId(d.id), driverId: d.id, amount: amt, nextInst: d.nextInst }, 'บันทึกการจ่ายแล้ว'); m.close(); }
      catch (e) { m.$('p-ok').disabled = false; }
    };
  }

  function moveNon(d) {
    const foot = '<button class="btn btn-outline-secondary" data-role="cancel" style="flex:1">ยกเลิก</button><button class="btn btn-primary" id="mn-ok" style="flex:1">ย้าย</button>';
    const m = modal('ย้ายไปปรับไม่ได้', `<p class="debt-note-box" style="margin:0">ยอดคงเหลือ <b>${num(d.balance)} ฿</b> ของ <b>${esc(d.name)}</b> จะถูกย้ายไปกลุ่มปรับไม่ได้</p>`, { foot });
    m.ov.querySelector('[data-role=cancel]').onclick = m.close;
    m.$('mn-ok').onclick = async () => {
      m.$('mn-ok').disabled = true;
      try { await write('debt_setcollectible', { month: monthFromId(d.id), driverId: d.id, collectible: 'ปรับไม่ได้', date: todayDMY(), note: '' }, 'ย้ายไปปรับไม่ได้แล้ว'); m.close(); }
      catch (e) { m.$('mn-ok').disabled = false; }
    };
  }

  function moveBack(d) {
    const foot = '<button class="btn btn-outline-secondary" data-role="cancel" style="flex:1">ยกเลิก</button><button class="btn btn-primary" id="mb-ok" style="flex:1">ยืนยัน</button>';
    const m = modal('ดึงกลับมาปรับได้', `
      <div class="ef">
        <div class="ef__row">
          <div class="ef__field"><label class="ef__label">วันที่ย้อนหลัง</label><input class="ef__input" type="date" id="mb-date"></div>
          <div class="ef__field"><label class="ef__label">จำนวนงวด (1-12)</label><input class="ef__input" type="number" id="mb-inst" min="1" max="12" value="12"></div>
        </div>
        <div class="ef__field"><label class="ef__label">หมายเหตุ</label><textarea class="ef__input" id="mb-note" placeholder="เช่น เจอตัวแล้ว / เริ่มหักย้อนหลัง"></textarea></div>
      </div>`, { foot });
    m.ov.querySelector('[data-role=cancel]').onclick = m.close;
    m.$('mb-ok').onclick = async () => {
      const date = m.$('mb-date').value, inst = parseInt(m.$('mb-inst').value, 10);
      if (!date) { toast('กรุณาเลือกวันที่ย้อนหลัง', 'error'); return; }
      if (!(inst >= 1 && inst <= 12)) { toast('จำนวนงวดต้องอยู่ระหว่าง 1-12', 'error'); return; }
      m.$('mb-ok').disabled = true;
      try { await write('debt_setcollectible', { month: monthFromId(d.id), driverId: d.id, collectible: 'ปรับได้', date, note: m.$('mb-note').value.trim(), installments: inst }, 'ดึงกลับแล้ว'); m.close(); }
      catch (e) { m.$('mb-ok').disabled = false; }
    };
  }

  function confirmDelete(d) {
    const foot = '<button class="btn btn-outline-secondary" data-role="cancel" style="flex:1">ยกเลิก</button><button class="btn btn-primary" id="d-ok" style="flex:1;background:var(--color-danger);border-color:var(--color-danger)">ลบ</button>';
    const m = modal('ลบรายการนี้?', `<p class="debt-note-box" style="margin:0"><b>${esc(d.name)}</b><br>ลบแล้วกู้คืนไม่ได้ (รวมประวัติการจ่าย)</p>`, { foot });
    m.ov.querySelector('[data-role=cancel]').onclick = m.close;
    m.$('d-ok').onclick = async () => {
      m.$('d-ok').disabled = true;
      try { await write('debt_delete', { month: monthFromId(d.id), driverId: d.id }, 'ลบแล้ว'); m.close(); }
      catch (e) { m.$('d-ok').disabled = false; }
    };
  }

  // ══ import ══
  const IMPORT_HEADER = ['ลูกค้า', 'ชื่อผู้รับโอน', 'ชื่อ พขร', 'เส้นทาง', 'วันที่เริ่ม (YYYY-MM-DD)', 'ยอดรวม', 'งวด', 'สาเหตุ', 'ปรับได้/ปรับไม่ได้'];
  function openImportModal() {
    const foot = '<button class="btn btn-outline-secondary" data-role="cancel" style="flex:1">ยกเลิก</button><button class="btn btn-primary" id="i-ok" style="flex:1">เริ่มการนำเข้า</button>';
    const m = modal('Import ข้อมูลหลายรายการ', `
      <p class="debt-note-box">โหลด Template → กรอกในชีต <b>Import</b> (คอลัมน์ A "ลูกค้า" มี dropdown) → อัปโหลดกลับ</p>
      <button class="btn btn-outline-primary" id="i-tpl" style="margin:14px 0"><svg width="15" height="15" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-320 280-520l56-58 104 104v-286h80v286l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg> โหลด Template Excel</button>
      <input type="file" class="ef__input" id="i-file" accept=".xlsx,.xls">
      <div id="i-prog" class="debt-note-box" style="margin-top:12px;display:none"></div>`, { foot, lg: true });
    m.ov.querySelector('[data-role=cancel]').onclick = m.close;
    m.$('i-tpl').onclick = downloadTemplate;
    m.$('i-ok').onclick = () => runImport(m);
  }

  async function downloadTemplate() {
    try {
      if (typeof ExcelJS === 'undefined') { toast('ExcelJS ยังโหลดไม่เสร็จ', 'error'); return; }
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Import'); ws.addRow(IMPORT_HEADER); ws.getRow(1).font = { bold: true };
      ws.dataValidations.add('A2:A1001', { type: 'list', allowBlank: false, formulae: ['"' + state.customers.join(',') + '"'], showErrorMessage: true, errorStyle: 'stop', errorTitle: 'ลูกค้าไม่ถูกต้อง', error: 'กรุณาเลือกลูกค้าจากรายการเท่านั้น' });
      ws.columns.forEach((c, i) => { c.width = [16, 22, 18, 30, 22, 12, 8, 22, 16][i] || 14; });
      const sm = wb.addWorksheet('ตัวอย่าง'); sm.addRow(IMPORT_HEADER); sm.getRow(1).font = { bold: true };
      sm.addRow(['FLASH', 'สมชาย ใจดี', 'วิชัย ขับดี', 'สาย1', '2026-07-21', 5000, 12, 'ค่าปรับจราจร', 'ปรับได้']);
      sm.columns.forEach((c, i) => { c.width = [16, 22, 18, 30, 22, 12, 8, 22, 16][i] || 14; });
      const buf = await wb.xlsx.writeBuffer();
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = 'import-template.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
    } catch (e) { toast('สร้าง Template ไม่สำเร็จ: ' + e.message, 'error'); }
  }

  function runImport(m) {
    const file = m.$('i-file').files[0];
    if (!file) { toast('กรุณาเลือกไฟล์', 'error'); return; }
    if (typeof XLSX === 'undefined') { toast('ตัวอ่าน .xlsx ยังโหลดไม่เสร็จ', 'error'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
      const data = rows.slice(1).filter(r => r[1] && String(r[1]).trim() !== '').map(r => ({
        customer: String(r[0] || '').trim(), name: String(r[1] || '').trim(), driverName: String(r[2] || '').trim(),
        route: String(r[3] || '').trim(), date: String(r[4] || '').trim(), total: String(r[5] || '').trim(),
        installments: String(r[6] || '').trim() || '12', fineType: String(r[7] || '').trim(), collectible: String(r[8] || '').trim() || 'ปรับได้'
      }));
      if (!data.length) { toast('ไม่พบข้อมูลในไฟล์', 'error'); return; }
      const validSet = new Set(state.customers);
      if (data.some(d => !d.customer || !validSet.has(d.customer))) { toast('มีลูกค้าไม่อยู่ในรายการ ' + state.customers.join(', '), 'error'); return; }
      if (data.some(d => !d.fineType)) { toast('มีบางแถวไม่ระบุสาเหตุ', 'error'); return; }
      m.$('i-ok').disabled = true;
      const prog = m.$('i-prog'); prog.style.display = '';
      let done = 0, fail = 0;
      for (const row of data) {
        prog.textContent = `กำลังนำเข้า ${done + fail + 1}/${data.length}…`;
        let month = state.month;
        if (month === 'all') { const md = String(row.date).match(/^\d{4}-(\d{2})-/); month = md ? 'M' + Number(md[1]) : currentMonthLabel(); }
        try { const r = await jsonp(Object.assign({ action: 'debt_add', month }, row)); if (!r || r.ok === false) throw new Error(r && r.error); done++; }
        catch (err) { fail++; }
      }
      m.close();
      toast('นำเข้าสำเร็จ ' + done + ' รายการ' + (fail ? ' · ล้มเหลว ' + fail : ''), fail ? 'error' : 'success');
      await load(true);
    };
    reader.readAsArrayBuffer(file);
  }

  // ── misc ──
  function todayDMY() { const d = (window.FineData && FineData.nowInThailand) ? FineData.nowInThailand() : new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); }
  let toastTimer = null;
  function toast(msg, kind) {
    let t = document.getElementById('debt-toast');
    if (!t) { t = document.createElement('div'); t.id = 'debt-toast'; document.body.appendChild(t); }
    t.className = 'debt-toast is-show' + (kind === 'error' ? ' debt-toast--error' : kind === 'success' ? ' debt-toast--success' : '');
    t.textContent = msg;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('is-show'), 3200);
  }

  return { show, hide };
})();
