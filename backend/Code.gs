function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(BACKEND_CONFIG.menuName)
    .addItem(BACKEND_CONFIG.syncMenuLabel, BACKEND_CONFIG.syncMenuFunction)
    .addItem('ซ่อมรูปแบบวันที่ (Drivers/Payments)', 'repairAllDebtDateFormats')
    .addToUi();
}

function executeCentralDataSync() {
  var result = runCentralDataSync_();

  if (result.active_sync_count === 0) {
    SpreadsheetApp.getUi().alert('บันทึกการทำงานระบบกลาง:\nไม่พบ ID ไฟล์ต้นทางในระบบ กรุณาใส่ ID ของเดือนที่ต้องการซิงค์ข้อมูล');
    return;
  }

  SpreadsheetApp.getUi().alert('บันทึกการทำงานระบบกลาง:\n' + result.process_log.join('\n'));
}

function onEdit(e) {
  return;
}

function runCentralDataSync_() {
  var ssCentral = openBackendSpreadsheet_();
  var processLog = [];
  var activeSyncCount = 0;

  BACKEND_CONFIG.monthlySources.forEach(function(source) {
    if (!source.id || cleanText_(source.id) === '') return;

    activeSyncCount++;

    // "เตรียมชีตเปล่า" Drivers(Mx)/Payments(Mx) ให้พร้อมใช้งานทันทีที่เดือนนั้นถูกเปิดใช้
    // (เติม id ใน monthlySources แล้วกดซิงค์) ไม่ต้องรอให้มีคนกดเพิ่ม พขร. ทางหน้าเว็บก่อน
    // ถึงจะสร้างชีตขึ้นมา — แยก try/catch ของตัวเองโดยเจตนา ไม่ผูกกับผลของการ sync ข้อมูล
    // ค่าปรับ (SUM/สถานะ) ด้านล่าง เพราะเป็นคนละงานกัน ถ้า sync ค่าปรับพัง (เช่นไฟล์ต้นทาง
    // มีปัญหาโครงสร้าง) ก็ไม่ควรทำให้ชีต Drivers/Payments เดือนนั้นไม่ถูกสร้างไปด้วย —
    // ปลอดภัย ไม่ทับข้อมูลเดิม เพราะ getOrCreateDebtSheet_ แค่สร้างชีตถ้ายังไม่มี/บังคับหัว
    // คอลัมน์ให้ตรง schema เท่านั้น
    try {
      ensureDebtSheetsForMonth_(ssCentral, source.label);
    } catch (debtSheetError) {
      processLog.push(source.label + ': เตรียมชีต Drivers/Payments ล้มเหลว (สาเหตุ: ' + debtSheetError.message + ')');
    }

    try {
      var sourceSs = SpreadsheetApp.openById(cleanText_(source.id));
      var sumStatus = refreshAndRebuildWarehouse_(sourceSs, 'SUM', ssCentral, 'SUM(' + source.label + ')');
      var statusResults = syncMonthlyStatusSheets_(sourceSs, ssCentral, source.label);
      // ไม่ copy ข้อมูล Drivers/Payments จากไฟล์รายเดือนอีกต่อไป — คลังกลางเป็นแหล่งข้อมูล
      // หลักแล้ว native UI เขียนตรงเข้าคลัง ถ้ายัง copy จากไฟล์รายเดือนจะทับข้อมูลที่เพิ่ง
      // เขียนหาย

      if (sumStatus) {
        processLog.push(source.label + ': สำเร็จ' + buildStatusSyncLog_(statusResults));
      } else {
        processLog.push(source.label + ': พบปัญหาโครงสร้างแผ่นงานต้นทาง SUM');
      }
    } catch (error) {
      processLog.push(source.label + ': ล้มเหลว (สาเหตุ: ' + error.message + ')');
    }
  });

  // จัดเรียงแท็บชีตในคลังกลางให้ทุกอย่างที่เป็นเดือนเดียวกันอยู่ติดกัน เรียงจากเดือนน้อย
  // ไปมาก (M6 ก่อน แล้ว M7, M8, ...) เพื่อให้เปิดดูง่าย — ทำหลัง sync ทุกครั้งที่กดเมนู
  // "ซิงค์และอัปเดตข้อมูลทุกเดือน" แยก try/catch ของตัวเอง ไม่ให้การจัดเรียงพังแล้วทำให้
  // ผลการซิงค์ข้อมูล (ซึ่งสำคัญกว่า) ดูเหมือนล้มเหลวไปด้วย
  try {
    sortWarehouseSheetsByMonth_(ssCentral);
  } catch (sortError) {
    processLog.push('จัดเรียงลำดับชีต: ล้มเหลว (สาเหตุ: ' + sortError.message + ')');
  }

  return {
    active_sync_count: activeSyncCount,
    process_log: processLog
  };
}

// ── จัดเรียงแท็บชีตของคลังกลางตามเดือน (Mx) จากน้อยไปมาก ──
// ชื่อชีตรายเดือนทั้งหมดลงท้ายด้วย "(Mx)" เช่น SUM(M6), รอปรับ(M6), ปรับได้(M6),
// ปรับไม่ได้(M6), Drivers(M6), Payments(M6) — เก็บ "ตำแหน่ง" เดิมของกลุ่มชีตรายเดือนไว้
// (ไม่ยุ่งกับชีตอื่นที่ไม่ใช่รายเดือน เช่นชีตดูแลระบบ) แล้วแทนที่ด้วยชีตรายเดือนที่เรียง
// ตามเลขเดือนแล้ว ภายในเดือนเดียวกันคงลำดับเดิมไว้ (stable sort)
function sortWarehouseSheetsByMonth_(ss) {
  var monthlyPattern = /\(M(\d{1,2})\)\s*$/i;
  var sheets = ss.getSheets();

  var monthlyEntries = [];
  sheets.forEach(function(sheet, index) {
    var match = monthlyPattern.exec(sheet.getName());
    if (match) monthlyEntries.push({ sheet: sheet, slot: index, month: Number(match[1]) });
  });
  if (monthlyEntries.length < 2) return; // ไม่มีอะไรให้เรียง

  var sortedEntries = monthlyEntries.slice().sort(function(a, b) {
    if (a.month !== b.month) return a.month - b.month;
    return a.slot - b.slot; // เดือนเท่ากัน: คงลำดับเดิม
  });

  var desiredOrder = sheets.slice();
  monthlyEntries.forEach(function(entry, i) {
    desiredOrder[entry.slot] = sortedEntries[i].sheet;
  });

  desiredOrder.forEach(function(sheet, position) {
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(position + 1);
  });
}

function syncMonthlyStatusSheets_(sourceSpreadsheet, centralSpreadsheet, sourceLabel) {
  return BACKEND_CONFIG.statusSheetNames.map(function(sheetType) {
    var synced = refreshAndRebuildWarehouse_(
      sourceSpreadsheet,
      sheetType,
      centralSpreadsheet,
      sheetType + '(' + sourceLabel + ')',
      { required: false }
    );
    return { type: sheetType, synced: synced };
  });
}

function buildStatusSyncLog_(statusResults) {
  var summary = statusResults.map(function(result) {
    return result.type + (result.synced ? '' : ' ว่าง');
  });
  return summary.length ? ' + ' + summary.join(', ') : '';
}

function refreshAndRebuildWarehouse_(sourceSpreadsheet, sourceSheetType, centralSpreadsheet, targetSheetName, options) {
  options = options || {};
  var sourceSheet = findSourceSheetByType_(sourceSpreadsheet, sourceSheetType);
  if (!sourceSheet) {
    if (options.required === false) {
      rebuildEmptyWarehouseSheet_(centralSpreadsheet, targetSheetName);
      return false;
    }
    return false;
  }

  var targetSheet = centralSpreadsheet.getSheetByName(targetSheetName);
  if (targetSheet) {
    centralSpreadsheet.deleteSheet(targetSheet);
  }

  targetSheet = centralSpreadsheet.insertSheet(targetSheetName);

  var lastRowSource = sourceSheet.getLastRow();
  var lastColSource = sourceSheet.getLastColumn();

  if (lastRowSource < 1 || lastColSource < 1) {
    createEmptyStandardHeader_(targetSheet);
    return true;
  }

  var sourceRange = sourceSheet.getRange(1, 1, lastRowSource, lastColSource);
  var rawValues = sourceRange.getValues();
  var displayValues = sourceRange.getDisplayValues();
  var sheetMonth = extractSheetMonth_(targetSheetName);
  var syncedValues = buildSyncedWarehouseValues_(rawValues, displayValues, sheetMonth);
  enforceSyncColumnFormats_(targetSheet, lastRowSource);
  targetSheet.getRange(1, 1, lastRowSource, lastColSource).setValues(syncedValues);
  applyStrictStructuralLayout_(targetSheet, targetSheetName, lastRowSource, lastColSource);
  return true;
}

function rebuildEmptyWarehouseSheet_(centralSpreadsheet, targetSheetName) {
  var targetSheet = centralSpreadsheet.getSheetByName(targetSheetName);
  if (targetSheet) {
    centralSpreadsheet.deleteSheet(targetSheet);
  }

  targetSheet = centralSpreadsheet.insertSheet(targetSheetName);
  createEmptyStandardHeader_(targetSheet);
}

function buildSyncedWarehouseValues_(rawValues, displayValues, sheetMonth) {
  return rawValues.map(function(row, rowIndex) {
    return row.map(function(cellValue, colIndex) {
      if (rowIndex > 0 && colIndex === 0) {
        return normalizeSyncDateText_(cellValue, displayValues[rowIndex][colIndex], sheetMonth);
      }
      return cellValue;
    });
  });
}

function enforceSyncColumnFormats_(targetSheet, totalRowCount) {
  if (totalRowCount <= 1) return;
  targetSheet.getRange(2, 1, totalRowCount - 1, 1).setNumberFormat('@');
}

function normalizeSyncDateText_(rawValue, displayValue, sheetMonth) {
  var text = cleanText_(displayValue);
  if (text !== '') return text;

  var normalized = normalizeDate_(rawValue, displayValue, sheetMonth);
  if (!normalized.fine_date) return '';

  return [
    String(normalized.fine_day).padStart(2, '0'),
    String(normalized.fine_month).padStart(2, '0'),
    String(normalized.fine_year)
  ].join('/');
}

function extractSheetMonth_(sheetName) {
  var match = cleanText_(sheetName).match(/\(M(\d{1,2})\)$/i);
  return match ? Number(match[1]) : null;
}

function findSourceSheetByType_(spreadsheet, sourceSheetType) {
  var aliases = BACKEND_CONFIG.sourceSheetAliases[sourceSheetType] || [sourceSheetType];

  for (var i = 0; i < aliases.length; i++) {
    var sheet = spreadsheet.getSheetByName(aliases[i]);
    if (sheet) return sheet;
  }

  return null;
}

function createEmptyStandardHeader_(targetSheet) {
  targetSheet.getRange(1, 1, 1, BACKEND_CONFIG.emptyHeaders.length).setValues([BACKEND_CONFIG.emptyHeaders]);
  var headerRange = targetSheet.getRange(1, 1, 1, BACKEND_CONFIG.emptyHeaders.length);
  headerRange.setFontSize(11).setFontWeight('bold').setVerticalAlignment('middle').setHorizontalAlignment('center').setWrap(false);
  targetSheet.setRowHeight(1, 30);
  for (var col = 1; col <= BACKEND_CONFIG.emptyHeaders.length; col++) {
    targetSheet.setColumnWidth(col, 120);
  }
}

function applyStrictStructuralLayout_(targetSheet, targetSheetName, lastRowSource, lastColSource) {
  var headerColumns = Math.max(lastColSource, BACKEND_CONFIG.emptyHeaders.length);
  var layoutColumns = Math.min(headerColumns, BACKEND_CONFIG.emptyHeaders.length);
  var headerRange = targetSheet.getRange(1, 1, 1, layoutColumns);
  headerRange.setFontSize(11)
    .setFontWeight('bold')
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center')
    .setWrap(false);
  targetSheet.setRowHeight(1, 30);

  if (lastRowSource > 1) {
    var dataRange = targetSheet.getRange(2, 1, lastRowSource - 1, layoutColumns);
    dataRange.setWrap(false)
      .setVerticalAlignment('middle');
    targetSheet.setRowHeights(2, lastRowSource - 1, 25);
  }

  for (var col = 1; col <= headerColumns; col++) {
    targetSheet.autoResizeColumn(col);
    var currentWidth = targetSheet.getColumnWidth(col);

    if (col >= 7 && col <= 9) {
      targetSheet.setColumnWidth(col, currentWidth + 25);
    } else {
      targetSheet.setColumnWidth(col, currentWidth + 12);
    }
  }
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = cleanText_(params.action || BACKEND_CONFIG.defaultAction).toLowerCase();
  var callback = params.callback;

  try {
    if (action === 'health') {
      return output_(buildHealthPayload_(), callback);
    }

    if (action === 'meta') {
      return output_(buildMetaPayload_(), callback);
    }

    if (action === 'months') {
      return output_(buildMonthsPayload_(params), callback);
    }

    if (action === 'sync') {
      return output_(buildSyncPayload_(), callback);
    }

    // ── ระบบผ่อนชำระ พขร. (Drivers/Payments) แบบ aggregate อ่านอย่างเดียว (คงไว้) ──
    if (action === 'drivers') {
      return output_(buildDriversPayload_(params), callback);
    }

    if (action === 'payments') {
      return output_(buildPaymentsPayload_(params), callback);
    }

    // ── native debt UI: อ่าน+เขียน Drivers/Payments ตรงเข้าคลังกลาง (source of truth) ──
    // ทุก action เขียนใช้ JSONP GET ได้ (พิสูจน์แล้วว่าเขียนข้าม origin ได้จริง)
    if (action === 'debt_dashboard') {
      return output_(buildDebtDashboardPayload_(params), callback);
    }
    if (action === 'debt_add') {
      return output_(debtWrite_('add', params), callback);
    }
    if (action === 'debt_update') {
      return output_(debtWrite_('update', params), callback);
    }
    if (action === 'debt_pay') {
      return output_(debtWrite_('pay', params), callback);
    }
    if (action === 'debt_setcollectible') {
      return output_(debtWrite_('setcollectible', params), callback);
    }
    if (action === 'debt_addmore') {
      return output_(debtWrite_('addmore', params), callback);
    }
    if (action === 'debt_delete') {
      return output_(debtWrite_('delete', params), callback);
    }

    return output_(buildDataPayload_(params), callback);
  } catch (err) {
    return output_({
      ok: false,
      error: String(err && err.message ? err.message : err),
      stack: err && err.stack ? String(err.stack) : null
    }, callback);
  }
}

function buildHealthPayload_() {
  var spreadsheet = openBackendSpreadsheet_();
  var discovery = discoverMonthlySheets_(spreadsheet);
  var matchedNames = {};
  discovery.catalog.forEach(function(item) { matchedNames[item.name] = true; });
  var allSheetNames = spreadsheet.getSheets().map(function(sheet) { return sheet.getName(); });
  var unmatchedSheetNames = allSheetNames.filter(function(name) { return !matchedNames[name]; });

  return {
    ok: true,
    action: 'health',
    generated_at: new Date().toISOString(),
    source: {
      spreadsheet_id: spreadsheet.getId(),
      spreadsheet_name: spreadsheet.getName(),
      timezone: BACKEND_CONFIG.timezone
    },
    sheet_catalog: discovery.catalog,
    all_sheet_names: allSheetNames,
    unmatched_sheet_names: unmatchedSheetNames,
    warnings: discovery.warnings
  };
}

function buildMetaPayload_() {
  var spreadsheet = openBackendSpreadsheet_();
  var discovery = discoverMonthlySheets_(spreadsheet);
  var rows = collectCanonicalRows_(spreadsheet, discovery.catalog, {});

  return {
    ok: true,
    action: 'meta',
    generated_at: new Date().toISOString(),
    source: buildSourceMeta_(spreadsheet, discovery.catalog, rows.length),
    available_months: getAvailableMonthsFromRows_(rows),
    sheet_catalog: discovery.catalog,
    warnings: discovery.warnings
  };
}

function buildMonthsPayload_(params) {
  var spreadsheet = openBackendSpreadsheet_();
  var discovery = discoverMonthlySheets_(spreadsheet);
  var rows = collectCanonicalRows_(spreadsheet, discovery.catalog, params || {});

  return {
    ok: true,
    action: 'months',
    generated_at: new Date().toISOString(),
    available_months: getAvailableMonthsFromRows_(rows),
    available_sheet_months: getAvailableSheetMonths_(discovery.catalog),
    warnings: discovery.warnings
  };
}

function buildDataPayload_(params) {
  var spreadsheet = openBackendSpreadsheet_();
  var discovery = discoverMonthlySheets_(spreadsheet);
  var rows = collectCanonicalRows_(spreadsheet, discovery.catalog, params || {});

  applyQualityFlags_(rows);

  var filteredRows = filterRowsByParams_(rows, params || {});
  var statusRows = collectStatusBreakdownRows_(spreadsheet, discovery.catalog, params || {});
  var rawDriverRows = collectRawDebtRows_(spreadsheet, 'Drivers');
  var driverRows = dedupeDriverRowsById_(rawDriverRows);
  var paymentRows = collectDebtRows_(spreadsheet, 'Payments');

  var alertItems = []
    .concat(detectMonthMismatches_(rows, rawDriverRows, paymentRows))
    .concat(detectDuplicateDriverIds_(rawDriverRows));

  return {
    ok: true,
    action: 'data',
    generated_at: new Date().toISOString(),
    source: buildSourceMeta_(spreadsheet, discovery.catalog, filteredRows.length),
    rows: filteredRows,
    status_rows: statusRows,
    debt_rows: buildDebtRowsForDashboard_(driverRows),
    metrics: summarize_(filteredRows),
    available_months: getAvailableMonthsFromRows_(rows),
    available_sheet_months: getAvailableSheetMonths_(discovery.catalog),
    warnings: discovery.warnings,
    data_quality_alerts: {
      count: alertItems.length,
      items: alertItems.slice(0, 50)
    }
  };
}

// ── Driver rows แบบย่อสำหรับการ์ด KPI บน dashboard หลัก ──
// ส่ง raw rows (พร้อม month_label) แทนยอดสรุปสำเร็จรูป เพื่อให้ frontend กรองตาม
// ตัวกรองเดือน (selectedMonth) แบบเดียวกับข้อมูลค่าปรับทุกอย่างในระบบ — ใช้ได้เพราะ
// ยืนยันแล้วว่า month_label ของ Drivers คือเดือนปฏิทินจริงของ "วันที่เริ่มหนี้" ข้างใน
// เหมือน SUM(Mx)/รอปรับ(Mx)/ปรับได้(Mx)/ปรับไม่ได้(Mx) ทุกประการ (ถ้าไม่ตรง จะโดน
// ตรวจจับและแจ้งเตือนโดย detectMonthMismatches_ ด้านล่าง ไม่ใช่ปล่อยผ่านเงียบๆ)
// — หมายเหตุ: Payments(Mx) ไม่เข้ากฎนี้ ดูเหตุผลที่ detectMonthMismatches_
function buildDebtRowsForDashboard_(driverRows) {
  return driverRows.map(function(row) {
    return {
      month_label: row.month_label,
      route: row.route,
      total: row.total || 0,
      paid: row.paid || 0,
      balance: row.balance || 0,
      collectible: row.collectible,
      status: row.status,
      customer: row.customer,
      start_date: row.start_date,
      start_date_iso: row.start_iso
    };
  });
}

// แปลง 'dd/mm/yyyy...' (จาก start_date ที่บังคับ number format ไว้แล้วใน
// applyDebtDateFormat_) เป็น 'yyyy-mm-dd' ให้ frontend ใช้เป็นคีย์เดียวกับ fine_date
// ได้ตรงกัน (สำหรับรวมยอดค่าปรับรถไม่เข้ารับงานเข้ากราฟแนวโน้มรายวัน)
function debtDmyToIso_(text) {
  var m = cleanText_(text).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return null;
  var dd = ('0' + m[1]).slice(-2);
  var mm = ('0' + m[2]).slice(-2);
  var yyyy = m[3].length === 2 ? '20' + m[3] : m[3];
  return yyyy + '-' + mm + '-' + dd;
}

// แปลงวันที่เริ่มของ พขร. เป็น ISO (yyyy-mm-dd) สำหรับใช้เป็นคีย์กราฟแนวโน้มรายวัน
// แบบทนทานต่อ format: ถ้าเซลล์เป็น Date object ใช้ค่าจริง (ไม่ขึ้น locale) — กัน
// debtDmyToIso_ อ่านสลับ วัน/เดือน เมื่อ cell เผลอโชว์ m/d/yyyy จนได้ ISO เพี้ยน
// (เช่น 7/30/2026 → "2026-30-07" ที่ invalid); text ล้วนค่อย fallback ไป dd/mm/yyyy
function debtCellToIso_(rawValue, displayText) {
  if (Object.prototype.toString.call(rawValue) === '[object Date]' && !isNaN(rawValue.getTime())) {
    var y = rawValue.getFullYear();
    var mm = ('0' + (rawValue.getMonth() + 1)).slice(-2);
    var dd = ('0' + rawValue.getDate()).slice(-2);
    return y + '-' + mm + '-' + dd;
  }
  return debtDmyToIso_(displayText);
}

function extractMonthNumberFromLabel_(label) {
  var match = cleanText_(label).match(/M(\d{1,2})/i);
  return match ? Number(match[1]) : null;
}

// ไม่ปิดท้ายด้วย $ เพราะ Payments คอลัมน์ "วันที่" ใช้ฟอร์แมต 'dd/mm/yyyy hh:mm'
// (มีเวลาต่อท้าย) ต่างจาก Drivers "วันที่เริ่ม" ที่เป็น 'dd/mm/yyyy' ล้วน (ดู
// applyDebtColumnFormats_ ใน Code.merged.gs.txt) — ถ้า anchor ท้ายไว้ จะจับ
// Payments ไม่ได้เลยสักแถว ทำให้ตรวจ mismatch ฝั่ง Payments ไม่ทำงานจริง
function extractMonthFromDmyText_(text) {
  var match = cleanText_(text).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  return match ? Number(match[2]) : null;
}

// เดือนที่แท้จริงของเซลล์วันที่ "แบบทนทานต่อ format การแสดงผล": ถ้าเซลล์เป็น Date object
// (กรณีปกติที่ระบบเขียน) ใช้ getMonth() ซึ่งไม่ขึ้นกับ locale/number format เลย — จึงไม่
// ถูกหลอกว่า "เดือน 30" อีก แม้ cell จะเผลอโชว์ m/d/yyyy; เหลือ fallback ไป parse
// dd/mm/yyyy เฉพาะกรณีเซลล์เป็น text ล้วน (พิมพ์มือ/ข้อมูลเก่า) เท่านั้น
// → ตัดความเปราะบางที่ผูก detector ไว้กับ display format ออกถาวร (defense-in-depth)
function debtActualMonthFromCell_(rawValue, displayText) {
  if (Object.prototype.toString.call(rawValue) === '[object Date]' && !isNaN(rawValue.getTime())) {
    return rawValue.getMonth() + 1;
  }
  return extractMonthFromDmyText_(displayText);
}

// ── ตรวจจับความไม่ตรงกันระหว่าง "ชื่อไฟล์เดือน" (M6/M7/...) กับ "วันที่จริงข้างใน" ──
// ทั้ง 3 ชุดข้อมูล (ค่าปรับ, Drivers, Payments) ควรมีวันที่จริงตรงกับเดือนของไฟล์
// เสมอตามที่ยืนยันไว้ ถ้าไม่ตรง มักมาจาก human error ฝั่งบัญชีตอนกรอก/ย้ายชีต —
// ไม่ silent-fix ให้ แต่ส่งกลับมาเป็น alert ให้ frontend แจ้งเตือนผู้ใช้ไปตรวจสอบ
// ต้นทางแทน
function detectMonthMismatches_(fineRows, driverRows, paymentRows) {
  var items = [];

  fineRows.forEach(function(row) {
    if (!row.fine_month || !row.source_sheet_month) return;
    if (row.fine_month !== row.source_sheet_month) {
      items.push({
        source: row.source_sheet,
        expected_month: row.source_sheet_month,
        actual_month: row.fine_month,
        detail: 'แถวที่ ' + row.source_row + ' (' + (row.customer || '-') + ', ' + (row.barcode || '-') + ') วันที่จริง ' + (row.fine_date_raw || '-')
      });
    }
  });

  driverRows.forEach(function(row) {
    var expected = extractMonthNumberFromLabel_(row.month_label);
    var actual = row.start_month;
    if (expected && actual && expected !== actual) {
      items.push({
        source: 'Drivers(' + row.month_label + ')',
        expected_month: expected,
        actual_month: actual,
        detail: 'พขร. รหัส ' + row.id + ' วันที่เริ่ม ' + (row.start_date || '-')
      });
    }
  });

  // ── Payments: ห้ามเทียบ "เดือนของ timestamp" กับ "เดือนของชีต" ──
  // Payments(Mx) = ประวัติการจ่ายของ "หนี้เดือน Mx" ไม่ใช่ "เงินที่รับในเดือน Mx":
  // debtPay_ เขียนแถวลง Payments(<เดือนของหนี้>) พร้อม new Date() ของตอนกดจ่ายเสมอ
  // ดังนั้นหนี้เดือน มิ.ย. ที่ผ่อน 12 งวด ย่อมมีแถวลงวันที่ ก.ค./ส.ค./ก.ย. อยู่ใน
  // Payments(M6) เป็นเรื่องปกติที่ถูกต้อง เช็คเดิมจึงยิง alert ทุกครั้งที่จ่ายข้ามเดือน
  // และเป็น false positive ที่ผู้ใช้ "แก้ที่ต้นทางไม่ได้" (ข้อมูลไม่ได้ผิด) — ตัดออก
  // เหลือเงื่อนไขที่ผิดปกติจริงคือ "จ่ายก่อนวันที่เริ่มหนี้" (ย้อนเวลา) ซึ่งเทียบด้วย
  // ISO เต็ม yyyy-mm-dd จึงไม่พังตอนข้ามปี (หนี้ ธ.ค. จ่าย ม.ค. ปีถัดไป = ปกติ)
  var driverStartIso = {};
  driverRows.forEach(function(row) {
    if (row.id && row.start_iso) driverStartIso[row.id] = row.start_iso;
  });

  paymentRows.forEach(function(row) {
    var startIso = driverStartIso[row.driver_id];
    if (!startIso || !row.payment_iso) return;
    if (row.payment_iso >= startIso) return;
    items.push({
      source: 'Payments(' + row.month_label + ')',
      expected_month: null,
      actual_month: null,
      headline: 'วันที่จ่ายอยู่ก่อนวันที่เริ่มหนี้',
      detail: 'รหัสจ่าย ' + row.payment_id + ' วันที่ ' + (row.payment_date || '-') + ' แต่ พขร. ' + row.driver_id + ' เริ่มหนี้ ' + startIso
    });
  });

  return items;
}

function collectStatusBreakdownRows_(spreadsheet, catalog, params) {
  var result = {};

  BACKEND_CONFIG.statusSheetNames.forEach(function(type) {
    var typeParams = { sheet_type: type, sheet_month: params.sheet_month };
    var rows = collectCanonicalRows_(spreadsheet, catalog, typeParams);
    applyQualityFlags_(rows);
    result[type] = filterRowsByParams_(rows, params);
  });

  return result;
}

function buildSyncPayload_() {
  var result = runCentralDataSync_();
  return {
    ok: true,
    action: 'sync',
    generated_at: new Date().toISOString(),
    active_sync_count: result.active_sync_count,
    process_log: result.process_log
  };
}

/* ── ระบบผ่อนชำระ พขร. (Drivers/Payments): aggregate อ่านทุกเดือนรวมกัน ──
   ใช้สำหรับการ์ด KPI/โดนัทบน dashboard หลัก (รวมทุกเดือน) — อ่าน Drivers(Mx)/
   Payments(Mx) ในคลังกลางซึ่งตอนนี้ native UI เขียนตรงเข้ามาเป็น source of truth
   (ดู NATIVE DEBT MODULE ด้านล่าง) ชุดฟังก์ชันนี้อ่านอย่างเดียว */

function buildDriversPayload_(params) {
  var spreadsheet = openBackendSpreadsheet_();
  var rows = collectDebtRows_(spreadsheet, 'Drivers');
  var filteredRows = filterDebtRowsByParams_(rows, params || {});

  return {
    ok: true,
    action: 'drivers',
    generated_at: new Date().toISOString(),
    rows: filteredRows,
    metrics: summarizeDrivers_(filteredRows)
  };
}

function buildPaymentsPayload_(params) {
  var spreadsheet = openBackendSpreadsheet_();
  var rows = collectDebtRows_(spreadsheet, 'Payments');
  var filteredRows = filterDebtRowsByParams_(rows, params || {});

  return {
    ok: true,
    action: 'payments',
    generated_at: new Date().toISOString(),
    rows: filteredRows
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   NATIVE DEBT MODULE — อ่าน+เขียน Drivers(Mx)/Payments(Mx) ตรงเข้าคลังกลาง
   (source of truth) ผ่าน JSONP GET actions พอร์ตตรรกะจาก Code.merged.gs.txt
   ทุกฟังก์ชันเขียนใช้ LockService กัน race และคำนวณยอด/งวดแบบเดียวกับของเดิม
   ══════════════════════════════════════════════════════════════════════════ */

// ── month param → 'M7' (รับ '7', 'M7', 'M07', 7) ──
function resolveDebtMonthLabel_(params) {
  var raw = cleanText_((params && (params.month || params.month_label)) || '');
  if (!raw) throw new Error('ต้องระบุพารามิเตอร์ month (เช่น M7)');
  var m = raw.match(/M?0*(\d{1,2})/i);
  if (!m) throw new Error('month ไม่ถูกต้อง: ' + raw);
  var n = Number(m[1]);
  if (n < 1 || n > 12) throw new Error('month ต้องอยู่ 1-12: ' + raw);
  return 'M' + n;
}

function debtMonthNumber_(monthLabel) {
  return Number(String(monthLabel).replace(/[^0-9]/g, ''));
}

// ── get/create ชีต Drivers(Mx)/Payments(Mx) ในคลังกลาง พร้อมหัวคอลัมน์ ──
function getOrCreateDebtSheet_(ss, baseName, monthLabel, headers) {
  var name = baseName + '(' + monthLabel + ')';
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  // บังคับหัวคอลัมน์ให้ตรง schema เสมอ (row 1) — สำคัญ เพราะชีตที่เคยถูกสร้างโดย
  // sync รุ่นเก่าอาจมีหัวคอลัมน์เก่าที่ยังไม่มี "ลูกค้า" ทำให้ path ที่อ่านด้วยชื่อ
  // หัวคอลัมน์ (collectDebtRows_/aggregate) แม็ปคอลัมน์เพี้ยน ข้อมูล/data เขียนด้วย
  // ตำแหน่ง index ตายตัวอยู่แล้ว การเขียนหัวให้ตรง schema จึงปลอดภัยและทำให้ทั้งสอง
  // path (positional debt_dashboard + header-based aggregate) ตรงกันเสมอ
  var existingHeader = sheet.getLastColumn() > 0 ? sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0] : [];
  var needsHeader = existingHeader.length < headers.length ||
    headers.some(function(h, i) { return cleanText_(existingHeader[i]) !== h; });
  if (needsHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  applyDebtDateFormat_(sheet, baseName, headers);
  return sheet;
}

// ── บังคับคอลัมน์วันที่ให้แสดง วว/ดด/ปปปป เสมอ ไม่ขึ้นกับ locale ของสเปรดชีต ──
// สำคัญ: extractMonthFromDmyText_ อ่านฟิลด์ที่ 2 เป็น "เดือน" (คาดหวัง dd/mm/yyyy)
// ถ้าปล่อยให้ cell วันที่เป็น Date ที่ render ตาม locale (บางเครื่องได้ m/d/yyyy)
// parser จะอ่าน "วัน" เป็น "เดือน" เพี้ยน (เช่น 7/27/2026 → เดือน 27) — ตั้ง number
// format ตายตัวจึงกันปัญหาทั้งฝั่งแสดงผลในชีตและฝั่งตรวจ mismatch
//   Drivers "วันที่เริ่ม" = dd/mm/yyyy | Payments "วันที่" = dd/mm/yyyy hh:mm (มีเวลา)
function applyDebtDateFormat_(sheet, baseName, headers) {
  var maxRows = sheet.getMaxRows();
  if (maxRows < 2) return;
  var dateHeader = baseName === 'Payments' ? 'วันที่' : 'วันที่เริ่ม';
  var dateCol = headers.indexOf(dateHeader) + 1; // 1-based; 0 = ไม่พบ
  if (dateCol < 1) return;
  var fmt = baseName === 'Payments' ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy';
  sheet.getRange(2, dateCol, maxRows - 1, 1).setNumberFormat(fmt);
}

// คอลัมน์/ฟอร์แมตวันที่ของแต่ละชีต — แหล่งความจริงจุดเดียว ใช้ร่วมกันทั้ง format แถวเก่า
// (applyDebtDateFormat_) และ format แถวที่เพิ่ง append (formatAppendedDebtDate_)
function debtDateSpec_(baseName) {
  var isPayments = baseName === 'Payments';
  var headers = isPayments ? BACKEND_CONFIG.debtSchema.payments.headers : BACKEND_CONFIG.debtSchema.drivers.headers;
  var dateHeader = isPayments ? 'วันที่' : 'วันที่เริ่ม';
  return { col: headers.indexOf(dateHeader) + 1, fmt: isPayments ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy' };
}

// ★ จุดแก้บั๊กหลัก: หลัง appendRow ต้องบังคับ number format ของเซลล์วันที่ "แถวที่เพิ่ง
// เพิ่ม" ทันที เพราะ appendRow เพิ่มแถวใหม่เลยขอบ grid เดิมที่ applyDebtDateFormat_ ครอบ
// ไว้ (แค่ 2..getMaxRows ณ ตอนเปิดชีต) แถวใหม่จึงหลุดไปได้ default locale ของสเปรดชีต
// (เช่น m/d/yyyy hh:mm:ss แบบ US) → เป็นสาเหตุที่วันที่เพี้ยนซ้ำทุกครั้งที่จ่ายเงิน/เพิ่ม
// พขร. แม้จะเคย format ทั้งชีตแล้วก็ตาม (setNumberFormat เปลี่ยนแค่การแสดงผล ไม่แตะค่า)
function formatAppendedDebtDate_(sheet, baseName) {
  var spec = debtDateSpec_(baseName);
  if (spec.col < 1) return;
  sheet.getRange(sheet.getLastRow(), spec.col).setNumberFormat(spec.fmt);
}

// ซ่อมรูปแบบวันที่ของ "แถวเก่า" ที่เคยเพี้ยนก่อนติดตั้ง fix นี้ — ไล่ทุกชีต
// Drivers(Mx)/Payments(Mx) ที่มีอยู่แล้ว set number format ให้ทั้งคอลัมน์วันที่
// เป็น วว/ดด/ปปปป (setNumberFormat เปลี่ยนแค่การแสดงผล ไม่แตะค่าข้อมูลใดๆ)
// เรียกครั้งเดียวผ่านเมนูก็พอ — แถวใหม่หลังจากนี้ถูก formatAppendedDebtDate_ คุมอยู่แล้ว
function repairAllDebtDateFormats() {
  var ss = openBackendSpreadsheet_();
  var sheets = ss.getSheets();
  var fixed = [];
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var name = sheet.getName();
    var baseName = name.indexOf('Payments(') === 0 ? 'Payments' : (name.indexOf('Drivers(') === 0 ? 'Drivers' : null);
    if (!baseName) continue;
    var spec = debtDateSpec_(baseName);
    if (spec.col < 1) continue;
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      sheet.getRange(2, spec.col, lastRow - 1, 1).setNumberFormat(spec.fmt);
      fixed.push(name + ' (' + (lastRow - 1) + ' แถว)');
    }
  }
  try {
    SpreadsheetApp.getUi().alert('ซ่อมรูปแบบวันที่เป็น วว/ดด/ปปปป เรียบร้อย\n\n' + (fixed.length ? fixed.join('\n') : 'ไม่พบชีต Drivers/Payments'));
  } catch (e) { /* ไม่มี UI context (เช่นรันจาก trigger) ก็ข้ามการแจ้งเตือน */ }
  return fixed;
}

// ── Migration (รันครั้งเดียว): ลบคอลัมน์ 'ชื่อ พขร' ออกจากชีต Drivers(Mx) ทุกใบ ──
// โค้ดอ่าน/เขียน Drivers ด้วยตำแหน่ง index ตายตัวตาม debtSchema.drivers.headers ซึ่ง
// ตอนนี้เหลือ 13 คอลัมน์แล้ว ชีตเดิมที่ยังมี 14 คอลัมน์จึงต้องลบคอลัมน์ C ทิ้งให้ตรงกัน
// ก่อน ไม่งั้นทุกคอลัมน์หลังจากนั้นจะเลื่อนกันคนละช่อง (ยอดเงิน/สถานะเพี้ยนทั้งชีต)
//
// ปลอดภัยและ idempotent: ลบเฉพาะเมื่อหัวคอลัมน์ C เป็น 'ชื่อ พขร' จริงเท่านั้น ชีตที่
// migrate ไปแล้ว (C = 'เส้นทาง') จะถูกข้าม เรียกซ้ำกี่ครั้งก็ไม่ทำอะไรเพิ่ม
//
// รันไปแล้วบนคลังกลางจริงเมื่อ 2026-08-06 (Drivers M6/M7/M8 → 13 คอลัมน์ทั้งหมด) ผ่าน
// action ชั่วคราวที่ถอดออกจาก doGet แล้ว — คงฟังก์ชันไว้สำหรับชีตเดือนใหม่ที่อาจถูก
// สร้างจาก template เก่า เรียกได้จาก Apps Script editor โดยตรง (Run > migrateDropDriverNameColumn)
function migrateDropDriverNameColumn() {
  var ss = openBackendSpreadsheet_();
  var sheets = ss.getSheets();
  var result = { migrated: [], skipped: [] };

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var name = sheet.getName();
    if (name.indexOf('Drivers(') !== 0) continue;
    if (sheet.getLastColumn() < 3) { result.skipped.push(name + ' (คอลัมน์ไม่ครบ)'); continue; }

    var headerC = cleanText_(sheet.getRange(1, 3).getDisplayValue());
    var changed = false;
    if (headerC === 'ชื่อ พขร') {
      sheet.deleteColumn(3);
      changed = true;
    }

    // เก็บกวาดคอลัมน์ส่วนเกินท้ายชีต เผื่อกรณีที่หัวคอลัมน์ถูก getOrCreateDebtSheet_
    // เขียนทับด้วย schema ใหม่ (13 ช่อง) ไปก่อนที่ migration จะได้รัน — ชีตจะเหลือ
    // คอลัมน์ที่ 14 ค้างอยู่พร้อมหัวเก่า ลบทิ้งเฉพาะคอลัมน์ที่ "ไม่มีข้อมูลสักแถว"
    var want = BACKEND_CONFIG.debtSchema.drivers.headers.length;
    while (sheet.getLastColumn() > want && debtColumnHasNoData_(sheet, sheet.getLastColumn())) {
      sheet.deleteColumn(sheet.getLastColumn());
      changed = true;
    }

    if (changed) {
      result.migrated.push(name + ' (เหลือ ' + sheet.getLastColumn() + ' คอลัมน์, ' + Math.max(0, sheet.getLastRow() - 1) + ' แถวข้อมูล)');
    } else {
      result.skipped.push(name + ' (C = "' + headerC + '", ' + sheet.getLastColumn() + ' คอลัมน์ — ตรง schema แล้ว)');
    }
  }

  // เขียนหัวคอลัมน์ให้ตรง schema ใหม่ + ตั้ง number format ของคอลัมน์วันที่ที่เลื่อนตำแหน่ง
  BACKEND_CONFIG.monthlySources.forEach(function(source) {
    if (ss.getSheetByName('Drivers(' + source.label + ')')) getDebtDriversSheet_(ss, source.label);
  });

  return result;
}

// คอลัมน์นี้ไม่มีข้อมูลเลยสักแถวหรือไม่ (นับเฉพาะแถวข้อมูล 2..lastRow ไม่นับหัวคอลัมน์)
function debtColumnHasNoData_(sheet, col) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return true;
  var values = sheet.getRange(2, col, lastRow - 1, 1).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    if (cleanText_(values[i][0]) !== '') return false;
  }
  return true;
}

// แปลง 'YYYY-MM-DD' (จาก <input type=date> ฝั่ง frontend) เป็น Date object เพื่อให้
// number format dd/mm/yyyy มีผล — สร้างจากส่วนประกอบด้วย new Date(y, m-1, d) กันปัญหา
// timezone (new Date('2026-06-05') = UTC เที่ยงคืน อาจเลื่อนวันในบาง tz) ถ้าค่าไม่ใช่
// ISO (ว่าง หรือส่งมาเป็น dd/mm/yyyy อยู่แล้ว) คืนค่าเดิมเป็น text ไม่ดัดแปลง
function parseDebtDate_(v) {
  var s = cleanText_(v);
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return s;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function getDebtDriversSheet_(ss, monthLabel) {
  return getOrCreateDebtSheet_(ss, 'Drivers', monthLabel, BACKEND_CONFIG.debtSchema.drivers.headers);
}

function getDebtPaymentsSheet_(ss, monthLabel) {
  return getOrCreateDebtSheet_(ss, 'Payments', monthLabel, BACKEND_CONFIG.debtSchema.payments.headers);
}

// ── เรียกจาก runCentralDataSync_ ทุกครั้งที่ซิงค์ เพื่อให้ Drivers(Mx)/Payments(Mx)
// ของเดือนที่เพิ่งเปิดใช้ (เติม id ใน monthlySources) ถูกสร้างพร้อมหัวคอลัมน์ทันที
// ไม่ต้องรอให้มีคนกดเพิ่ม พขร. ทางหน้าเว็บก่อน — idempotent, ไม่แตะแถวข้อมูลเดิม ──
function ensureDebtSheetsForMonth_(ss, monthLabel) {
  getDebtDriversSheet_(ss, monthLabel);
  getDebtPaymentsSheet_(ss, monthLabel);
}

// อ่าน Drivers/Payments ของเดือนหนึ่งเข้า array (ไม่สร้างชีตถ้า readOnly = สำหรับ view
// รวมทุกเดือน จะได้ไม่สร้างชีตเปล่า 12 ใบ) — คืน [] ถ้าไม่มีชีต/ว่าง
function readDebtMonthDrivers_(ss, monthLabel, createIfMissing) {
  var driverSheet = createIfMissing ? getDebtDriversSheet_(ss, monthLabel) : ss.getSheetByName('Drivers(' + monthLabel + ')');
  if (!driverSheet) return [];
  var paymentSheet = createIfMissing ? getDebtPaymentsSheet_(ss, monthLabel) : ss.getSheetByName('Payments(' + monthLabel + ')');

  var driversDisplay = driverSheet.getDataRange().getDisplayValues();
  var driversRaw = driverSheet.getDataRange().getValues();
  var payments = paymentSheet ? paymentSheet.getDataRange().getValues() : [];

  var data = [];
  for (var i = 1; i < driversDisplay.length; i++) {
    var row = driversDisplay[i];
    var rawRow = driversRaw[i];
    var driverId = cleanText_(row[0]);
    if (!driverId) continue;

    // index อ้างตาม debtSchema.drivers.headers (13 คอลัมน์ หลังถอด 'ชื่อ พขร' ออก):
    // 0 รหัส | 1 ชื่อผู้รับโอน | 2 เส้นทาง | 3 วันที่เริ่ม | 4 ยอดรวม | 5 จำนวนงวด |
    // 6 ชำระแล้ว | 7 คงเหลือ | 8 สถานะ | 9 สาเหตุ | 10 ปรับได้/ปรับไม่ได้ | 11 ประวัติการย้าย | 12 ลูกค้า
    var totalInst = parseInt(row[5], 10) || 12;
    var balance = Number(rawRow[7]) || 0;
    var total = Number(rawRow[4]) || 0;
    var paid = Number(rawRow[6]) || 0;
    var dPayments = payments.filter(function(p) { return String(p[1]) === String(driverId); });
    var remainingInst = totalInst - dPayments.length;
    var suggestedAmount = 0;
    if (remainingInst > 0 && balance > 0) suggestedAmount = Math.ceil(balance / remainingInst);

    // "คืบหน้า" (paidInstallments) ต้องสื่อความหมายเป็น "จ่ายไปแล้วกี่งวดเทียบเป็นยอดเงิน"
    // ไม่ใช่ "จ่ายมากี่ครั้ง" (nextInst-1) — เพราะถ้าผู้ใช้จ่ายยอดไม่ตรงงวดแนะนำ (จ่าย
    // ก้อนเดียวจบ/จ่ายย่อยเกินจำนวนงวด) ตัวนับครั้งจะเพี้ยนจากยอดเงินจริง (เช่น จ่ายครบ
    // ในทีเดียวจะค้างที่ 1/N ทั้งที่ควรเป็น N/N) — คำนวณจากสัดส่วนยอดที่จ่ายจริงต่อยอด
    // ต่องวด (total/totalInst) แทน แล้ว cap ไม่ให้เกิน totalInst (จ่ายเกินงวดที่ตั้งไว้ก็ยัง
    // แสดงไม่เกิน N/N) และบังคับเป็น N/N เสมอเมื่อ balance<=0 กันปัดเศษหลุดกรอบ
    var installmentUnit = totalInst > 0 ? (total / totalInst) : 0;
    var paidInstallments = installmentUnit > 0 ? Math.round(paid / installmentUnit) : 0;
    paidInstallments = Math.max(0, Math.min(totalInst, paidInstallments));
    if (balance <= 0 && total > 0) paidInstallments = totalInst;

    data.push({
      id: driverId, month_label: monthLabel, name: row[1], route: row[2],
      startDate: row[3], total: total, paid: paid, balance: balance,
      totalInst: totalInst, nextInst: dPayments.length + 1, paidInstallments: paidInstallments, suggestedAmount: suggestedAmount,
      status: row[8], fineType: row[9] || '', collectible: row[10] || 'ปรับได้', log: row[11] || '', customer: row[12] || ''
    });
  }
  return data;
}

// ── READ: dashboard — month = 'M7' (เดือนเดียว) หรือ 'all'/ว่าง (รวมทุกเดือน) ──
function buildDebtDashboardPayload_(params) {
  var monthRaw = cleanText_((params && (params.month || params.month_label)) || '');
  var isAll = !monthRaw || monthRaw.toLowerCase() === 'all';
  var ss = openBackendSpreadsheet_();

  var data;
  if (isAll) {
    data = [];
    BACKEND_CONFIG.monthlySources.forEach(function(src) {
      Array.prototype.push.apply(data, readDebtMonthDrivers_(ss, src.label, false));
    });
  } else {
    data = readDebtMonthDrivers_(ss, resolveDebtMonthLabel_(params), true);
  }

  return {
    ok: true,
    action: 'debt_dashboard',
    month: isAll ? 'all' : resolveDebtMonthLabel_(params),
    generated_at: new Date().toISOString(),
    drivers: data,
    customers: BACKEND_CONFIG.debtCustomers,
    fine_types: BACKEND_CONFIG.debtFineTypes,
    status_options: BACKEND_CONFIG.debtStatusOptions,
    collectible_options: BACKEND_CONFIG.debtCollectibleOptions,
    topDebtors: data.filter(function(d) { return d.balance > 0; })
      .sort(function(a, b) { return b.balance - a.balance; }).slice(0, 5),
    summary: {
      totalPaid: data.reduce(function(s, d) { return s + d.paid; }, 0),
      totalBalance: data.reduce(function(s, d) { return s + d.balance; }, 0),
      countActive: data.filter(function(d) { return d.balance > 0; }).length,
      countDone: data.filter(function(d) { return d.balance <= 0; }).length
    }
  };
}

function debtNum_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var n = parseFloat(cleanText_(v).replace(/,/g, ''));
  return isFinite(n) ? n : 0;
}

// ── WRITE dispatcher (LockService กัน race ทุก op) ──
function debtWrite_(op, params) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var monthLabel = resolveDebtMonthLabel_(params);
    var ss = openBackendSpreadsheet_();
    var driverSheet = getDebtDriversSheet_(ss, monthLabel);

    if (op === 'add') return debtAddDriver_(driverSheet, monthLabel, params);
    if (op === 'update') return debtUpdateDriver_(driverSheet, params);
    if (op === 'addmore') return debtAddMore_(driverSheet, params);
    if (op === 'setcollectible') return debtSetCollectible_(driverSheet, params);
    if (op === 'pay') return debtPay_(ss, driverSheet, monthLabel, params);
    if (op === 'delete') return debtDeleteDriver_(ss, driverSheet, monthLabel, params);
    throw new Error('unknown debt op: ' + op);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

// id ไม่ซ้ำข้ามเดือน: D-<เดือน>-<ลำดับ> เช่น D-7-101 (Payments อ้าง id นี้)
// ห้ามใช้ getLastRow()+offset เพราะหลังลบแถว lastRow จะหด → id ซ้ำกับที่ยังอยู่
// (ทำให้จ่าย/แก้/ลบไปโดนคนผิด) จึงหา "เลขลำดับสูงสุดที่เคยใช้ในเดือนนี้" แล้ว +1
// ให้เป็น monotonic ไม่ย้อนกลับแม้จะลบแถวไปแล้ว
function debtNewDriverId_(driverSheet, monthLabel) {
  var prefix = 'D-' + debtMonthNumber_(monthLabel) + '-';
  var lastRow = driverSheet.getLastRow();
  var maxSeq = 100; // floor: first id becomes prefix + 101
  if (lastRow > 1) {
    var ids = driverSheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (var i = 0; i < ids.length; i++) {
      var id = cleanText_(ids[i][0]);
      if (id.indexOf(prefix) === 0) {
        var seq = parseInt(id.slice(prefix.length), 10);
        if (isFinite(seq) && seq > maxSeq) maxSeq = seq;
      }
    }
  }
  return prefix + (maxSeq + 1);
}

function debtAddDriver_(driverSheet, monthLabel, p) {
  var name = cleanText_(p.name);
  var customer = cleanText_(p.customer);
  var fineType = cleanText_(p.fineType);
  if (!name) throw new Error('ต้องระบุชื่อผู้รับโอน');
  if (!customer) throw new Error('ต้องระบุลูกค้า');
  if (BACKEND_CONFIG.debtCustomers.indexOf(customer) === -1) throw new Error('ลูกค้าไม่อยู่ในรายการ: ' + customer);
  if (!fineType) throw new Error('ต้องระบุสาเหตุ');

  var total = debtNum_(p.total);
  var collectible = cleanText_(p.collectible) || 'ปรับได้';
  var installments = cleanText_(p.collectible) === 'ปรับไม่ได้' ? 1 : (parseInt(cleanText_(p.installments).replace(/,/g, ''), 10) || 12);
  var id = debtNewDriverId_(driverSheet, monthLabel);

  driverSheet.appendRow([
    id, name, cleanText_(p.route), parseDebtDate_(p.date),
    total, installments, 0, total, 'กำลังผ่อน', fineType, collectible, '', customer
  ]);
  formatAppendedDebtDate_(driverSheet, 'Drivers'); // บังคับ วว/ดด/ปปปป บนแถวใหม่
  return { ok: true, action: 'debt_add', month: monthLabel, id: id, message: 'เพิ่ม ' + name + ' เรียบร้อย' };
}

function debtFindRowById_(driverSheet, driverId) {
  var data = driverSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(driverId)) return { rowIndex: i + 1, values: data[i] };
  }
  return null;
}

function debtUpdateDriver_(driverSheet, p) {
  var found = debtFindRowById_(driverSheet, cleanText_(p.driverId));
  if (!found) throw new Error('ไม่พบรหัส ' + cleanText_(p.driverId));
  var customer = cleanText_(p.customer);
  if (!customer) throw new Error('ต้องระบุลูกค้า');
  if (BACKEND_CONFIG.debtCustomers.indexOf(customer) === -1) throw new Error('ลูกค้าไม่อยู่ในรายการ: ' + customer);

  var paid = Number(found.values[6]) || 0;
  var total = debtNum_(p.total);
  var balance = Math.max(0, total - paid);
  var r = found.rowIndex;
  driverSheet.getRange(r, 2).setValue(cleanText_(p.name));
  driverSheet.getRange(r, 3).setValue(cleanText_(p.route));
  driverSheet.getRange(r, 5).setValue(total);
  driverSheet.getRange(r, 6).setValue(parseInt(cleanText_(p.installments), 10) || 12);
  driverSheet.getRange(r, 8).setValue(balance);
  driverSheet.getRange(r, 9).setValue(balance <= 0 ? 'ชำระครบแล้ว' : 'กำลังผ่อน');
  driverSheet.getRange(r, 10).setValue(cleanText_(p.fineType));
  driverSheet.getRange(r, 13).setValue(customer);
  return { ok: true, action: 'debt_update', id: cleanText_(p.driverId) };
}

function debtAddMore_(driverSheet, p) {
  var found = debtFindRowById_(driverSheet, cleanText_(p.driverId));
  if (!found) throw new Error('ไม่พบรหัส ' + cleanText_(p.driverId));
  var amount = debtNum_(p.amount);
  var r = found.rowIndex;
  var oldTotal = Number(found.values[4]) || 0;
  var oldBalance = Number(found.values[7]) || 0;
  driverSheet.getRange(r, 5).setValue(oldTotal + amount);
  driverSheet.getRange(r, 8).setValue(oldBalance + amount);
  driverSheet.getRange(r, 9).setValue('กำลังผ่อน');
  return { ok: true, action: 'debt_addmore', id: cleanText_(p.driverId) };
}

function debtSetCollectible_(driverSheet, p) {
  var found = debtFindRowById_(driverSheet, cleanText_(p.driverId));
  if (!found) throw new Error('ไม่พบรหัส ' + cleanText_(p.driverId));
  var collectible = cleanText_(p.collectible);
  if (BACKEND_CONFIG.debtCollectibleOptions.indexOf(collectible) === -1) throw new Error('สถานะปรับไม่ถูกต้อง');
  var r = found.rowIndex;
  var balance = Number(found.values[7]) || 0;
  var line = '[' + cleanText_(p.date) + '] → ' + collectible + ' (คงเหลือ ' + balance + ')' + (cleanText_(p.note) ? ' ' + cleanText_(p.note) : '');
  var old = cleanText_(found.values[11]);
  driverSheet.getRange(r, 11).setValue(collectible);
  driverSheet.getRange(r, 12).setValue(old ? old + '\n' + line : line);
  if (cleanText_(p.installments)) driverSheet.getRange(r, 6).setValue(parseInt(cleanText_(p.installments), 10));
  return { ok: true, action: 'debt_setcollectible', id: cleanText_(p.driverId), collectible: collectible };
}

function debtPay_(ss, driverSheet, monthLabel, p) {
  var found = debtFindRowById_(driverSheet, cleanText_(p.driverId));
  if (!found) throw new Error('ไม่พบรหัส ' + cleanText_(p.driverId));
  var payAmt = debtNum_(p.amount);
  if (!(payAmt > 0)) throw new Error('จำนวนเงินไม่ถูกต้อง');

  var totalFine = Number(found.values[4]) || 0;
  var currentPaid = Number(found.values[6]) || 0;
  var newPaid = currentPaid + payAmt;
  var newBalance = Math.max(0, totalFine - newPaid);
  var r = found.rowIndex;

  var paymentSheet = getDebtPaymentsSheet_(ss, monthLabel);
  paymentSheet.appendRow(['P-' + new Date().getTime(), cleanText_(p.driverId), cleanText_(p.nextInst), payAmt, new Date(), 'WebApp']);
  formatAppendedDebtDate_(paymentSheet, 'Payments'); // บังคับ วว/ดด/ปปปป hh:mm บนแถวใหม่
  driverSheet.getRange(r, 7).setValue(newPaid);
  driverSheet.getRange(r, 8).setValue(newBalance);
  driverSheet.getRange(r, 9).setValue(newBalance <= 0 ? 'ชำระครบแล้ว' : 'กำลังผ่อน');
  return { ok: true, action: 'debt_pay', id: cleanText_(p.driverId), new_balance: newBalance };
}

function debtDeleteDriver_(ss, driverSheet, monthLabel, p) {
  var driverId = cleanText_(p.driverId);
  var found = debtFindRowById_(driverSheet, driverId);
  if (!found) throw new Error('ไม่พบรหัส ' + driverId);
  driverSheet.deleteRow(found.rowIndex);

  // ลบประวัติการจ่ายของคนนี้ด้วย (ไล่จากล่างขึ้นบนกัน index เลื่อน)
  var paymentSheet = getDebtPaymentsSheet_(ss, monthLabel);
  var pays = paymentSheet.getDataRange().getValues();
  for (var i = pays.length - 1; i >= 1; i--) {
    if (String(pays[i][1]) === String(driverId)) paymentSheet.deleteRow(i + 1);
  }
  return { ok: true, action: 'debt_delete', id: driverId };
}

// รหัส พขร. ควรมีแถวเดียวในทั้งระบบเสมอ (คนละความหมายกับ Payments ที่มีได้หลายแถว
// ต่อคนตามงวด, และไม่มีฟีเจอร์ "ยกยอด/คัดลอก" ข้ามเดือนใน Code.merged.gs.txt เลย —
// การมี id ซ้ำข้ามไฟล์เดือนจึงเป็น human error เท่านั้น) ถ้าเจอซ้ำ dedupe ที่นี่กัน
// ไม่ให้ยอดถูกนับซ้ำในทุกจุดที่ใช้ collectDebtRows_ (dashboard, action=drivers)
// โดยอัตโนมัติ — ส่วนการแจ้งเตือนให้ไปตรวจ/ลบที่ต้นทาง ดู detectDuplicateDriverIds_
function collectDebtRows_(centralSpreadsheet, sheetName) {
  var rows = collectRawDebtRows_(centralSpreadsheet, sheetName);
  return sheetName === 'Drivers' ? dedupeDriverRowsById_(rows) : rows;
}

function collectRawDebtRows_(centralSpreadsheet, sheetName) {
  var rows = [];

  BACKEND_CONFIG.monthlySources.forEach(function(source) {
    var sheet = centralSpreadsheet.getSheetByName(sheetName + '(' + source.label + ')');
    if (!sheet) return;

    var lastRow = sheet.getLastRow();
    var lastColumn = sheet.getLastColumn();
    if (lastRow <= BACKEND_CONFIG.headerRow || lastColumn === 0) return;

    // อ่านหัวตาราง + ข้อมูลในการอ่านชุดเดียว (แถวแรก = header) เลี่ยงการยิงอ่าน header
    // แยกด้วย getHeaderRow_ อีกหนึ่ง round-trip ต่อชีต
    var region = sheet.getRange(BACKEND_CONFIG.headerRow, 1, lastRow - BACKEND_CONFIG.headerRow + 1, lastColumn);
    var values = region.getValues();
    var displayValues = region.getDisplayValues();
    var headerMap = resolveDebtHeaderMap_(displayValues[0]);

    for (var i = 1; i < values.length; i++) {
      var row = normalizeDebtRow_(sheetName, values[i], displayValues[i], headerMap, source.label);
      if (row) rows.push(row);
    }
  });

  return rows;
}

// เลือกแถวจากไฟล์เดือนล่าสุดไว้เมื่อ id ซ้ำกัน (heuristic เดียวที่สมเหตุสมผลที่สุด:
// ไฟล์เดือนล่าสุดมักเป็นสำเนาที่อัปเดตล่าสุด) — ไม่ได้แปลว่าถูกเสมอ จึงต้องมี alert
// คู่กันเพื่อให้มนุษย์ไปตรวจสอบ/ลบแถวเก่าที่ต้นทางจริงด้วย
function dedupeDriverRowsById_(rows) {
  var latestById = {};

  rows.forEach(function(row) {
    var existing = latestById[row.id];
    var rowMonth = extractMonthNumberFromLabel_(row.month_label) || 0;
    var existingMonth = existing ? (extractMonthNumberFromLabel_(existing.month_label) || 0) : -1;
    if (!existing || rowMonth > existingMonth) {
      latestById[row.id] = row;
    }
  });

  return Object.keys(latestById).map(function(id) {
    return latestById[id];
  });
}

// ── ตรวจจับรหัส พขร. ที่ปรากฏซ้ำมากกว่า 1 ไฟล์เดือน ──
// ต้องรับ "raw" rows (ก่อน dedupe) เข้ามา ไม่งั้นจะไม่มีอะไรให้ตรวจเจอเลย เพราะ
// collectDebtRows_ ปกติ dedupe ให้แล้วโดยอัตโนมัติ (เห็นแค่ 1 แถวต่อ id เสมอ)
function detectDuplicateDriverIds_(rawDriverRows) {
  var byId = {};
  rawDriverRows.forEach(function(row) {
    if (!byId[row.id]) byId[row.id] = [];
    byId[row.id].push(row);
  });

  var items = [];
  Object.keys(byId).forEach(function(id) {
    var entries = byId[id];
    if (entries.length < 2) return;

    var months = entries.map(function(row) { return row.month_label; });
    var kept = dedupeDriverRowsById_(entries)[0];

    items.push({
      source: 'Drivers',
      expected_month: null,
      actual_month: null,
      detail: 'รหัส ' + id + ' ซ้ำกันใน ' + months.join(', ') + ' — dashboard ใช้ยอดจาก ' + kept.month_label + ' เท่านั้น รบกวนตรวจสอบและลบแถวซ้ำที่ต้นทาง'
    });
  });

  return items;
}

function resolveDebtHeaderMap_(headers) {
  var normalizedHeaders = headers.map(normalizeHeader_);
  var map = {};

  Object.keys(BACKEND_CONFIG.debtFieldAliases).forEach(function(field) {
    var aliases = BACKEND_CONFIG.debtFieldAliases[field];
    for (var i = 0; i < aliases.length; i++) {
      var normalizedAlias = normalizeHeader_(aliases[i]);
      var index = normalizedHeaders.indexOf(normalizedAlias);
      if (index !== -1) {
        map[field] = index;
        break;
      }
    }
  });

  return map;
}

function normalizeDebtRow_(sheetName, values, displayValues, headerMap, monthLabel) {
  if (sheetName === 'Drivers') {
    var id = cleanText_(getCellByField_(values, displayValues, headerMap, 'id'));
    if (!id) return null;

    return {
      source_type: 'Drivers',
      month_label: monthLabel,
      id: id,
      receiver_name: blankToNull_(getCellByField_(values, displayValues, headerMap, 'receiver_name')),
      route: blankToNull_(getCellByField_(values, displayValues, headerMap, 'route')),
      start_date: cleanText_(getCellByField_(values, displayValues, headerMap, 'start_date')),
      // ค่า derived แบบทนทานต่อ format (คำนวณจาก Date object ดิบตั้งแต่ตอนอ่าน) เพื่อให้
      // ทั้ง detector และกราฟใช้ต่อได้โดยไม่ต้องพึ่งการแสดงผลของเซลล์ (number/string สะอาด
      // ไม่พก Date object ไปรั่วใน output ของ action=drivers)
      start_month: debtActualMonthFromCell_(getRawValueByField_(values, headerMap, 'start_date'), cleanText_(getCellByField_(values, displayValues, headerMap, 'start_date'))),
      start_iso: debtCellToIso_(getRawValueByField_(values, headerMap, 'start_date'), cleanText_(getCellByField_(values, displayValues, headerMap, 'start_date'))),

      total: toNullableNumber_(getValueForNumberField_(values, displayValues, headerMap, 'total')),
      installments: toNullableNumber_(getValueForNumberField_(values, displayValues, headerMap, 'installments')),
      paid: toNullableNumber_(getValueForNumberField_(values, displayValues, headerMap, 'paid')),
      balance: toNullableNumber_(getValueForNumberField_(values, displayValues, headerMap, 'balance')),
      status: blankToNull_(getCellByField_(values, displayValues, headerMap, 'status')),
      reason: blankToNull_(getCellByField_(values, displayValues, headerMap, 'reason')),
      collectible: blankToNull_(getCellByField_(values, displayValues, headerMap, 'collectible')),
      move_log: blankToNull_(getCellByField_(values, displayValues, headerMap, 'move_log')),
      customer: blankToNull_(getCellByField_(values, displayValues, headerMap, 'customer'))
    };
  }

  var paymentId = cleanText_(getCellByField_(values, displayValues, headerMap, 'payment_id'));
  if (!paymentId) return null;

  return {
    source_type: 'Payments',
    month_label: monthLabel,
    payment_id: paymentId,
    driver_id: blankToNull_(getCellByField_(values, displayValues, headerMap, 'driver_id')),
    installment_no: toNullableNumber_(getValueForNumberField_(values, displayValues, headerMap, 'installment_no')),
    amount: toNullableNumber_(getValueForNumberField_(values, displayValues, headerMap, 'amount')),
    payment_date: cleanText_(getCellByField_(values, displayValues, headerMap, 'payment_date')),
    // วันที่จ่ายแบบ ISO เต็ม (ทนทานต่อ format เพราะคำนวณจาก Date object ดิบ) — detector
    // ใช้ตัวนี้เทียบกับ start_iso ของ พขร. โดยตรง ไม่เทียบ "เดือน" ลอยๆ อีกต่อไป
    // (เดือนอย่างเดียวเทียบข้ามปีไม่ได้ ดู detectMonthMismatches_)
    payment_iso: debtCellToIso_(getRawValueByField_(values, headerMap, 'payment_date'), cleanText_(getCellByField_(values, displayValues, headerMap, 'payment_date'))),

    source: blankToNull_(getCellByField_(values, displayValues, headerMap, 'source'))
  };
}

function filterDebtRowsByParams_(rows, params) {
  var month = cleanText_(params.month);
  var collectible = cleanText_(params.collectible);
  var status = cleanText_(params.status);
  var driverId = cleanText_(params.driver_id);

  return rows.filter(function(row) {
    if (month && row.month_label !== month) return false;
    if (collectible && row.collectible !== collectible) return false;
    if (status && row.status !== status) return false;
    if (driverId && row.driver_id !== driverId && row.id !== driverId) return false;
    return true;
  });
}

function summarizeDrivers_(rows) {
  return rows.reduce(function(summary, row) {
    summary.count += 1;
    summary.total_balance += row.balance || 0;
    summary.total_paid += row.paid || 0;
    if (row.collectible === 'ปรับได้') summary.count_collectible += 1;
    if (row.collectible === 'ปรับไม่ได้') summary.count_non_collectible += 1;
    if (row.status === 'ชำระครบแล้ว') {
      summary.count_done += 1;
    } else {
      summary.count_active += 1;
    }
    return summary;
  }, {
    count: 0,
    total_balance: 0,
    total_paid: 0,
    count_active: 0,
    count_done: 0,
    count_collectible: 0,
    count_non_collectible: 0
  });
}

function openBackendSpreadsheet_() {
  if (BACKEND_CONFIG.spreadsheetId) {
    return SpreadsheetApp.openById(BACKEND_CONFIG.spreadsheetId);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function discoverMonthlySheets_(spreadsheet) {
  var directDiscovery = discoverDirectSheets_(spreadsheet);
  if (directDiscovery.catalog.length > 0) {
    return directDiscovery;
  }

  var warnings = [];
  var catalog = [];

  // วนชีตครั้งเดียว: จับ descriptor และตรวจ header ด้วย sheet object ที่ถืออยู่แล้ว
  // (เดิม parseSheetDescriptor_ ทิ้ง sheet ไปแล้ว validate ต้อง getSheetByName ใหม่ต่อชีต
  // ~12 ครั้ง — เลี่ยงได้ทั้งหมด)
  spreadsheet.getSheets().forEach(function(sheet) {
    var descriptor = parseSheetDescriptor_(sheet);
    if (!descriptor) return;
    catalog.push(descriptor);
    // ข้ามการอ่าน+ตรวจ header ของชีตว่าง (เดือนใหม่ที่ยังไม่มีข้อมูล) — ไม่มีข้อมูลให้
    // อ่านผิดพลาดอยู่แล้ว การเตือน header ที่ชีตว่างจึงไม่มีประโยชน์ และประหยัด round-trip
    // ต่อเดือนใหม่ที่เปิดไว้ล่วงหน้าแต่ยังไม่มีรายการ
    if (descriptor.data_row_count <= 0) return;
    var validation = validateSheetHeaders_(sheet, descriptor.type);
    if (validation.missing.length > 0) {
      warnings.push('Sheet ' + descriptor.name + ' missing headers: ' + validation.missing.join(', '));
    }
  });

  if (catalog.length === 0) {
    throw new Error('ไม่พบชีท SUM(Mx), รอปรับ(Mx), ปรับได้(Mx) หรือ ปรับไม่ได้(Mx) ในไฟล์ Google Sheet นี้');
  }

  return {
    catalog: catalog,
    warnings: warnings
  };
}

function discoverDirectSheets_(spreadsheet) {
  var warnings = [];
  var catalog = [];

  BACKEND_CONFIG.supportedSheetTypes.forEach(function(type) {
    var aliases = BACKEND_CONFIG.sourceSheetAliases[type] || [type];
    for (var i = 0; i < aliases.length; i++) {
      var sheet = spreadsheet.getSheetByName(aliases[i]);
      if (!sheet || sheet.getLastColumn() === 0) continue;

      var descriptor = {
        name: sheet.getName(),
        type: type,
        mode: 'direct',
        sheet_month: null,
        header_row: BACKEND_CONFIG.headerRow,
        data_row_count: Math.max(sheet.getLastRow() - BACKEND_CONFIG.headerRow, 0),
        last_column: sheet.getLastColumn()
      };
      catalog.push(descriptor);

      var validation = validateSheetHeaders_(sheet, type);
      if (validation.missing.length > 0) {
        warnings.push('Sheet ' + descriptor.name + ' missing headers: ' + validation.missing.join(', '));
      }
      break;
    }
  });

  return {
    catalog: catalog,
    warnings: warnings
  };
}

function parseSheetDescriptor_(sheet) {
  var match = sheet.getName().match(BACKEND_CONFIG.monthlySheetPattern);
  if (!match) return null;

  var type = normalizeSheetType_(match[1]);
  if (BACKEND_CONFIG.supportedSheetTypes.indexOf(type) === -1) return null;

  return {
    name: sheet.getName(),
    type: type,
    mode: 'monthly',
    sheet_month: Number(match[2]),
    header_row: BACKEND_CONFIG.headerRow,
    data_row_count: Math.max(sheet.getLastRow() - BACKEND_CONFIG.headerRow, 0),
    last_column: sheet.getLastColumn()
  };
}

function validateSheetHeaders_(sheet, sheetType) {
  var headers = getHeaderRow_(sheet);
  var headerMap = resolveHeaderMap_(headers);
  var required = BACKEND_CONFIG.requiredHeadersBySheetType[sheetType] || [];
  var missing = required.filter(function(field) {
    return headerMap[field] === undefined;
  });

  return {
    header_map: headerMap,
    missing: missing
  };
}

function normalizeSheetType_(value) {
  var text = cleanText_(value);
  return text.toUpperCase() === 'SUM' ? 'SUM' : text;
}

function getHeaderRow_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) return [];
  return sheet.getRange(BACKEND_CONFIG.headerRow, 1, 1, lastColumn).getDisplayValues()[0];
}

function resolveHeaderMap_(headers) {
  var normalizedHeaders = headers.map(normalizeHeader_);
  var map = {};

  Object.keys(BACKEND_CONFIG.fieldAliases).forEach(function(field) {
    var aliases = BACKEND_CONFIG.fieldAliases[field];
    for (var i = 0; i < aliases.length; i++) {
      var normalizedAlias = normalizeHeader_(aliases[i]);
      var index = normalizedHeaders.indexOf(normalizedAlias);
      if (index !== -1) {
        map[field] = index;
        break;
      }
    }
  });

  return map;
}

function normalizeHeader_(value) {
  return cleanText_(value).toLowerCase().replace(/\s+/g, ' ');
}

function collectCanonicalRows_(spreadsheet, catalog, params) {
  var rows = [];
  var targetType = normalizeSheetType_(params.sheet_type || params.type) || 'SUM';
  var targetSheetMonth = toNullableNumber_(params.sheet_month);

  catalog.forEach(function(descriptor) {
    if (targetType && descriptor.type !== targetType) return;
    if (targetSheetMonth !== null && descriptor.sheet_month !== targetSheetMonth) return;

    var sheet = spreadsheet.getSheetByName(descriptor.name);
    var extractedRows = extractRowsFromSheet_(sheet, descriptor);
    Array.prototype.push.apply(rows, extractedRows);
  });

  return rows;
}

function extractRowsFromSheet_(sheet, descriptor) {
  // ใช้ metadata ที่ discovery อ่านมาแล้ว (last_column / data_row_count) แทนการเรียก
  // getLastRow()/getLastColumn() ซ้ำอีกครั้งต่อชีต — แต่ละครั้งเป็น round-trip ไปเซิร์ฟเวอร์
  // และข้ามชีตว่าง (เดือนใหม่ที่ยังไม่มีข้อมูล เช่น SUM(M8) 0 แถว) โดยไม่ต้องอ่านเลย
  var lastColumn = descriptor.last_column != null ? descriptor.last_column : sheet.getLastColumn();
  var dataRowCount = descriptor.data_row_count != null
    ? descriptor.data_row_count
    : Math.max(sheet.getLastRow() - BACKEND_CONFIG.headerRow, 0);
  if (dataRowCount <= 0 || lastColumn === 0) return [];

  // อ่านหัวตาราง + ข้อมูลในการอ่านชุดเดียว (แถวแรกของ region คือ header) เพื่อไม่ต้อง
  // ยิงอ่าน header แยกอีกรอบด้วย getHeaderRow_ — getValues/getDisplayValues เป็น round-trip
  // ที่จำเป็นต้องเรียกอยู่แล้ว จึงรวมหัวตารางเข้าไปในนั้นแทนการอ่านซ้ำ
  var region = sheet.getRange(BACKEND_CONFIG.headerRow, 1, dataRowCount + 1, lastColumn);
  var values = region.getValues();
  var displayValues = region.getDisplayValues();
  var headerMap = resolveHeaderMap_(displayValues[0]);
  var rows = [];

  for (var i = 1; i < values.length; i++) {
    var sourceRow = BACKEND_CONFIG.headerRow + i;
    var row = normalizeSheetRow_(values[i], displayValues[i], headerMap, descriptor, sourceRow);
    if (row) rows.push(row);
  }

  return rows;
}

function normalizeSheetRow_(values, displayValues, headerMap, descriptor, sourceRow) {
  var rawDate = getCellByField_(values, displayValues, headerMap, 'fine_date');
  var normalizedDate = normalizeDate_(getRawValueByField_(values, headerMap, 'fine_date'), rawDate, descriptor.sheet_month);
  var routeRaw = getCellByField_(values, displayValues, headerMap, 'route');
  var route = parseRoute_(routeRaw);
  var customer = cleanText_(getCellByField_(values, displayValues, headerMap, 'customer')).toUpperCase();
  var barcode = cleanText_(getCellByField_(values, displayValues, headerMap, 'barcode'));
  var fineAmount = toNullableNumber_(getValueForNumberField_(values, displayValues, headerMap, 'fine_amount'));
  var paidAmount = toNullableNumber_(getValueForNumberField_(values, displayValues, headerMap, 'paid_amount'));
  var remainingAmount = toNullableNumber_(getValueForNumberField_(values, displayValues, headerMap, 'remaining_amount'));

  if (paidAmount === null && fineAmount !== null && remainingAmount !== null) {
    paidAmount = fineAmount + remainingAmount;
  }

  var computedRemainingAmount = null;
  if (fineAmount !== null) {
    computedRemainingAmount = fineAmount - (paidAmount || 0);
  } else if (remainingAmount !== null) {
    computedRemainingAmount = remainingAmount;
  }

  var row = {
    source_file: BACKEND_CONFIG.sourceFileName,
    source_sheet: descriptor.name,
    source_row: sourceRow,
    source_type: descriptor.type,
    source_sheet_month: descriptor.sheet_month,
    raw_record_hash: hashRaw_(displayValues),
    fine_date_raw: rawDate,
    fine_date: normalizedDate.fine_date,
    fine_date_parse_status: normalizedDate.status,
    fine_year: normalizedDate.fine_year,
    fine_month: normalizedDate.fine_month,
    fine_day: normalizedDate.fine_day,
    customer: customer,
    barcode: barcode,
    route_raw: routeRaw,
    route_group: route.route_group,
    vehicle_type: route.vehicle_type,
    route_time: route.route_time,
    route_status: route.route_status,
    route_tokens: route.route_tokens,
    driver_name: blankToNull_(getCellByField_(values, displayValues, headerMap, 'driver_name')),
    transfer_receiver_name: blankToNull_(getCellByField_(values, displayValues, headerMap, 'receiver_name')),
    reason: blankToNull_(getCellByField_(values, displayValues, headerMap, 'reason')),
    fine_amount: fineAmount,
    paid_amount: paidAmount,
    remaining_amount: remainingAmount,
    computed_remaining_amount: computedRemainingAmount,
    computed_remaining: computedRemainingAmount,
    record_status: blankToNull_(getCellByField_(values, displayValues, headerMap, 'status')),
    payment_status: 'open',
    is_full_duplicate: false,
    is_barcode_duplicate: false,
    is_driver_blank: false,
    is_receiver_blank: false,
    has_amount_mismatch: false
  };

  if (row.remaining_amount !== null && row.computed_remaining_amount !== null) {
    row.has_amount_mismatch = row.remaining_amount !== -row.computed_remaining_amount;
  }

  row.is_driver_blank = !row.driver_name;
  row.is_receiver_blank = !row.transfer_receiver_name;
  row.payment_status = paymentStatus_(row);

  return isMeaningfulBusinessRow_(row) ? row : null;
}

function getCellByField_(values, displayValues, headerMap, field) {
  var index = headerMap[field];
  if (index === undefined) return '';
  return cleanText_(displayValues[index] !== undefined ? displayValues[index] : values[index]);
}

function getRawValueByField_(values, headerMap, field) {
  var index = headerMap[field];
  if (index === undefined) return null;
  return values[index];
}

function getValueForNumberField_(values, displayValues, headerMap, field) {
  var index = headerMap[field];
  if (index === undefined) return null;
  return values[index] !== '' && values[index] !== null ? values[index] : displayValues[index];
}

function isMeaningfulBusinessRow_(row) {
  var policy = BACKEND_CONFIG.validRowPolicy;

  var hasIdentifier = policy.requireAtLeastOneIdentifier.some(function(field) {
    var value = row[field];
    if (typeof value === 'number') return !isNaN(value);
    return cleanText_(value) !== '';
  });

  var hasBusinessField = policy.requireAtLeastOneBusinessField.some(function(field) {
    var value = row[field];
    if (typeof value === 'number') return !isNaN(value);
    return cleanText_(value) !== '';
  });

  return hasIdentifier && hasBusinessField;
}

function filterRowsByParams_(rows, params) {
  var month = cleanText_(params.month);
  var customer = cleanText_(params.customer).toUpperCase();
  var paymentStatus = cleanText_(params.payment_status || params.status).toLowerCase();

  return rows.filter(function(row) {
    if (month && (!row.fine_date || row.fine_date.indexOf(month) !== 0)) return false;
    if (customer && row.customer !== customer) return false;
    if (paymentStatus && row.payment_status !== paymentStatus) return false;
    return true;
  });
}

function applyQualityFlags_(rows) {
  var rawCounts = {};
  var barcodeCounts = {};

  rows.forEach(function(row) {
    rawCounts[row.raw_record_hash] = (rawCounts[row.raw_record_hash] || 0) + 1;
    if (row.barcode) barcodeCounts[row.barcode] = (barcodeCounts[row.barcode] || 0) + 1;
  });

  rows.forEach(function(row) {
    row.is_full_duplicate = rawCounts[row.raw_record_hash] > 1;
    row.is_barcode_duplicate = !!row.barcode && barcodeCounts[row.barcode] > 1;
    row.payment_status = paymentStatus_(row);
  });
}

function buildSourceMeta_(spreadsheet, catalog, rowCount) {
  return {
    spreadsheet_id: spreadsheet.getId(),
    spreadsheet_name: spreadsheet.getName(),
    source_file: BACKEND_CONFIG.sourceFileName,
    sheet_catalog: catalog,
    header_row: BACKEND_CONFIG.headerRow,
    row_count: rowCount
  };
}

function getAvailableMonthsFromRows_(rows) {
  var months = {};
  rows.forEach(function(row) {
    if (row.fine_year && row.fine_month) {
      var key = row.fine_year + '-' + String(row.fine_month).padStart(2, '0');
      months[key] = true;
    }
  });
  return Object.keys(months).sort();
}

function getAvailableSheetMonths_(catalog) {
  var values = {};
  catalog.forEach(function(item) {
    if (item.sheet_month !== null && item.sheet_month !== undefined && !isNaN(item.sheet_month)) {
      values[item.sheet_month] = true;
    }
  });
  return Object.keys(values).map(function(value) {
    return Number(value);
  }).sort(function(a, b) {
    return a - b;
  });
}

function normalizeDate_(value, displayValue, monthHint) {
  var text = cleanText_(displayValue || value);
  var ymd = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) {
    return dateParts_(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]), 'ok_text_ymd');
  }

  var slashDate = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashDate) {
    var first = Number(slashDate[1]);
    var second = Number(slashDate[2]);
    var year = Number(slashDate[3]);
    var hinted = resolveHintedDateParts_(first, second, year, monthHint);
    if (hinted) return hinted;

    if (first > 12 && second <= 12) {
      return dateParts_(year, second, first, 'ok_text_dmy');
    }

    if (second > 12 && first <= 12) {
      return dateParts_(year, first, second, 'ok_text_mdy');
    }

    return dateParts_(year, second, first, 'ok_text_dmy_fallback');
  }

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return dateParts_(value.getFullYear(), value.getMonth() + 1, value.getDate(), 'ok_excel_serial_as_is');
  }

  return {
    fine_date: null,
    fine_date_parse_status: 'invalid',
    status: 'invalid',
    fine_year: null,
    fine_month: null,
    fine_day: null
  };
}

function resolveHintedDateParts_(first, second, year, monthHint) {
  if (!monthHint) return null;

  var hintedMonth = Number(monthHint);
  if (!hintedMonth || hintedMonth < 1 || hintedMonth > 12) return null;

  if (first === hintedMonth && second !== hintedMonth) {
    return dateParts_(year, first, second, 'ok_text_mdy_sheet_hint');
  }

  if (second === hintedMonth && first !== hintedMonth) {
    return dateParts_(year, second, first, 'ok_text_dmy_sheet_hint');
  }

  if (first === hintedMonth && second === hintedMonth) {
    return dateParts_(year, second, first, 'ok_text_dmy_same_hint');
  }

  return null;
}

function dateParts_(year, month, day, status) {
  var date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
    return {
      fine_date: null,
      fine_date_parse_status: 'invalid',
      status: 'invalid',
      fine_year: null,
      fine_month: null,
      fine_day: null
    };
  }

  return {
    fine_date: [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-'),
    fine_date_parse_status: status,
    status: status,
    fine_year: year,
    fine_month: month,
    fine_day: day
  };
}

function parseRoute_(routeRaw) {
  var tokens = cleanText_(routeRaw).split('-').filter(function(token) {
    return token !== '';
  });
  var statusSet = {
    RO: true,
    RS1: true,
    RS2: true,
    SOCN: true,
    SOCE: true
  };
  var vehicleType = null;
  var routeTime = null;

  tokens.forEach(function(token) {
    if (!vehicleType && BACKEND_CONFIG.allowedVehicles[token]) vehicleType = token;
    if (!routeTime && /^\d{1,2}:\d{2}$/.test(token)) routeTime = token;
  });

  var suffix = tokens.length ? tokens[tokens.length - 1] : null;

  return {
    route_group: tokens[0] || null,
    vehicle_type: vehicleType,
    route_time: routeTime,
    route_status: statusSet[suffix] ? suffix : 'needs_review',
    route_tokens: tokens
  };
}

function paymentStatus_(row) {
  var fine = row.fine_amount || 0;
  var paid = row.paid_amount || 0;
  var remaining = row.computed_remaining_amount;

  if (row.record_status) {
    var normalizedStatus = cleanText_(row.record_status).toLowerCase();
    if (normalizedStatus === 'paid' || normalizedStatus === 'open') {
      return normalizedStatus;
    }
    if (normalizedStatus === 'partial') return 'open';
  }

  if (row.has_amount_mismatch || row.fine_amount < 0 || row.paid_amount < 0) return 'data_error';
  if (row.paid_amount !== null && fine > 0 && paid >= fine && (remaining === null || remaining <= 0)) return 'paid';
  return 'open';
}

function summarize_(rows) {
  return rows.reduce(function(summary, row) {
    summary.fine_count += 1;
    summary.total_fine_amount += row.fine_amount || 0;
    summary.paid_amount += row.paid_amount || 0;
    summary.computed_remaining_amount += row.computed_remaining_amount || 0;
    if (row.is_full_duplicate || row.is_barcode_duplicate || row.has_amount_mismatch || row.is_driver_blank) {
      summary.data_quality_issue_count += 1;
    }
    return summary;
  }, {
    fine_count: 0,
    total_fine_amount: 0,
    paid_amount: 0,
    computed_remaining_amount: 0,
    data_quality_issue_count: 0
  });
}

function cleanText_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function blankToNull_(value) {
  var text = cleanText_(value);
  return text ? text : null;
}

function toNullableNumber_(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && !isNaN(value)) return value;
  var parsed = Number(cleanText_(value).replace(/,/g, ''));
  return isNaN(parsed) ? null : parsed;
}

function parseBooleanParam_(value, fallback) {
  var text = cleanText_(value).toLowerCase();
  if (!text) return fallback;
  if (text === 'true' || text === '1' || text === 'yes') return true;
  if (text === 'false' || text === '0' || text === 'no') return false;
  return fallback;
}

function hashRaw_(raw) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(raw),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(byte) {
    var value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function output_(payload, callback) {
  var body = callback
    ? String(callback).replace(/[^\w.$]/g, '') + '(' + JSON.stringify(payload) + ');'
    : JSON.stringify(payload);

  return ContentService
    .createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
