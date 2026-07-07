var BACKEND_CONFIG = {
  spreadsheetId: '1sF_ZHOwDGV55jA3WV_vqCh0aII_su2hFYaNmHh5xtLk',
  menuName: 'เมนูดึงข้อมูลกลาง',
  syncMenuLabel: 'ซิงค์และอัปเดตข้อมูลทุกเดือน',
  syncMenuFunction: 'executeCentralDataSync',
  healthMenuLabel: 'ตรวจสอบโครงสร้างชีต',
  healthMenuFunction: 'showBackendHealth',
  metaMenuLabel: 'แสดงสรุป metadata',
  metaMenuFunction: 'showBackendMetaPreview',
  sourceFileName: 'Google Sheet: fine database',
  timezone: 'Asia/Bangkok',
  headerRow: 1,
  defaultAction: 'data',
  includeLoanSheetsByDefault: true,
  monthlySheetPattern: /^(SUM|LOAN)\(M(\d{1,2})\)$/i,
  supportedSheetTypes: ['SUM', 'LOAN'],
  allowedVehicles: {
    '10W': true,
    '14W': true,
    '18W': true,
    '22W': true,
    '4W': true,
    '4WJ': true,
    '6W5.5': true,
    '6W6.5': true,
    '6W7.2': true,
    '6W8.8': true
  },
  fieldAliases: {
    fine_date: ['วันที่'],
    customer: ['ลูกค้า'],
    barcode: ['บาร์โค้ด'],
    route: ['เส้นทาง'],
    driver_name: ['ชื่อ พขร', 'ชื่อ'],
    receiver_name: ['ชื่อผู้รับโอน', 'ผู้รับโอน'],
    fine_amount: ['ยอดปรับ', 'ค่าปรับมาจากลูกค้า'],
    paid_amount: ['ปรับได้', 'ปรับ', 'ชำระแล้ว', 'เบิกเงินจากลูกค้า'],
    remaining_amount: ['คงเหลือ'],
    installment_flag: ['ผ่อน'],
    status: ['สถานะ'],
    reason: ['สาเหตุ']
  },
  requiredHeadersBySheetType: {
    SUM: ['fine_date', 'customer', 'barcode', 'route', 'fine_amount'],
    LOAN: ['fine_date', 'customer', 'barcode', 'route', 'fine_amount']
  },
  sourceSheetAliases: {
    SUM: ['SUM'],
    LOAN: ['LOAN', 'Loan']
  },
  monthlySources: [
    { label: 'M1', id: '' },
    { label: 'M2', id: '' },
    { label: 'M3', id: '' },
    { label: 'M4', id: '' },
    { label: 'M5', id: '' },
    { label: 'M6', id: '1DEQ2s_C2EszJ27udXkd7L1IJGo4syGUiHM4VCE-9Fh0' },
    { label: 'M7', id: '15Z8CC5Y53NVEuKy52sq1eZhdeHkXqmX2ZrXcBEGs558' },
    { label: 'M8', id: '' },
    { label: 'M9', id: '' },
    { label: 'M10', id: '' },
    { label: 'M11', id: '' },
    { label: 'M12', id: '' }
  ],
  emptyHeaders: ['วันที่', 'ลูกค้า', 'บาร์โค้ด', 'เส้นทาง', 'ชื่อ พขร', 'ชื่อผู้รับโอน', 'ยอดปรับ', 'ปรับได้', 'คงเหลือ', 'ผ่อน'],
  validRowPolicy: {
    requireAtLeastOneIdentifier: ['fine_date', 'barcode', 'route', 'driver_name', 'receiver_name'],
    requireAtLeastOneBusinessField: ['customer', 'fine_amount', 'paid_amount', 'remaining_amount']
  }
};
