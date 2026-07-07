# Apps Script Live Checklist

ใช้ checklist นี้ทุกครั้งที่ต้องอัปเดต backend live ของ Fine Dashboard

## 1. โฟลเดอร์ที่ต้องใช้

ทำงานจาก:

```powershell
cd "C:\Users\ADMIN\Desktop\Fine Dashboard\backend\live-gas"
```

ห้าม push จาก root repo เพราะ root ยังเป็น package คนละตัว

## 2. ตรวจ target project

ต้องได้ Script ID นี้:

- `1qn1gCLwH26wctoRQb4t5AHfWskx4DaluyWiIgi-f9vNIgnO01c5qn-Fn`

ตรวจด้วย:

```powershell
cmd /c clasp deployments
```

deployment live ที่ frontend ใช้อยู่คือ:

- `AKfycbxKBkV7A7zIhJ2AaOxXk6bNNd3yvF5mDE0WKJhvL5Move36OagNYeTi89KEsI25-Y7XOw`

## 3. Push code ขึ้น Apps Script

```powershell
cmd /c clasp push -f
```

ไฟล์หลักที่ต้องขึ้นให้ครบ:

- `config.gs`
- `Code.gs`
- `appsscript.json`

## 4. สร้าง version ใหม่

```powershell
cmd /c clasp version "fine dashboard backend live update"
```

จดเลข version ที่ระบบตอบกลับ เช่น `8`

## 5. Redeploy ตัว Web App เดิม

ใช้ deployment ID เดิมเสมอ เพื่อให้ frontend ใช้ URL เดิมต่อได้:

```powershell
cmd /c clasp deploy -i AKfycbxKBkV7A7zIhJ2AaOxXk6bNNd3yvF5mDE0WKJhvL5Move36OagNYeTi89KEsI25-Y7XOw -V <VERSION> -d "fine database live webapp"
```

## 6. รัน sync ใน Apps Script

หลัง deploy แล้ว เข้า Apps Script และรัน:

- `executeCentralDataSync`

เพื่อ rebuild ข้อมูล `SUM(Mx)` และ `LOAN(Mx)` ในฐานกลางให้เป็นรอบล่าสุด

## 7. ตรวจ endpoint จริง

ตรวจ 2 URL นี้:

```text
https://script.google.com/macros/s/AKfycbxKBkV7A7zIhJ2AaOxXk6bNNd3yvF5mDE0WKJhvL5Move36OagNYeTi89KEsI25-Y7XOw/exec?action=health
https://script.google.com/macros/s/AKfycbxKBkV7A7zIhJ2AaOxXk6bNNd3yvF5mDE0WKJhvL5Move36OagNYeTi89KEsI25-Y7XOw/exec?action=data
```

สิ่งที่ต้องเช็ก:

- `ok: true`
- เจอ `SUM(Mx)` / `LOAN(Mx)` ใน `sheet_catalog`
- `rows` ไม่ว่างเมื่อเดือนนั้นมีข้อมูล
- `payment_status` ของรายการ `LOAN` ต้องเป็น `partial`

## 8. ตรวจ frontend

frontend ใช้ endpoint นี้อยู่แล้วใน [js/api-config.js](C:\Users\ADMIN\Desktop\Fine Dashboard\js\api-config.js)

เมื่อ refresh หน้า:

- ต้องโหลดข้อมูลใหม่จาก backend ทุกครั้ง
- ใช้ `ts` ใน JSONP กัน cache
- มี auto refresh เมื่อ focus / visibility change / interval
- signature ต้องรวม `payment_status`, `source_type`, `installment_flag`

ดังนั้นถ้า backend เปลี่ยนจริงและ endpoint ตอบข้อมูลใหม่ หน้า frontend ต้องอัปเดตตามได้ทันทีหลัง refresh

## 9. เกณฑ์ปิดงาน

ถือว่าปิดงานได้เมื่อครบทั้งหมด:

- push สำเร็จ
- version ใหม่ถูก deploy ทับ web app เดิม
- sync สำเร็จ
- `health` ผ่าน
- `data` ผ่าน
- frontend refresh แล้วข้อมูลตรงกับ Google Sheet ล่าสุด
