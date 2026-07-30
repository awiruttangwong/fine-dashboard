var BACKEND_CONFIG = {
  spreadsheetId: '1sF_ZHOwDGV55jA3WV_vqCh0aII_su2hFYaNmHh5xtLk',
  menuName: 'เมนูดึงข้อมูลกลาง',
  syncMenuLabel: 'ซิงค์และอัปเดตข้อมูลทุกเดือน',
  syncMenuFunction: 'executeCentralDataSync',
  sourceFileName: 'Google Sheet: fine database',
  timezone: 'Asia/Bangkok',
  headerRow: 1,
  defaultAction: 'data',
  statusSheetNames: ['รอปรับ', 'ปรับได้', 'ปรับไม่ได้'],
  monthlySheetPattern: /^(SUM|รอปรับ|ปรับได้|ปรับไม่ได้)\(M(\d{1,2})\)$/i,
  supportedSheetTypes: ['SUM', 'รอปรับ', 'ปรับได้', 'ปรับไม่ได้'],
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
    fine_amount: ['ยอดปรับ', 'ยอดปรับรวม', 'ค่าปรับมาจากลูกค้า'],
    paid_amount: ['ปรับได้', 'ผ่อนแล้ว', 'ปรับ', 'ชำระแล้ว', 'เบิกเงินจากลูกค้า'],
    remaining_amount: ['คงเหลือ'],
    status: ['สถานะ'],
    reason: ['สาเหตุ']
  },
  requiredHeadersBySheetType: {
    SUM: ['fine_date', 'customer', 'barcode', 'route', 'fine_amount'],
    'รอปรับ': ['fine_date', 'customer', 'barcode', 'route', 'fine_amount'],
    'ปรับได้': ['fine_date', 'customer', 'barcode', 'route', 'fine_amount'],
    'ปรับไม่ได้': ['fine_date', 'customer', 'barcode', 'route', 'fine_amount']
  },
  sourceSheetAliases: {
    SUM: ['SUM'],
    'รอปรับ': ['รอปรับ'],
    'ปรับได้': ['ปรับได้'],
    'ปรับไม่ได้': ['ปรับไม่ได้']
  },
  // ── ระบบผ่อนชำระ พขร. (Drivers/Payments) ──
  // สถาปัตยกรรมใหม่: คลังกลาง (warehouse) เป็น "แหล่งข้อมูลหลัก" ของ Drivers/Payments
  // — native UI บน dashboard หลักอ่าน+เขียนตรงเข้าชีต Drivers(Mx)/Payments(Mx) ในคลัง
  // กลางผ่าน JSONP actions (ดู debtWrite/debtRead ใน Code.gs) ไม่ผ่าน index.html/iframe
  // อีกต่อไป จึงไม่ copy Drivers/Payments จากไฟล์รายเดือนเข้าคลังแล้ว (ไฟล์รายเดือนเก็บ
  // เฉพาะข้อมูลค่าปรับ 6 ลูกค้า → SUM/สถานะ ต่อไป)
  debtSheetNames: ['Drivers', 'Payments'],
  // schema ชีตในคลังกลาง — ลูกค้าเป็นคอลัมน์ที่ 14 (index 13) ต่อท้าย ห้ามแทรกกลาง
  // เพราะโค้ดอ้างคอลัมน์ด้วยตำแหน่ง index (ตรงกับ DEBT_SCHEMA เดิมใน Code.merged)
  debtSchema: {
    drivers: {
      name: 'Drivers',
      headers: ['รหัส', 'ชื่อผู้รับโอน', 'ชื่อ พขร', 'เส้นทาง', 'วันที่เริ่ม', 'ยอดรวม', 'จำนวนงวด', 'ชำระแล้ว', 'คงเหลือ', 'สถานะ', 'สาเหตุ', 'ปรับได้/ปรับไม่ได้', 'ประวัติการย้าย', 'ลูกค้า']
    },
    payments: {
      name: 'Payments',
      headers: ['รหัสการจ่าย', 'รหัส พขร.', 'งวดที่', 'จำนวนเงิน', 'วันที่', 'ที่มา']
    }
  },
  // แหล่งความจริงจุดเดียวของรายชื่อลูกค้า 6 ราย (เดิมอยู่ที่ SHIPPING_CONFIG.sources ใน
  // Code.merged — ย้ายมาไว้ที่ backend กลางเพราะ native UI เรียกจากที่นี่)
  debtCustomers: ['FLASH', 'SPX', 'KEX', 'BEST', 'J&T', 'SGT'],
  debtStatusOptions: ['กำลังผ่อน', 'ชำระครบแล้ว'],
  debtCollectibleOptions: ['ปรับได้', 'ปรับไม่ได้'],
  debtFineTypes: ['ค่าปรับรถไม่เข้ารับงาน', 'ค่าปรับไม่ส่งรถเข้ารับงาน', 'ค่าปรับจราจร', 'ค่าเสียหายรถ', 'ค่าใช้จ่ายอื่นๆ'],
  debtFieldAliases: {
    id: ['รหัส'],
    receiver_name: ['ชื่อผู้รับโอน'],
    driver_name: ['ชื่อ พขร'],
    route: ['เส้นทาง'],
    start_date: ['วันที่เริ่ม'],
    total: ['ยอดรวม'],
    installments: ['จำนวนงวด'],
    paid: ['ชำระแล้ว'],
    balance: ['คงเหลือ'],
    status: ['สถานะ'],
    reason: ['สาเหตุ'],
    collectible: ['ปรับได้/ปรับไม่ได้'],
    move_log: ['ประวัติการย้าย'],
    customer: ['ลูกค้า'],
    payment_id: ['รหัสการจ่าย'],
    driver_id: ['รหัส พขร.'],
    installment_no: ['งวดที่'],
    amount: ['จำนวนเงิน'],
    payment_date: ['วันที่'],
    source: ['ที่มา']
  },
  monthlySources: [
    { label: 'M1', id: '' },
    { label: 'M2', id: '' },
    { label: 'M3', id: '' },
    { label: 'M4', id: '' },
    { label: 'M5', id: '' },
    { label: 'M6', id: '1DEQ2s_C2EszJ27udXkd7L1IJGo4syGUiHM4VCE-9Fh0' },
    { label: 'M7', id: '15Z8CC5Y53NVEuKy52sq1eZhdeHkXqmX2ZrXcBEGs558' },
    { label: 'M8', id: '173rdnYB8xT92abBkTOCIsxZFcDTSaKCYWjc6Y7exIV8' },
    { label: 'M9', id: '' },
    { label: 'M10', id: '' },
    { label: 'M11', id: '' },
    { label: 'M12', id: '' }
  ],
  emptyHeaders: ['วันที่', 'ลูกค้า', 'บาร์โค้ด', 'เส้นทาง', 'ชื่อ พขร', 'ชื่อผู้รับโอน', 'ยอดปรับ', 'ปรับได้', 'คงเหลือ'],
  validRowPolicy: {
    requireAtLeastOneIdentifier: ['fine_date', 'barcode', 'route', 'driver_name', 'receiver_name'],
    requireAtLeastOneBusinessField: ['customer', 'fine_amount', 'paid_amount', 'remaining_amount']
  }
};
