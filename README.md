# Fine Dashboard

Static dashboard สำหรับติดตามและวิเคราะห์ข้อมูลค่าปรับ โดยหน้าเว็บโหลดข้อมูลจาก Google Apps Script Web App ที่ผูกกับ Google Sheet

## โครงสร้างหลัก

- `index.html` - หน้าเว็บหลัก
- `css/` - styles ของ dashboard
- `js/` - logic, charts, filters, tables และ data loader
- `Code.gs` - Google Apps Script backend สำหรับอ่านข้อมูลจาก Google Sheet
- `references/` - data blueprint/contract

## ตั้งค่าข้อมูล

ตั้งค่า Web App endpoint ใน `js/api-config.js`

```js
window.FINE_DASHBOARD_CONFIG = {
  spreadsheetId: 'YOUR_SPREADSHEET_ID',
  sheetName: 'data',
  gasEndpoint: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  useJsonp: true,
  requestTimeoutMs: 20000
};
```

ถ้า `gasEndpoint` ยังว่าง หน้าเว็บจะเปิดได้แต่โหลดข้อมูลไม่ได้

## Deploy

โปรเจกต์นี้เป็น static site ไม่มี build command

- Publish directory: `.`
- Build command: เว้นว่าง

ไฟล์ `netlify.toml` ถูกตั้งค่าไว้สำหรับ Netlify แล้ว

