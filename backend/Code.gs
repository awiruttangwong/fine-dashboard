function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(BACKEND_CONFIG.menuName)
    .addItem(BACKEND_CONFIG.syncMenuLabel, BACKEND_CONFIG.syncMenuFunction)
    .addSeparator()
    .addItem(BACKEND_CONFIG.healthMenuLabel, BACKEND_CONFIG.healthMenuFunction)
    .addItem(BACKEND_CONFIG.metaMenuLabel, BACKEND_CONFIG.metaMenuFunction)
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

function runCentralDataSync_() {
  var ssCentral = openBackendSpreadsheet_();
  var processLog = [];
  var activeSyncCount = 0;

  BACKEND_CONFIG.monthlySources.forEach(function(source) {
    if (!source.id || cleanText_(source.id) === '') return;

    activeSyncCount++;

    try {
      var sourceSs = SpreadsheetApp.openById(cleanText_(source.id));
      var sumStatus = refreshAndRebuildWarehouse_(sourceSs, 'SUM', ssCentral, 'SUM(' + source.label + ')');
      var loanStatus = refreshAndRebuildWarehouse_(sourceSs, 'LOAN', ssCentral, 'LOAN(' + source.label + ')');

      if (sumStatus && loanStatus) {
        processLog.push(source.label + ': สำเร็จ');
      } else {
        processLog.push(source.label + ': พบปัญหาโครงสร้างแผ่นงานต้นทาง');
      }
    } catch (error) {
      processLog.push(source.label + ': ล้มเหลว (สาเหตุ: ' + error.message + ')');
    }
  });

  return {
    active_sync_count: activeSyncCount,
    process_log: processLog
  };
}

function refreshAndRebuildWarehouse_(sourceSpreadsheet, sourceSheetType, centralSpreadsheet, targetSheetName) {
  var sourceSheet = findSourceSheetByType_(sourceSpreadsheet, sourceSheetType);
  if (!sourceSheet) return false;

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
    } else if (col === 10) {
      targetSheet.setColumnWidth(10, 80);
      if (targetSheetName.indexOf('SUM') !== -1 && lastRowSource > 1) {
        var checkboxRange = targetSheet.getRange(2, 10, lastRowSource - 1, 1);
        var rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
        checkboxRange.setDataValidation(rule).setHorizontalAlignment('center');
      }
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

    return output_(buildDataPayload_(params), callback);
  } catch (err) {
    return output_({
      ok: false,
      error: String(err && err.message ? err.message : err),
      stack: err && err.stack ? String(err.stack) : null
    }, callback);
  }
}

function showBackendHealth() {
  var payload = buildHealthPayload_();
  var sheetSummaries = payload.sheet_catalog.map(function(item) {
    return item.name + ' [' + item.type + '] rows=' + item.data_row_count;
  });
  SpreadsheetApp.getUi().alert(
    'Fine Database Backend',
    [
      'matched sheets: ' + payload.sheet_catalog.length,
      'warnings: ' + payload.warnings.length,
      sheetSummaries.join('\n') || '-'
    ].join('\n\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function showBackendMetaPreview() {
  var payload = buildMetaPayload_();
  SpreadsheetApp.getUi().alert(
    'Meta Preview',
    JSON.stringify({
      available_months: payload.available_months,
      sheet_catalog: payload.sheet_catalog,
      warnings: payload.warnings
    }, null, 2)
  );
}

function buildHealthPayload_() {
  var spreadsheet = openBackendSpreadsheet_();
  var discovery = discoverMonthlySheets_(spreadsheet);

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

  return {
    ok: true,
    action: 'data',
    generated_at: new Date().toISOString(),
    source: buildSourceMeta_(spreadsheet, discovery.catalog, filteredRows.length),
    rows: filteredRows,
    metrics: summarize_(filteredRows),
    available_months: getAvailableMonthsFromRows_(rows),
    available_sheet_months: getAvailableSheetMonths_(discovery.catalog),
    warnings: discovery.warnings
  };
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

function openBackendSpreadsheet_() {
  if (BACKEND_CONFIG.spreadsheetId) {
    return SpreadsheetApp.openById(BACKEND_CONFIG.spreadsheetId);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function discoverMonthlySheets_(spreadsheet) {
  var warnings = [];
  var catalog = spreadsheet.getSheets()
    .map(function(sheet) {
      return parseSheetDescriptor_(sheet);
    })
    .filter(function(item) {
      return item !== null;
    });

  if (catalog.length === 0) {
    throw new Error('ไม่พบชีตรูปแบบ SUM(Mx) หรือ LOAN(Mx) ในไฟล์ Google Sheet นี้');
  }

  catalog.forEach(function(item) {
    var validation = validateSheetHeaders_(spreadsheet.getSheetByName(item.name), item.type);
    if (validation.missing.length > 0) {
      warnings.push('Sheet ' + item.name + ' missing headers: ' + validation.missing.join(', '));
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

  var type = String(match[1] || '').toUpperCase();
  if (BACKEND_CONFIG.supportedSheetTypes.indexOf(type) === -1) return null;

  return {
    name: sheet.getName(),
    type: type,
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
  var targetType = cleanText_(params.sheet_type || params.type).toUpperCase();
  var includeLoan = parseBooleanParam_(params.include_loan, BACKEND_CONFIG.includeLoanSheetsByDefault);
  var targetSheetMonth = toNullableNumber_(params.sheet_month);

  catalog.forEach(function(descriptor) {
    if (targetType && descriptor.type !== targetType) return;
    if (!includeLoan && descriptor.type === 'LOAN') return;
    if (targetSheetMonth !== null && descriptor.sheet_month !== targetSheetMonth) return;

    var sheet = spreadsheet.getSheetByName(descriptor.name);
    var extractedRows = extractRowsFromSheet_(sheet, descriptor);
    Array.prototype.push.apply(rows, extractedRows);
  });

  return rows;
}

function extractRowsFromSheet_(sheet, descriptor) {
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow <= BACKEND_CONFIG.headerRow || lastColumn === 0) return [];

  var rangeRowCount = lastRow - BACKEND_CONFIG.headerRow;
  var values = sheet.getRange(BACKEND_CONFIG.headerRow + 1, 1, rangeRowCount, lastColumn).getValues();
  var displayValues = sheet.getRange(BACKEND_CONFIG.headerRow + 1, 1, rangeRowCount, lastColumn).getDisplayValues();
  var headerMap = resolveHeaderMap_(getHeaderRow_(sheet));
  var rows = [];

  for (var i = 0; i < values.length; i++) {
    var sourceRow = BACKEND_CONFIG.headerRow + 1 + i;
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
    paidAmount = fineAmount - remainingAmount;
  }

  var computedRemainingAmount = remainingAmount;
  if (computedRemainingAmount === null && fineAmount !== null) {
    computedRemainingAmount = fineAmount - (paidAmount || 0);
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
    installment_flag: parseBooleanCell_(getCellByField_(values, displayValues, headerMap, 'installment_flag')),
    record_status: blankToNull_(getCellByField_(values, displayValues, headerMap, 'status')),
    payment_status: 'open',
    is_full_duplicate: false,
    is_barcode_duplicate: false,
    is_driver_blank: false,
    is_receiver_blank: false,
    has_amount_mismatch: false
  };

  if (row.remaining_amount !== null && row.computed_remaining_amount !== null) {
    row.has_amount_mismatch = row.remaining_amount !== row.computed_remaining_amount;
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
    values[item.sheet_month] = true;
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
    if (normalizedStatus === 'partial') {
      return (row.source_type === 'LOAN' || row.installment_flag) ? 'partial' : 'open';
    }
  }

  if (row.has_amount_mismatch || row.fine_amount < 0 || row.paid_amount < 0) return 'data_error';
  if (row.paid_amount !== null && paid > fine) return 'overpaid';
  if (row.paid_amount !== null && fine > 0 && paid >= fine && (remaining === null || remaining <= 0)) return 'paid';
  if (row.source_type === 'LOAN' || row.installment_flag) return 'partial';
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

function parseBooleanCell_(value) {
  if (value === true || value === false) return value;
  var text = cleanText_(value).toLowerCase();
  if (!text) return false;
  return text === 'true' || text === '1' || text === 'yes' || text === 'y' || text === 'ใช่';
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
