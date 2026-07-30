# 🗓️ Roadmap เปิดใช้เดือนใหม่ (M9, M10, M11, ...)

> คู่มือทำตามทีละขั้นเมื่อมีเดือนใหม่เข้ามา — ทำครบตามนี้แล้วข้อมูลเดือนใหม่จะขึ้น dashboard เอง
> **หลักการสำคัญ: ทุกขั้นตอน "ปลอดภัยกับข้อมูลเดิม" — ไม่มีขั้นไหนลบ/ทับข้อมูลเดือนก่อนหน้า**

อ้างอิงจากการเปิดใช้ **M8** จริง (30 ก.ค. 2026) — ทำตามแบบเดียวกันเป๊ะทุกเดือน

---

## 📌 TL;DR — 5 ขั้นตอน (อ่านเต็มด้านล่าง)

| # | ทำอะไร | ใคร/ที่ไหน |
|---|--------|-----------|
| 1 | สร้างไฟล์เดือนใหม่ + ตั้งชื่อให้มีเดือน + วาง `Code.gs` | Google Drive / Apps Script |
| 2 | กรอกข้อมูล 6 ลูกค้า → กดเมนู **"ซิงก์ข้อมูล"** ในไฟล์เดือนนั้น | ไฟล์เดือนใหม่ |
| 3 | เอา **spreadsheet ID** เติมลง `monthlySources` ใน config ทั้ง 2 ไฟล์ | โค้ด (repo) |
| 4 | `clasp push` + `clasp deploy` คลังกลาง | เทอร์มินัล |
| 5 | กดเมนู **"ซิงค์และอัปเดตข้อมูลทุกเดือน"** ที่คลังกลาง → ตรวจผล | คลังกลาง |

---

## 🧭 เข้าใจสถาปัตยกรรมก่อน (ทำไมต้องทำ 2 ที่)

ระบบมี **2 ชั้นข้อมูลที่แยกกัน** เดือนใหม่ต้องรองรับทั้งคู่:

```text
┌─ ไฟล์รายเดือน (M9) ──────────┐         ┌─ คลังกลาง (fine database) ──────────┐
│  6 ชีตลูกค้า:                │  sync   │  SUM(M9) รอปรับ(M9)                  │
│  FLASH SPX KEX BEST J&T SGT  │ ──────► │  ปรับได้(M9) ปรับไม่ได้(M9)         │ ──► Dashboard
│  + Code.gs (monthly-sync)    │         │  Drivers(M9) Payments(M9)           │     (Netlify)
└──────────────────────────────┘         └─────────────────────────────────────┘
      ↑ ขั้น 1–2                                ↑ ขั้น 3–5 (auto-provision)
```

- **ค่าปรับ (fine data):** กรอกในไฟล์รายเดือน → sync เข้าคลังกลางเป็น `SUM(Mx)`/สถานะ
- **ผ่อนชำระ พขร. (Drivers/Payments):** เขียนตรงเข้าคลังกลางผ่านหน้าเว็บ (native UI) — ชีต `Drivers(Mx)`/`Payments(Mx)` **ถูกสร้างอัตโนมัติตอนกดซิงค์** (ขั้น 5) ไม่ต้องทำมือ

> 💡 คลังกลาง (`config.gs`) ประกาศ M1–M12 ไว้ครบแล้ว เดือนใหม่จึงแค่ **เติม `id`** ช่องที่ว่างอยู่ ไม่ต้องเพิ่ม label ใหม่

---

## ✅ ขั้นตอนละเอียด

### ขั้น 1 — สร้างไฟล์เดือนใหม่ + วาง Code.gs

1. สร้าง Google Sheet ใหม่สำหรับเดือนนั้น
2. **ตั้งชื่อไฟล์ให้มี "เดือน" อยู่ในชื่อ** — สำคัญมาก (กันบั๊กวันที่สลับเดือน) ใช้อย่างใดอย่างหนึ่ง:
   - รหัสเดือน: `M9`, `M10` (เช่น `ค่าปรับ M9`)
   - ชื่อเดือนอังกฤษ: `September`, `October` (เช่น `ค่าปรับ EXPRESS September 2026`) ✅ *(แบบที่ M8 ใช้)*
   - ชื่อเดือนไทย: `กันยายน`, `ตุลาคม`
   - หรือรูปแบบวันที่: `2026-09`, `09/2026`
3. เปิด **Extensions → Apps Script**
4. วางเนื้อหาจากไฟล์ **`ค่าปรับค้าง พขร/Code.monthly-sync.gs.txt`** (ในrepo) ลงไป **เหมือนกันเป๊ะทุกตัวอักษร** — ไม่ต้องแก้อะไรเลย (script เป็น month-agnostic อ่านเดือนจากชื่อไฟล์เอง)
5. Save

> ⚠️ **ห้ามแก้ Code.gs ให้ต่างจาก M6/M7/M8** — ทุกเดือนใช้สคริปต์ตัวเดียวกันเป๊ะ ถ้าแก้เฉพาะเดือนจะทำให้ debug ยากและเสี่ยงพลาด

### ขั้น 2 — กรอกข้อมูล + ซิงก์ในไฟล์เดือนนั้น

1. กรอกข้อมูลค่าปรับลง 6 ชีตลูกค้า: `FLASH · SPX · KEX · BEST · J&T · SGT` (เลย์เอาต์คอลัมน์เหมือน M6/M7 — คอลัมน์ K = ยอดปรับ)
2. Reload ไฟล์ → เมนู **"เมนูรวมข้อมูล"** จะขึ้น → กด **"ซิงก์ข้อมูล"**
3. ระบบจะสร้าง/อัปเดตชีต `SUM`, `รอปรับ`, `ปรับได้`, `ปรับไม่ได้` ในไฟล์เดือนนั้น
4. เช็คว่า SUM มีข้อมูลถูกต้อง (ถ้ายังไม่มีข้อมูลค่าปรับก็ข้ามได้ — ทำขั้นต่อไปได้เลย ค่อยกลับมากรอก)

### ขั้น 3 — เติม spreadsheet ID ลง config (แก้โค้ด)

หา **spreadsheet ID** จาก URL ของไฟล์เดือนใหม่:
`https://docs.google.com/spreadsheets/d/`**`<ตรงนี้คือ ID>`**`/edit`

แก้ **ทั้ง 2 ไฟล์ให้ตรงกันเป๊ะ** (คลังกลางต้องมิเรอร์กันเสมอ):

- `backend/config.gs`
- `backend/live-gas/config.gs`

หาบรรทัด `monthlySources` แล้วเติม id ในช่องเดือนนั้น (จากเดิม `id: ''`):

```js
monthlySources: [
  ...
  { label: 'M8', id: '173rdnYB8xT92abBkTOCIsxZFcDTSaKCYWjc6Y7exIV8' },  // ← ทำไว้แล้ว
  { label: 'M9', id: 'วาง_ID_ของ_M9_ตรงนี้' },                         // ← เติมช่องนี้
  { label: 'M10', id: '' },
  ...
]
```

ยืนยันว่า 2 ไฟล์ตรงกัน:

```bash
diff backend/config.gs backend/live-gas/config.gs   # ต้องไม่มี output
```

### ขั้น 4 — push + deploy คลังกลาง

```bash
cd backend/live-gas
npx clasp push -f
npx clasp deploy -i AKfycbxKBkV7A7zIhJ2AaOxXk6bNNd3yvF5mDE0WKJhvL5Move36OagNYeTi89KEsI25-Y7XOw -d "wire M9 into monthlySources"
```

> ⚠️ **ต้อง `deploy -i <ID เดิม>` เสมอ** — `push` อย่างเดียว endpoint จริงไม่อัปเดต (endpoint ผูกกับ deployment ID ที่ pin ไว้ ไม่ใช่โค้ดล่าสุด) ดูรายละเอียดในหัวข้อ "Pinned deployment ID" ท้ายเอกสารนี้

commit เก็บประวัติด้วย:

```bash
git add backend/config.gs backend/live-gas/config.gs
git commit -m "feat: wire M9 into monthlySources"
git push origin main
```

> config เป็น backend ล้วน **ไม่ต้อง deploy Netlify** (Netlify deploy เฉพาะตอนแก้ frontend — `js/`, `css/`, `index.html`)

### ขั้น 5 — ซิงค์ที่คลังกลาง + ตรวจผล

**วิธี A (แนะนำ — กดเมนู):** เปิดคลังกลาง → เมนู **"ซิงค์และอัปเดตข้อมูลทุกเดือน"** → กด 1 ครั้ง

**วิธี B (ผ่าน URL — ตรวจ log ได้ละเอียด):**

```bash
curl -sL "https://script.google.com/macros/s/AKfycbxKBkV7A7zIhJ2AaOxXk6bNNd3yvF5mDE0WKJhvL5Move36OagNYeTi89KEsI25-Y7XOw/exec?action=sync"
```

ผลที่ถูกต้อง — `process_log` ต้องขึ้น **"M9: สำเร็จ"**:

```json
{ "ok": true, "active_sync_count": 4,
  "process_log": [ "M6: สำเร็จ ...", "M7: สำเร็จ ...", "M8: สำเร็จ ...", "M9: สำเร็จ ..." ] }
```

การกดครั้งนี้จะ **สร้าง `Drivers(M9)`/`Payments(M9)` อัตโนมัติ** พร้อมหัวคอลัมน์ (idempotent — กดซ้ำไม่ทำข้อมูลเดิมเสีย)

---

## 🔍 การตรวจสอบ (Verification)

ตรวจว่าชีต M9 ครบในคลังกลาง:

```bash
curl -sL ".../exec?action=health"      # ดู sheet_catalog ต้องมี SUM(M9)/รอปรับ(M9)/ปรับได้(M9)/ปรับไม่ได้(M9)
                                        # และ unmatched_sheet_names ต้องมี Drivers(M9)/Payments(M9)
```

- เปิด dashboard → ตัวกรองเดือนต้องมี **M9** ให้เลือก และแสดงข้อมูลถูกต้อง
- ถ้าข้อมูล 0 แถว แต่ยัง "สำเร็จ" = ปกติ (ไฟล์เดือนนั้นยังไม่มีข้อมูลค่าปรับ) เมื่อกรอกแล้วซิงก์ซ้ำจะขึ้นเอง

---

## 🛠️ Troubleshooting

| อาการใน process_log | สาเหตุ | วิธีแก้ |
|--------------------|--------|---------|
| `M9: พบปัญหาโครงสร้างแผ่นงานต้นทาง SUM` | ไฟล์เดือนนั้นยังไม่มีชีต `SUM` | กลับไปขั้น 2 — กดเมนู "ซิงก์ข้อมูล" ในไฟล์เดือนนั้นก่อน |
| `M9: ล้มเหลว (สาเหตุ: ...openById...)` | id ใน config ผิด/ไฟล์เข้าไม่ได้ | ตรวจ id ให้ตรงกับ URL, ตรวจสิทธิ์เข้าถึงไฟล์ |
| `M9: เตรียมชีต Drivers/Payments ล้มเหลว` | สร้างชีต debt ไม่ได้ (พบได้ยาก) | ดู error message, ตรวจว่าคลังกลางไม่ถูกล็อก/เต็ม |
| เมนูไม่ขึ้นในไฟล์เดือนใหม่ | ยังไม่ได้วาง Code.gs / ยังไม่ reload | วาง Code.gs (ขั้น 1) แล้ว reload ไฟล์ |
| วันที่แสดงผิดเดือน (เช่น 30 ถูกอ่านเป็นเดือน) | ชื่อไฟล์ไม่มี "เดือน" ให้ script จับ | เปลี่ยนชื่อไฟล์ให้มี M9/September/กันยายน แล้วซิงก์ใหม่ |
| endpoint ยังเป็นข้อมูลเก่าหลัง push | ลืม `clasp deploy -i` | รัน `clasp deploy -i <ID>` (ขั้น 4) |

---

## 📎 ภาคผนวก — ค่าอ้างอิง (Reference)

| รายการ | ค่า |
|--------|-----|
| **คลังกลาง (fine database)** | `1sF_ZHOwDGV55jA3WV_vqCh0aII_su2hFYaNmHh5xtLk` |
| **Apps Script คลังกลาง (scriptId)** | `1qn1gCLwH26wctoRQb4t5AHfWskx4DaluyWiIgi-f9vNIgnO01c5qn-Fn` |
| **Pinned deployment ID (endpoint จริง)** | `AKfycbxKBkV7A7zIhJ2AaOxXk6bNNd3yvF5mDE0WKJhvL5Move36OagNYeTi89KEsI25-Y7XOw` |
| **สคริปต์รายเดือน (canonical)** | `ค่าปรับค้าง พขร/Code.monthly-sync.gs.txt` |
| **config ที่ต้องแก้** | `backend/config.gs` + `backend/live-gas/config.gs` (มิเรอร์ให้ตรงกัน) |
| **Frontend (Netlify)** | <https://2kfine-dashboard.netlify.app> — deploy ด้วย `netlify deploy --prod` (เฉพาะเมื่อแก้ frontend) |

### เดือนที่เปิดใช้แล้ว (อัปเดตทุกครั้งที่เพิ่มเดือน)

| เดือน | spreadsheet ID | ชื่อไฟล์ | สถานะ |
|------|----------------|---------|--------|
| M6 | `1DEQ2s_C2EszJ27udXkd7L1IJGo4syGUiHM4VCE-9Fh0` | — | ✅ มีข้อมูล |
| M7 | `15Z8CC5Y53NVEuKy52sq1eZhdeHkXqmX2ZrXcBEGs558` | — | ✅ มีข้อมูล |
| M8 | `173rdnYB8xT92abBkTOCIsxZFcDTSaKCYWjc6Y7exIV8` | ค่าปรับ EXPRESS August 2026 | ✅ โครงสร้างพร้อม (รอข้อมูลสิงหาคม) |
| M9 | *(เติมเมื่อเปิดใช้)* | | ⬜ |
| M10 | *(เติมเมื่อเปิดใช้)* | | ⬜ |

---

## ⏱️ Checklist สั้น (ปริ้นท์/ก๊อปไว้ใช้จริง)

```text
[ ] 1. สร้างไฟล์เดือนใหม่ + ชื่อไฟล์มี "เดือน" (M9/September/กันยายน)
[ ] 1. Extensions > Apps Script > วาง Code.monthly-sync.gs.txt เหมือนเป๊ะ > Save
[ ] 2. กรอก 6 ชีตลูกค้า > เมนู "ซิงก์ข้อมูล" > เช็ค SUM
[ ] 3. คัดลอก spreadsheet ID จาก URL
[ ] 3. เติม id ใน backend/config.gs + backend/live-gas/config.gs (ตรงกัน)
[ ] 3. diff ยืนยัน 2 ไฟล์ตรงกัน
[ ] 4. cd backend/live-gas && clasp push -f
[ ] 4. clasp deploy -i <PINNED_ID> -d "wire M9"
[ ] 4. git commit + push
[ ] 5. คลังกลาง > เมนู "ซิงค์และอัปเดตข้อมูลทุกเดือน"
[ ] 5. ตรวจ process_log ขึ้น "M9: สำเร็จ"
[ ] ✓ เปิด dashboard เช็คตัวกรองเดือน M9 + ข้อมูลถูกต้อง
```

---

อัปเดตล่าสุด: 30 ก.ค. 2026 — หลังเปิดใช้ M8 สำเร็จ
