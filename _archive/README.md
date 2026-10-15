# _archive

ไฟล์ในนี้เป็นของรุ่นเก่าที่ไม่ได้ใช้งานแล้ว เก็บไว้ดูประวัติเท่านั้น (ยังอยู่ใน git history ด้วย) — **ไม่มีอะไรในโฟลเดอร์นี้ถูก deploy หรือถูกระบบเรียกใช้**

- `legacy-root-gas/` — Apps Script รุ่นแรก ("Fine Dashboard API") ที่เคยอยู่ที่ root ของ repo อ่านจาก Google Sheet ชีต `data` ชุดเก่า ถูกแทนที่ด้วย `backend/live-gas/` แล้ว (`.clasp.json` ในนี้ชี้ไปโปรเจกต์เก่า อย่า `clasp push` จากโฟลเดอร์นี้)
- `backend-mirror/` — สำเนา `Code.gs`/`config.gs` ที่เคยต้องแก้คู่กับ `backend/live-gas/` ให้ตรงกัน แต่ `Code.gs` ตามไม่ทันมานานแล้ว (ไม่มีระบบ พขร./ซิงค์อัตโนมัติ/กฎพิเศษ) จึงเลิกใช้ ให้แก้ที่ `backend/live-gas/` อย่างเดียว
- `netlify/` — config ของ Netlify สมัยที่หน้าเว็บยังอยู่บน Netlify ปัจจุบันใช้ Cloudflare Pages (`tools/deploy-cloudflare.sh`)
- `docs-netlify-era/` — checklist การ release สมัย Netlify + Apps Script ที่ root
- `backup_fine_P'BOY/` — backup สคริปต์ debt-tracker รุ่นแรกสุด (`html.txt` ตั้งชื่อผิด เป็นโค้ด Apps Script ไม่ใช่ HTML)
- `Dashboard ยอดค้างปรับพขร/` — สแนปช็อตเก่าของหน้า/สคริปต์ ยอดค้างปรับ พขร.
- `code for fine database.txt` — สคริปต์ "เมนูรวมข้อมูล" ของไฟล์เดือน (รุ่นเก่า ยังมี J&T และอ่านคอลัมน์ตามตำแหน่ง) ใช้อ้างอิงตรรกะสถานะ รอปรับ/ปรับได้/ปรับไม่ได้ เท่านั้น
