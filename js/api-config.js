window.FINE_DASHBOARD_CONFIG = {
  spreadsheetId: '1sF_ZHOwDGV55jA3WV_vqCh0aII_su2hFYaNmHh5xtLk',
  sheetName: 'data',

  // Live backend for the current fine database workflow.
  gasEndpoint: 'https://script.google.com/macros/s/AKfycbxKBkV7A7zIhJ2AaOxXk6bNNd3yvF5mDE0WKJhvL5Move36OagNYeTi89KEsI25-Y7XOw/exec',

  // Reserved fields for the next backend/database migration.
  backendMode: 'live-fine-database-gas',
  databaseApiBase: '',
  databaseHealthPath: '',

  useJsonp: true,
  // 35s เผื่อ margin ให้พอสำหรับกรณี GAS cold-start + สแกนหลายเดือน — เดิม 20s แคบเกินไป
  // (โหลดจริงเคยวัดได้ ~14s บวก JSONP overhead จึงชนขอบง่าย) backend ถูก optimize ให้
  // อ่านสเปรดชีตน้อยลงแล้ว แต่ตั้ง timeout เผื่อไว้กันพลาดตอน endpoint เพิ่งตื่น
  requestTimeoutMs: 35000
};
