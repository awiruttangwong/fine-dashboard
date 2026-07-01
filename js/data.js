/* ============================================================
   Fine Dashboard — Google Sheet Data Layer
   Loads canonical rows from Apps Script and keeps dashboard APIs
   ============================================================ */

const FineData = (() => {
  const ALLOWED_VEHICLES = new Set([
    '10W',
    '14W',
    '18W',
    '22W',
    '4W',
    '4WJ',
    '6W5.5',
    '6W6.5',
    '6W7.2',
    '6W8.8'
  ]);

  const DEFAULT_CONFIG = {
    gasEndpoint: '',
    useJsonp: true,
    requestTimeoutMs: 20000
  };

  let config = { ...DEFAULT_CONFIG, ...(window.FINE_DASHBOARD_CONFIG || {}) };
  let allData = [];
  let lastPayload = null;
  let isLoaded = false;

  function configure(nextConfig) {
    config = { ...config, ...(nextConfig || {}) };
  }

  async function load(nextConfig) {
    configure(nextConfig);
    const endpoint = String(config.gasEndpoint || '').trim();

    if (!endpoint) {
      throw new Error('ยังไม่ได้ตั้งค่า GAS Web App URL ใน js/api-config.js');
    }

    if (/\/home\/projects\//.test(endpoint) || /\/edit(?:\?|$)/.test(endpoint)) {
      throw new Error('gasEndpoint ต้องเป็น Apps Script Web App /exec URL ไม่ใช่ลิงก์หน้า editor');
    }

    const payload = config.useJsonp
      ? await fetchJsonp(endpoint, { action: 'data' }, config.requestTimeoutMs)
      : await fetchJson(endpoint, { action: 'data' }, config.requestTimeoutMs);

    if (!payload || payload.ok === false) {
      throw new Error((payload && payload.error) || 'โหลดข้อมูลจาก Google Sheet ไม่สำเร็จ');
    }

    lastPayload = payload;
    allData = normalizePayload(payload);
    isLoaded = true;
    return getAll();
  }

  async function fetchJson(endpoint, params, timeoutMs) {
    const url = withParams(endpoint, params);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 20000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function fetchJsonp(endpoint, params, timeoutMs) {
    return new Promise((resolve, reject) => {
      const callbackName = `fineDashboardJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('หมดเวลารอข้อมูลจาก Apps Script'));
      }, timeoutMs || 20000);

      function cleanup() {
        clearTimeout(timer);
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = (payload) => {
        cleanup();
        resolve(payload);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('โหลด Apps Script endpoint ไม่สำเร็จ'));
      };

      script.src = withParams(endpoint, { ...params, callback: callbackName, ts: Date.now() });
      document.head.appendChild(script);
    });
  }

  function withParams(endpoint, params) {
    const url = new URL(endpoint, window.location.href);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, value);
    });
    return url.toString();
  }

  function normalizePayload(payload) {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const normalized = rows
      .map((row, index) => normalizeRow(row, index + 2))
      .filter(Boolean);

    applyQualityFlags(normalized);
    return normalized;
  }

  function normalizeRow(input, fallbackSourceRow) {
    if (Array.isArray(input)) {
      return normalizeRawArray(input, fallbackSourceRow);
    }

    const row = { ...input };
    row.source_row = toNumber(row.source_row, fallbackSourceRow);
    row.source_file = row.source_file || 'Google Sheet: Fine Dashboard';
    row.source_sheet = row.source_sheet || 'data';

    const date = normalizeDate(row.fine_date || row.fine_date_raw);
    row.fine_date = row.fine_date || date.fine_date;
    row.fine_date_parse_status = row.fine_date_parse_status || date.fine_date_parse_status;
    row.fine_year = toNumber(row.fine_year, date.fine_year);
    row.fine_month = toNumber(row.fine_month, date.fine_month);
    row.fine_day = toNumber(row.fine_day, date.fine_day);

    row.customer = cleanText(row.customer).toUpperCase();
    row.barcode = cleanText(row.barcode);
    row.route_raw = cleanText(row.route_raw);

    const route = parseRoute(row.route_raw);
    row.route_group = row.route_group || route.route_group;
    row.vehicle_type = row.vehicle_type || route.vehicle_type;
    row.route_time = row.route_time || route.route_time;
    row.route_status = row.route_status || route.route_status;
    row.route_tokens = Array.isArray(row.route_tokens) ? row.route_tokens : route.route_tokens;

    row.driver_name = blankToNull(row.driver_name);
    row.transfer_receiver_name = blankToNull(row.transfer_receiver_name);
    row.fine_amount = toNullableNumber(row.fine_amount);
    row.paid_amount = toNullableNumber(row.paid_amount);
    row.remaining_amount = toNullableNumber(row.remaining_amount);
    row.computed_remaining_amount = toNullableNumber(row.computed_remaining_amount);
    if (row.computed_remaining_amount === null) {
      row.computed_remaining_amount = (row.fine_amount || 0) - (row.paid_amount || 0);
    }
    row.computed_remaining = row.computed_remaining_amount;

    row.has_amount_mismatch = Boolean(
      row.has_amount_mismatch ||
      (row.remaining_amount !== null && row.remaining_amount !== row.computed_remaining_amount)
    );
    row.is_driver_blank = !row.driver_name;
    row.is_receiver_blank = !row.transfer_receiver_name;
    row.is_full_duplicate = Boolean(row.is_full_duplicate);
    row.is_barcode_duplicate = Boolean(row.is_barcode_duplicate);
    row.raw_record_hash = row.raw_record_hash || hashRaw([
      row.fine_date_raw || row.fine_date,
      row.customer,
      row.barcode,
      row.route_raw,
      row.driver_name,
      row.transfer_receiver_name,
      row.fine_amount,
      row.paid_amount,
      row.remaining_amount
    ]);
    row.payment_status = paymentStatus(row);
    return isMeaningfulSourceRow(row) ? row : null;
  }

  function normalizeRawArray(raw, sourceRow) {
    const fineDateRaw = cleanText(raw[0]);
    const date = normalizeDate(raw[0]);
    const route = parseRoute(raw[3]);
    const fineAmount = toNullableNumber(raw[6]);
    const paidAmount = toNullableNumber(raw[7]);
    const remainingAmount = toNullableNumber(raw[8]);
    const computedRemainingAmount = (fineAmount || 0) - (paidAmount || 0);
    const hasAmountMismatch = remainingAmount !== null && remainingAmount !== computedRemainingAmount;

    const row = {
      source_file: 'Google Sheet: Fine Dashboard',
      source_sheet: 'data',
      source_row: sourceRow,
      raw_record_hash: hashRaw(raw),
      fine_date_raw: fineDateRaw,
      fine_date: date.fine_date,
      fine_date_parse_status: date.fine_date_parse_status,
      fine_year: date.fine_year,
      fine_month: date.fine_month,
      fine_day: date.fine_day,
      customer: cleanText(raw[1]).toUpperCase(),
      barcode: cleanText(raw[2]),
      route_raw: cleanText(raw[3]),
      route_group: route.route_group,
      vehicle_type: route.vehicle_type,
      route_time: route.route_time,
      route_status: route.route_status,
      route_tokens: route.route_tokens,
      driver_name: blankToNull(raw[4]),
      transfer_receiver_name: blankToNull(raw[5]),
      fine_amount: fineAmount,
      paid_amount: paidAmount,
      remaining_amount: remainingAmount,
      computed_remaining_amount: computedRemainingAmount,
      computed_remaining: computedRemainingAmount,
      payment_status: 'open',
      is_full_duplicate: false,
      is_barcode_duplicate: false,
      is_driver_blank: !blankToNull(raw[4]),
      is_receiver_blank: !blankToNull(raw[5]),
      has_amount_mismatch: hasAmountMismatch
    };

    row.payment_status = paymentStatus(row);
    return isMeaningfulSourceRow(row) ? row : null;
  }

  function applyQualityFlags(rows) {
    const rawCounts = {};
    const barcodeCounts = {};

    rows.forEach(row => {
      rawCounts[row.raw_record_hash] = (rawCounts[row.raw_record_hash] || 0) + 1;
      if (row.barcode) barcodeCounts[row.barcode] = (barcodeCounts[row.barcode] || 0) + 1;
    });

    rows.forEach(row => {
      row.is_full_duplicate = rawCounts[row.raw_record_hash] > 1;
      row.is_barcode_duplicate = Boolean(row.barcode && barcodeCounts[row.barcode] > 1);
      row.payment_status = paymentStatus(row);
    });
  }

  function normalizeDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return dateParts(value.getFullYear(), value.getMonth() + 1, value.getDate(), 'ok_excel_serial_as_is');
    }

    const text = cleanText(value);
    const dmy = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) return dateParts(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]), 'ok_text_dmy');

    const ymd = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymd) return dateParts(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]), 'ok_excel_serial_as_is');

    return {
      fine_date: null,
      fine_date_parse_status: 'invalid',
      fine_year: null,
      fine_month: null,
      fine_day: null
    };
  }

  function dateParts(year, month, day, status) {
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
      return {
        fine_date: null,
        fine_date_parse_status: 'invalid',
        fine_year: null,
        fine_month: null,
        fine_day: null
      };
    }

    return {
      fine_date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      fine_date_parse_status: status,
      fine_year: year,
      fine_month: month,
      fine_day: day
    };
  }

  function parseRoute(routeRaw) {
    const tokens = cleanText(routeRaw).split('-').filter(Boolean);
    const statusSet = new Set(['RO', 'RS1', 'RS2', 'SOCN', 'SOCE']);
    const vehicleType = tokens.find(token => ALLOWED_VEHICLES.has(token)) || null;
    const routeTime = tokens.find(token => /^\d{1,2}:\d{2}$/.test(token)) || null;
    const suffix = tokens[tokens.length - 1] || null;

    return {
      route_group: tokens[0] || null,
      vehicle_type: vehicleType,
      route_time: routeTime,
      route_status: statusSet.has(suffix) ? suffix : 'needs_review',
      route_tokens: tokens
    };
  }

  function paymentStatus(row) {
    const fine = row.fine_amount || 0;
    const paid = row.paid_amount || 0;

    if (row.has_amount_mismatch || row.fine_amount < 0 || row.paid_amount < 0) return 'data_error';
    if (row.paid_amount !== null && paid >= fine) return 'paid';
    return 'open';
  }

  function getAll() {
    return [...allData];
  }

  function getFiltered(filters) {
    return allData.filter(row => {
      if (filters.selectedMonth && row.fine_date) {
        if (!row.fine_date.startsWith(filters.selectedMonth)) return false;
      }

      if (filters.customers && filters.customers.length > 0 && !filters.customers.includes(row.customer)) return false;
      if (filters.driver && filters.driver.trim() !== '') {
        const driverQuery = filters.driver.trim().toLowerCase();
        const driverName = cleanText(row.driver_name).toLowerCase();
        if (!driverName.includes(driverQuery)) return false;
      }
      if (filters.routeGroups && filters.routeGroups.length > 0 && !filters.routeGroups.includes(row.route_group)) return false;
      if (filters.vehicleType && filters.vehicleType !== '' && row.vehicle_type !== filters.vehicleType) return false;
      if (filters.routeStatuses && filters.routeStatuses.length > 0 && !filters.routeStatuses.includes(row.route_status)) return false;
      if (filters.paymentStatuses && filters.paymentStatuses.length > 0 && !filters.paymentStatuses.includes(row.payment_status)) return false;

      if (filters.qualityFlags && filters.qualityFlags.length > 0) {
        const hasFlag = filters.qualityFlags.some(flag => {
          if (flag === 'full_duplicate')    return row.is_full_duplicate;
          if (flag === 'barcode_duplicate') return row.is_barcode_duplicate;
          if (flag === 'duplicate')         return row.is_full_duplicate || row.is_barcode_duplicate; // backwards compat
          if (flag === 'mismatch')          return row.has_amount_mismatch;
          if (flag === 'blank_driver')      return row.is_driver_blank;
          return false;
        });
        if (!hasFlag) return false;
      }

      if (filters.searchText && filters.searchText.trim() !== '') {
        const q = filters.searchText.toLowerCase();
        const searchable = [
          row.barcode,
          row.route_raw,
          row.driver_name || '',
          row.customer,
          row.fine_date,
          String(row.fine_amount)
        ].join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      return true;
    });
  }

  function getUniqueValues(field) {
    const values = new Set();
    allData.forEach(row => {
      const val = row[field];
      if (val !== null && val !== undefined && val !== '') values.add(val);
    });
    return [...values].sort((a, b) => String(a).localeCompare(String(b), 'th'));
  }

  // Current moment in Thailand (UTC+7), regardless of the host machine's
  // local timezone. Dashboard "current month" and the comparison feature
  // both derive from this so they stay correct on any server/client.
  function nowInThailand() {
    const now = new Date();
    // Convert to UTC+7: shift the timestamp so the UTC getters return the
    // wall-clock time in Bangkok.
    const offsetMs = (7 * 60 + now.getTimezoneOffset()) * 60 * 1000;
    return new Date(now.getTime() + offsetMs);
  }

  function getAvailableMonths() {
    const year = nowInThailand().getFullYear();
    return Array.from({ length: 12 }, (_, index) => {
      return `${year}-${String(index + 1).padStart(2, '0')}`;
    });
  }

  function getDefaultMonth() {
    const now = nowInThailand();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function shiftMonth(monthValue, offset) {
    const match = String(monthValue || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return getDefaultMonth();

    const date = new Date(Number(match[1]), Number(match[2]) - 1 + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function getPreviousMonth(monthValue) {
    return shiftMonth(monthValue || getDefaultMonth(), -1);
  }

  function getDefaultComparisonMonth(primaryMonth) {
    const months = getAvailableMonths();
    const primary = months.includes(primaryMonth) ? primaryMonth : getDefaultMonth();
    const primaryIndex = months.indexOf(primary);

    // Always compare against the previous month (e.g. June↔May, then
    // July↔June as the calendar rolls forward). Falls back to the next
    // month only when the primary is January (no previous month in year).
    if (primaryIndex > 0) return months[primaryIndex - 1];
    return months[primaryIndex + 1] || months[0];
  }

  function getAggregates(data) {
    const result = {
      count: data.length,
      totalFine: 0,
      totalPaid: 0,
      totalRemaining: 0,
      collectionRate: 0,
      dataIssues: 0,
      customerBreakdown: {},
      dailyTrend: {},
      driverCounts: {},
      routeGroupCounts: {},
      routeStatusCounts: {},
      paymentStatusCounts: {},
      fineAmountDistribution: {}
    };

    data.forEach(row => {
      result.totalFine += row.fine_amount || 0;
      result.totalPaid += row.paid_amount || 0;
      result.totalRemaining += row.computed_remaining_amount || 0;

      if (row.is_full_duplicate || row.is_barcode_duplicate || row.has_amount_mismatch || row.is_driver_blank) {
        result.dataIssues++;
      }

      if (row.customer) {
        if (!result.customerBreakdown[row.customer]) {
          result.customerBreakdown[row.customer] = { count: 0, fineTotal: 0, paidTotal: 0 };
        }
        result.customerBreakdown[row.customer].count++;
        result.customerBreakdown[row.customer].fineTotal += row.fine_amount || 0;
        result.customerBreakdown[row.customer].paidTotal += row.paid_amount || 0;
      }

      if (row.fine_date) {
        if (!result.dailyTrend[row.fine_date]) result.dailyTrend[row.fine_date] = { count: 0, fineTotal: 0 };
        result.dailyTrend[row.fine_date].count++;
        result.dailyTrend[row.fine_date].fineTotal += row.fine_amount || 0;
      }

      const driverKey = row.driver_name || '(ไม่ระบุ)';
      result.driverCounts[driverKey] = (result.driverCounts[driverKey] || 0) + 1;
      result.routeGroupCounts[row.route_group] = (result.routeGroupCounts[row.route_group] || 0) + 1;
      result.routeStatusCounts[row.route_status] = (result.routeStatusCounts[row.route_status] || 0) + 1;
      result.paymentStatusCounts[row.payment_status] = (result.paymentStatusCounts[row.payment_status] || 0) + 1;
      result.fineAmountDistribution[row.fine_amount] = (result.fineAmountDistribution[row.fine_amount] || 0) + 1;
    });

    result.collectionRate = result.totalFine > 0 ? (result.totalPaid / result.totalFine) * 100 : 0;
    return result;
  }

  function compareMetric(currentValue, comparisonValue) {
    const current = Number(currentValue) || 0;
    const comparison = Number(comparisonValue) || 0;
    const delta = current - comparison;

    return {
      current,
      comparison,
      delta,
      percent: comparison === 0 ? null : (delta / Math.abs(comparison)) * 100
    };
  }

  function getComparisonModel(filters) {
    const availableMonths = getAvailableMonths();
    const primaryMonth = availableMonths.includes(filters.selectedMonth)
      ? filters.selectedMonth
      : getDefaultMonth();
    const comparisonMonth = availableMonths.includes(filters.comparisonMonth) && filters.comparisonMonth !== primaryMonth
      ? filters.comparisonMonth
      : getDefaultComparisonMonth(primaryMonth);

    const primaryRows = getFiltered({ ...filters, selectedMonth: primaryMonth });
    const comparisonRows = getFiltered({ ...filters, selectedMonth: comparisonMonth });
    const primary = getAggregates(primaryRows);
    const comparison = getAggregates(comparisonRows);
    const metrics = {
      totalFine: compareMetric(primary.totalFine, comparison.totalFine),
      count: compareMetric(primary.count, comparison.count),
      totalPaid: compareMetric(primary.totalPaid, comparison.totalPaid),
      totalRemaining: compareMetric(primary.totalRemaining, comparison.totalRemaining),
      collectionRate: compareMetric(primary.collectionRate, comparison.collectionRate)
    };

    const primaryDays = Number(primaryMonth.slice(5, 7));
    const comparisonDays = Number(comparisonMonth.slice(5, 7));
    const primaryYear = Number(primaryMonth.slice(0, 4));
    const comparisonYear = Number(comparisonMonth.slice(0, 4));
    const dayCount = Math.max(
      new Date(primaryYear, primaryDays, 0).getDate(),
      new Date(comparisonYear, comparisonDays, 0).getDate()
    );
    const days = Array.from({ length: dayCount }, (_, index) => index + 1);

    function dailyValues(rows, monthValue) {
      const byDay = {};
      const year = Number(monthValue.slice(0, 4));
      const month = Number(monthValue.slice(5, 7));
      const daysInMonth = new Date(year, month, 0).getDate();
      rows.forEach(row => {
        const day = Number(row.fine_day || String(row.fine_date || '').slice(8, 10));
        if (!day) return;
        if (!byDay[day]) byDay[day] = { amount: 0, count: 0 };
        byDay[day].amount += row.fine_amount || 0;
        byDay[day].count++;
      });
      return days.map(day => day <= daysInMonth
        ? (byDay[day] || { amount: 0, count: 0 })
        : { amount: null, count: null });
    }

    const customers = new Set([
      ...Object.keys(primary.customerBreakdown),
      ...Object.keys(comparison.customerBreakdown)
    ]);
    const customerComparison = [...customers]
      .filter(customer => {
        // Drop rows with no customer name (incomplete source data) and
        // customers that have no real value in either month (all-zero /
        // empty), so the comparison view only shows meaningful entries.
        if (!customer || customer.trim() === '') return false;
        const currentData = primary.customerBreakdown[customer] || { count: 0, fineTotal: 0 };
        const comparisonData = comparison.customerBreakdown[customer] || { count: 0, fineTotal: 0 };
        const hasCurrent = currentData.count > 0 || currentData.fineTotal > 0;
        const hasComparison = comparisonData.count > 0 || comparisonData.fineTotal > 0;
        return hasCurrent || hasComparison;
      })
      .map(customer => {
        const currentData = primary.customerBreakdown[customer] || { count: 0, fineTotal: 0, paidTotal: 0 };
        const comparisonData = comparison.customerBreakdown[customer] || { count: 0, fineTotal: 0, paidTotal: 0 };
        return {
          customer,
          current: currentData,
          comparison: comparisonData,
          amount: compareMetric(currentData.fineTotal, comparisonData.fineTotal),
          count: compareMetric(currentData.count, comparisonData.count)
        };
      })
      .sort((a, b) => b.current.fineTotal - a.current.fineTotal || b.comparison.fineTotal - a.comparison.fineTotal);

    return {
      primaryMonth,
      comparisonMonth,
      primaryRows,
      comparisonRows,
      primary,
      comparison,
      metrics,
      days,
      primaryDaily: dailyValues(primaryRows, primaryMonth),
      comparisonDaily: dailyValues(comparisonRows, comparisonMonth),
      customerComparison
    };
  }

  function getDuplicateBarcodeRows(data) {
    const barcodeCounts = {};
    data.forEach(row => {
      if (!barcodeCounts[row.barcode]) barcodeCounts[row.barcode] = [];
      barcodeCounts[row.barcode].push(row);
    });

    return Object.entries(barcodeCounts)
      .filter(([, rows]) => rows.length > 1)
      .map(([barcode, rows]) => ({
        barcode,
        count: rows.length,
        rows,
        totalFine: rows.reduce((sum, row) => sum + (row.fine_amount || 0), 0)
      }))
      .sort((a, b) => b.count - a.count);
  }

  function getMismatchRows(data) {
    return data.filter(row => row.has_amount_mismatch);
  }

  function getMissingDataRows(data) {
    return data.filter(row => row.is_driver_blank || row.is_receiver_blank || row.is_full_duplicate);
  }

  function cleanText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function blankToNull(value) {
    const text = cleanText(value);
    return text ? text : null;
  }

  function isMeaningfulSourceRow(row) {
    const textFields = [
      row.fine_date_raw,
      row.fine_date,
      row.customer,
      row.barcode,
      row.route_raw,
      row.driver_name,
      row.transfer_receiver_name
    ];
    const numberFields = [
      row.fine_amount,
      row.paid_amount,
      row.remaining_amount
    ];

    return textFields.some(value => cleanText(value) !== '')
      || numberFields.some(value => value !== null && value !== undefined);
  }

  function toNullableNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    const parsed = Number(cleanText(value).replace(/,/g, ''));
    return Number.isNaN(parsed) ? null : parsed;
  }

  function toNumber(value, fallback) {
    const parsed = toNullableNumber(value);
    return parsed === null ? fallback : parsed;
  }

  function hashRaw(values) {
    const text = JSON.stringify(values.map(value => cleanText(value)));
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  }

  return {
    configure,
    load,
    getAll,
    getFiltered,
    getUniqueValues,
    getAvailableMonths,
    getDefaultMonth,
    getPreviousMonth,
    getDefaultComparisonMonth,
    nowInThailand,
    getAggregates,
    getComparisonModel,
    getDuplicateBarcodeRows,
    getMismatchRows,
    getMissingDataRows,
    getLastPayload: () => lastPayload,
    isLoaded: () => isLoaded
  };
})();
