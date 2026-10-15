# Fine Database Backend

โฟลเดอร์ `backend` ชุดนี้ออกแบบสำหรับ Google Sheet ที่มีโครงสร้างตาม `fine database.xlsx` โดยตรง และผสาน workflow เดิมสำหรับซิงค์ข้อมูลรายเดือนเข้าฐานกลางไว้แล้ว

## แนวคิด

ระบบนี้มี 2 flow ที่ต้องอยู่ร่วมกัน:

1. **Sync flow**
- ดึงข้อมูลจากไฟล์รายเดือนต้นทาง เช่น M6, M7
- คัดลอกชีต `SUM` / `LOAN` จากต้นทาง
- rebuild เป็น `SUM(M6)`, `LOAN(M6)`, `SUM(M7)`, `LOAN(M7)` ในไฟล์ฐานกลาง

2. **API flow**
- อ่านข้อมูลจากชีตฐานกลาง `SUM(Mx)` / `LOAN(Mx)`
- normalize เป็น canonical rows
- ส่งให้ frontend ผ่าน `doGet`

ไฟล์ `fine database.xlsx` จึงเป็นฐานข้อมูลปลายทางรายเดือนที่มีชีตลักษณะนี้:

- `SUM(M6)`
- `LOAN(M6)`
- `SUM(M7)`
- `LOAN(M7)`

ดังนั้น backend ชุดนี้จะอ่านชีตรายเดือนเหล่านี้โดยตรง แล้ว normalize ออกมาเป็น canonical rows สำหรับ frontend/API

## ไฟล์หลัก

- [config.gs](C:/Users/ADMIN/Desktop/Fine%20Dashboard/backend/config.gs)
- [Code.gs](C:/Users/ADMIN/Desktop/Fine%20Dashboard/backend/Code.gs)

## วิธีใช้งานกับ Google Sheet

1. สร้าง Google Sheet ใหม่หรือใช้ไฟล์ที่ import มาจาก `fine database.xlsx`
2. เปิด Apps Script ของไฟล์นั้น
3. นำโค้ดจาก `backend/config.gs` และ `backend/Code.gs` ไปวาง
4. ตั้งค่า `BACKEND_CONFIG.monthlySources` ให้ใส่ Google Sheet ID ของแต่ละเดือน
5. ถ้า script ผูกกับ spreadsheet เดียวกันอยู่แล้ว ปล่อย `spreadsheetId` ใน `BACKEND_CONFIG` เป็นค่าว่างได้
6. เปิดเมนู `เมนูดึงข้อมูลกลาง` แล้วสั่ง `ซิงค์และอัปเดตข้อมูลทุกเดือน`
7. Deploy เป็น Web App

## ชีตที่ระบบรองรับ

### ชีตต้นทางที่ sync รองรับ

- `SUM`
- `LOAN`
- `Loan`

### ชีตฐานกลางที่ API รองรับ

ระบบจะอ่านเฉพาะชื่อชีตที่ตรง pattern:

- `SUM(M1)` ถึง `SUM(M12)`
- `LOAN(M1)` ถึง `LOAN(M12)`

ชีตอื่น เช่น `Dropdown`, `FLASH`, `SPX`, `KEX` จะไม่ถูกอ่านโดย API backend ชุดนี้

## Canonical fields ที่ backend ส่งออก

row แต่ละรายการจะถูกแปลงให้อยู่ในรูปแบบคงที่ เช่น:

- `source_file`
- `source_sheet`
- `source_row`
- `source_type`
- `source_sheet_month`
- `fine_date`
- `fine_year`
- `fine_month`
- `fine_day`
- `customer`
- `barcode`
- `route_raw`
- `route_group`
- `vehicle_type`
- `route_time`
- `route_status`
- `driver_name`
- `transfer_receiver_name`
- `fine_amount`
- `paid_amount`
- `remaining_amount`
- `computed_remaining_amount`
- `payment_status`

นิยาม `payment_status` ที่ใช้ใน backend ชุดนี้:

- `paid` = ชำระค่าปรับแล้ว
- `open` = ค้างชำระ
- `partial` = ผ่อนชำระ โดยอ้างอิงจากข้อมูลในชีท `LOAN(Mx)` หรือแถวที่มี `installment_flag`

## Header mapping ที่รองรับ

ระบบจะ map หัวคอลัมน์จาก alias ใน `BACKEND_CONFIG.fieldAliases`

ตัวอย่าง:

- `paid_amount` รองรับทั้ง `ปรับได้`, `ปรับ`, `ชำระแล้ว`, `เบิกเงินจากลูกค้า`
- `receiver_name` รองรับทั้ง `ชื่อผู้รับโอน`, `ผู้รับโอน`
- `driver_name` รองรับทั้ง `ชื่อ พขร`, `ชื่อ`

ถ้าเดือนใหม่มีชื่อหัวคอลัมน์เปลี่ยน ให้เพิ่ม alias ใน `config.gs` ก่อน

## การกรองแถวคุณภาพต่ำ

backend จะไม่ส่งแถวที่ไม่มีสาระจริง เช่น:

- มีแค่ชื่อลูกค้า แต่ไม่มีวันที่/บาร์โค้ด/เส้นทาง/ชื่อคนขับ/ผู้รับโอน
- เป็นแถวว่างจากสูตรค้าง

เงื่อนไขนี้ช่วยกันปัญหาที่เคยเกิดกับข้อมูลว่างแต่ยังถูก frontend เอาไปแสดง

## API actions

### `action=health`
ตรวจสอบว่าเจอชีตอะไรบ้าง และมี warning อะไร

### `action=meta`
สรุป metadata ของฐานข้อมูล และเดือนที่มีจริงจากข้อมูล

### `action=months`
คืนรายการเดือนที่มีจริงจากข้อมูล

### `action=data`
คืน canonical rows พร้อม metrics

## เมนูที่มีใน Apps Script

- `ซิงค์และอัปเดตข้อมูลทุกเดือน`
- `ตรวจสอบโครงสร้างชีต`
- `แสดงสรุป metadata`

## Query params ที่รองรับใน `action=data`

- `month=2026-06`
- `customer=FLASH`
- `sheet_type=SUM`
- `sheet_month=6`
- `include_loan=false`
- `payment_status=paid`

## ข้อจำกัดที่ต้องเข้าใจ

1. ถ้าชื่อชีตฐานกลางไม่ตรง `SUM(Mx)` หรือ `LOAN(Mx)` ระบบจะไม่อ่าน
2. ถ้า header แกนหลักหาย เช่น `วันที่`, `ลูกค้า`, `บาร์โค้ด`, `เส้นทาง`, `ยอดปรับ` จะมี warning
3. `source_sheet_month` มาจากชื่อชีต แต่ `fine_month` มาจากวันที่จริงในแต่ละแถว
4. ถ้าข้อมูลในชีตชื่อเดือนหนึ่ง แต่วันที่ในแถวเป็นอีกเดือน ระบบจะยึด `fine_date` เป็นความจริงสำหรับ filtering แบบรายเดือน
5. ฝั่ง sync จะ preserve พฤติกรรมเดิมแบบ force-refresh คือ ลบชีตเป้าหมายเดิมแล้วสร้างใหม่ก่อนคัดลอกข้อมูล
6. คอลัมน์วันที่จะถูกคัดลอกตาม `display value` จากต้นทาง และบังคับให้คอลัมน์วันที่ในชีตกลางเป็น `plain text` ก่อนเขียนค่า เพื่อกันปัญหา locale แปลง `07/01/2026` ผิดเป็นเดือน/วันสลับกันในชีตกลาง
7. ฝั่ง API จะ parse วันที่จาก `display value` ก่อนเสมอ แล้วค่อย fallback ไปที่ raw `Date` object เพื่อให้เดือนที่ต้นทางจัดถูกอยู่แล้วไม่ถูกตีความใหม่ระหว่างทาง

## สรุป

backend ชุดนี้เหมาะกับสถานการณ์ที่ `fine database.xlsx` ถูกย้ายไปเป็น Google Sheet และต้องการให้ frontend ดึงข้อมูลจากฐานกลางรายเดือนโดยตรง โดยไม่ต้องย้อนกลับไปอ่าน raw customer sheets อีก
