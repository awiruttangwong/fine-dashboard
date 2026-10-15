# Fine Dashboard

Dashboard ติดตามค่าปรับ (static site) ที่อ่านข้อมูลจาก Google Apps Script Web App ของคลังกลาง "fine database"

- หน้าเว็บ: <https://2kfine-dashboard.pages.dev> (Cloudflare Pages)
- คลังกลาง: Google Sheet "fine database" + Apps Script ใน `backend/live-gas/`

## โครงสร้าง

| ที่อยู่ | คืออะไร |
|---|---|
| `index.html`, `css/`, `js/`, `icons/`, `_headers` | หน้า dashboard หลัก (ขึ้นเว็บ) |
| `js/api-config.js` | URL ของ Apps Script Web App (endpoint) |
| `xlsx-comparison/` | หน้าอัพโหลดไฟล์ "เปรียบเทียบค่าปรับ Acc Vs Express" แบบเดี่ยว (ขึ้นเว็บเฉพาะ `index.html`/`css`/`js` — ไฟล์ `.xlsx` ในโฟลเดอร์ไม่ขึ้น git และไม่ขึ้นเว็บ) |
| `backend/live-gas/` | Apps Script ของคลังกลาง (`Code.gs`, `config.gs`) — จัดการด้วย clasp |
| `tools/deploy-cloudflare.sh` | deploy หน้าเว็บ (คัดเฉพาะไฟล์ที่ต้องขึ้นเว็บ) |
| `tools/local-static-server.js` | เปิดหน้าเว็บทดสอบในเครื่อง |
| `docs/NEW-MONTH-ONBOARDING-ROADMAP.md` | ขั้นตอนเปิดเดือนใหม่ + กฎการซิงค์ทั้งหมด + ซิงค์อัตโนมัติ |
| `references/` | data contract / blueprint ของข้อมูล |
| `_archive/` | โค้ด/เอกสารรุ่นเก่า เก็บไว้ดูประวัติเท่านั้น ไม่ได้ใช้งาน |

## Deploy

**หน้าเว็บ** (เมื่อแก้ `index.html`, `css/`, `js/`, `xlsx-comparison/`) — ขยับ `?v=` ของไฟล์ที่แก้ใน `index.html` ก่อน แล้ว:

```bash
bash tools/deploy-cloudflare.sh
```

**Backend** (เมื่อแก้ `backend/live-gas/`) — ต้อง `deploy -i` ทุกครั้ง (`push` อย่างเดียว endpoint จริงไม่เปลี่ยน):

```bash
cd backend/live-gas
npx clasp push -f
npx clasp deploy -i AKfycbxKBkV7A7zIhJ2AaOxXk6bNNd3yvF5mDE0WKJhvL5Move36OagNYeTi89KEsI25-Y7XOw -d "อธิบายการเปลี่ยนแปลง"
```

## ข้อมูลอัปเดตเมื่อไหร่

คลังกลางซิงค์ทุกเดือนเองทุกวัน ~08:00 (หรือกดเมนู "ซิงค์และอัปเดตข้อมูลทุกเดือน" ใน fine database) ผลทุกรอบอยู่ในชีต `SyncLog` — รายละเอียดกฎการดึงข้อมูลดู `docs/NEW-MONTH-ONBOARDING-ROADMAP.md`
