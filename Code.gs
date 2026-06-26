const SPREADSHEET_ID = '1XTMe3z8FZ9i4XSyX_N632ZxM8otd3eeQvhTsI6kZWJc';
const SHEET_NAME = 'data';
const SOURCE_FILE = 'Google Sheet: Fine Dashboard';
const SOURCE_SHEET = 'data';

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action || 'data';

  try {
    if (action === 'health') {
      return output_({
        ok: true,
        action,
        generated_at: new Date().toISOString(),
        spreadsheet_id: SPREADSHEET_ID,
        sheet_name: SHEET_NAME
      }, params.callback);
    }

    const payload = buildDashboardPayload_();
    return output_(payload, params.callback);
  } catch (err) {
    return output_({
      ok: false,
      error: String(err && err.message ? err.message : err),
      stack: err && err.stack ? String(err.stack) : null
    }, params.callback);
  }
}

function buildDashboardPayload_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found: ' + SHEET_NAME);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return {
      ok: true,
      generated_at: new Date().toISOString(),
      source: sourceMeta_(0),
      rows: []
    };
  }

  const rowCount = lastRow - 1;
  const values = sheet.getRange(2, 1, rowCount, 9).getValues();
  const displayValues = sheet.getRange(2, 1, rowCount, 9).getDisplayValues();
  const prepared = [];

  for (let i = 0; i < values.length; i++) {
    const sourceRow = i + 2;
    const row = normalizeRow_(values[i], displayValues[i], sourceRow);
    prepared.push(row);
  }

  applyQualityFlags_(prepared);

  return {
    ok: true,
    generated_at: new Date().toISOString(),
    source: sourceMeta_(prepared.length),
    rows: prepared,
    metrics: summarize_(prepared)
  };
}

function sourceMeta_(rowCount) {
  return {
    spreadsheet_id: SPREADSHEET_ID,
    sheet_name: SHEET_NAME,
    source_file: SOURCE_FILE,
    source_sheet: SOURCE_SHEET,
    header_row: 1,
    actual_data_range: 'A1:I',
    row_count: rowCount
  };
}

function normalizeRow_(values, displayValues, sourceRow) {
  const raw = displayValues.map(function(value) {
    return trim_(value);
  });
  const normalizedDate = normalizeDate_(values[0], raw[0]);
  const routeRaw = trim_(values[3]) || raw[3];
  const route = parseRoute_(routeRaw);
  const fineAmount = parseNumber_(values[6], raw[6]);
  const paidAmount = parseNumber_(values[7], raw[7]);
  const remainingAmount = parseNumber_(values[8], raw[8]);
  const computedRemainingAmount = (fineAmount || 0) - (paidAmount || 0);
  const hasAmountMismatch = remainingAmount !== null && remainingAmount !== computedRemainingAmount;

  const row = {
    source_file: SOURCE_FILE,
    source_sheet: SOURCE_SHEET,
    source_row: sourceRow,
    raw_record_hash: hashRaw_(raw),
    fine_date_raw: raw[0],
    fine_date: normalizedDate.fine_date,
    fine_date_parse_status: normalizedDate.status,
    fine_year: normalizedDate.fine_year,
    fine_month: normalizedDate.fine_month,
    fine_day: normalizedDate.fine_day,
    customer: trim_(values[1] || raw[1]).toUpperCase(),
    barcode: trim_(values[2] || raw[2]),
    route_raw: routeRaw,
    route_group: route.route_group,
    vehicle_type: route.vehicle_type,
    route_time: route.route_time,
    route_status: route.route_status,
    route_tokens: route.route_tokens,
    driver_name: blankToNull_(values[4] || raw[4]),
    transfer_receiver_name: blankToNull_(values[5] || raw[5]),
    fine_amount: fineAmount,
    paid_amount: paidAmount,
    remaining_amount: remainingAmount,
    computed_remaining_amount: computedRemainingAmount,
    computed_remaining: computedRemainingAmount,
    payment_status: 'open',
    is_full_duplicate: false,
    is_barcode_duplicate: false,
    is_driver_blank: false,
    is_receiver_blank: false,
    has_amount_mismatch: hasAmountMismatch
  };

  row.is_driver_blank = !row.driver_name;
  row.is_receiver_blank = !row.transfer_receiver_name;
  row.payment_status = paymentStatus_(row);
  return row;
}

function applyQualityFlags_(rows) {
  const rawCounts = {};
  const barcodeCounts = {};

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

function normalizeDate_(value, displayValue) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = value.getMonth() + 1;
    const day = value.getDate();

    if (year === 2026 && day === 6 && month >= 1 && month <= 12) {
      return dateParts_(year, 6, month, 'ok_excel_serial_swapped');
    }

    return dateParts_(year, month, day, 'ok_excel_serial_as_is');
  }

  const text = trim_(displayValue || value);
  const dmy = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    return dateParts_(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]), 'ok_text_dmy');
  }

  const ymd = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) {
    return dateParts_(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]), 'ok_excel_serial_as_is');
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

function dateParts_(year, month, day, status) {
  const date = new Date(year, month - 1, day);
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
    fine_date: [
      year,
      String(month).padStart(2, '0'),
      String(day).padStart(2, '0')
    ].join('-'),
    fine_date_parse_status: status,
    status: status,
    fine_year: year,
    fine_month: month,
    fine_day: day
  };
}

function parseRoute_(routeRaw) {
  const tokens = String(routeRaw || '').split('-').filter(function(token) {
    return token !== '';
  });
  const routeGroup = tokens[0] || null;
  const vehicleSet = {
    '2WNT': true,
    '4W': true,
    '4WJ': true,
    '6W5.5': true,
    '6W6.5': true,
    '6W7.2': true,
    '6W8.8': true,
    '10W': true,
    '14W': true,
    '18W': true,
    '22W': true,
    'BTS': true
  };
  const statusSet = {
    RO: true,
    RS1: true,
    RS2: true,
    SOCN: true,
    SOCE: true
  };
  let vehicleType = null;
  let routeTime = null;

  tokens.forEach(function(token) {
    if (!vehicleType && vehicleSet[token]) vehicleType = token;
    if (!routeTime && /^\d{1,2}:\d{2}$/.test(token)) routeTime = token;
  });

  const suffix = tokens.length ? tokens[tokens.length - 1] : null;
  const routeStatus = statusSet[suffix] ? suffix : 'needs_review';

  return {
    route_group: routeGroup,
    vehicle_type: vehicleType,
    route_time: routeTime,
    route_status: routeStatus,
    route_tokens: tokens
  };
}

function paymentStatus_(row) {
  const fine = row.fine_amount || 0;
  const paid = row.paid_amount || 0;

  if (row.has_amount_mismatch || row.fine_amount < 0 || row.paid_amount < 0) return 'data_error';
  if (row.paid_amount !== null && paid > fine) return 'overpaid';
  if (row.paid_amount !== null && paid >= fine && row.computed_remaining_amount <= 0) return 'paid';
  if (row.paid_amount !== null && paid > 0 && paid < fine) return 'partial';
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

function parseNumber_(value, displayValue) {
  if (value === null || value === '') return null;
  if (typeof value === 'number' && !isNaN(value)) return value;

  const text = trim_(displayValue || value).replace(/,/g, '');
  if (!text) return null;
  const parsed = Number(text);
  return isNaN(parsed) ? null : parsed;
}

function trim_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function blankToNull_(value) {
  const text = trim_(value);
  return text ? text : null;
}

function hashRaw_(raw) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(raw),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function output_(payload, callback) {
  const body = callback
    ? String(callback).replace(/[^\w.$]/g, '') + '(' + JSON.stringify(payload) + ');'
    : JSON.stringify(payload);

  return ContentService
    .createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
