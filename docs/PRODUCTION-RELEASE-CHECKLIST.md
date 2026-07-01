# Fine Dashboard: Production Release Runbook

เอกสารนี้เป็นขั้นตอนมาตรฐานสำหรับตรวจงาน, push GitHub, deploy Google Apps Script และขึ้น Production บน Netlify ของระบบ Fine Dashboard

ใช้เอกสารนี้ทุกครั้งหลังแก้ frontend หรือ backend และก่อนแจ้งปิดงาน ห้ามข้ามขั้นตอนโดยไม่มีเหตุผลและหลักฐานที่บันทึกไว้

## 1. ข้อมูลระบบ

| ส่วน | รายละเอียด |
| --- | --- |
| Production | `https://2kfine-dashboard.netlify.app/` |
| GitHub | `https://github.com/awiruttangwong/fine-dashboard` |
| Branch Production | `main` |
| Frontend | Static HTML/CSS/JavaScript ไม่มี build command |
| Netlify publish directory | `.` |
| Netlify release mode | Manual deploy/publish เป็นหลัก ไม่ใช่ Git auto deploy |
| Backend | Google Apps Script Web App จาก `Code.gs` |
| Backend config | `js/api-config.js` |
| Data source | Google Sheet ชื่อ `data` |
| Apps Script project config | `.clasp.json`, `appsscript.json` |

Frontend ต้องเรียก Apps Script URL ที่ลงท้ายด้วย `/exec` และโหลดข้อมูลต้นทางใหม่ทุกครั้งที่เปิดหน้า ระบบใช้ JSONP พร้อม timestamp เพื่อหลีกเลี่ยง cache ของข้อมูล

ข้อเท็จจริงสำคัญของโปรเจกต์นี้:

- การ `git push origin main` สำเร็จ ไม่ได้แปลว่า Netlify Production จะอัปเดตเอง
- site นี้ต้องถือว่าใช้ manual release flow เป็นค่าเริ่มต้น จนกว่าจะตรวจจาก Netlify API/UI แล้วพบว่ามี Git auto deploy จริง
- deploy ที่ Production ใช้งานจริงต้องอ้างอิงด้วย `published_deploy_id` ของ Netlify ไม่ใช่อ้างเฉพาะ commit SHA

## 2. หลักการก่อนเริ่ม

- อ่าน requirement ล่าสุดและระบุให้ชัดว่าแก้ frontend, backend หรือทั้งสองส่วน
- ตรวจ working tree ก่อน ห้ามลบหรือย้อนการแก้ไขที่ไม่ใช่งานของตน
- ห้ามใช้ `git add .` โดยไม่ตรวจไฟล์ เพราะอาจนำไฟล์ข้อมูล, secret หรือไฟล์ที่ไม่เกี่ยวข้องเข้า commit
- ห้าม commit PAT, token, credential, `.netlify/`, ไฟล์ข้อมูลจริง หรือข้อมูลส่วนบุคคล
- ห้าม deploy Production หากเจ้าของงานยังไม่ได้สั่งหรืออนุมัติให้ deploy
- ห้ามกล่าวว่าใช้งานได้ `100%` หากยังไม่ได้ตรวจ Production, backend และข้อมูลจริงตาม checklist นี้

บน Windows เครื่องที่ PowerShell block npm `.ps1` ให้เติม `cmd /c` หน้าคำสั่ง `netlify` และ `clasp` เช่น `cmd /c netlify status` หรือ `cmd /c clasp status` โดยไม่ต้องลดระดับ Execution Policy ของเครื่อง

## 3. ตรวจขอบเขตและสถานะ Git

รันจาก root ของ repo:

```powershell
git branch --show-current
git remote -v
git status --short
git diff --check
git diff
```

ตรวจว่าเครื่องมือเชื่อมกับ account/project ที่ถูกต้อง:

```powershell
gh auth status
netlify status
clasp status
```

หากคำสั่งใดขอ login ให้หยุดและยืนยัน account ที่กำลังใช้งานก่อนดำเนินการ ห้ามนำ PAT, OTP หรือ auth token ใส่ลงในเอกสารหรือ commit

เกณฑ์ผ่าน:

- อยู่ branch ที่ตั้งใจใช้งาน โดย Production ต้องมาจาก `main`
- `origin` ชี้ไป repo `awiruttangwong/fine-dashboard`
- GitHub, Netlify และ Apps Script เป็น account/project ที่ได้รับอนุญาตให้ release ระบบนี้
- เข้าใจทุกไฟล์ที่เปลี่ยน และไม่มีไฟล์แปลกปลอมหรือ secret
- `git diff --check` ไม่มี whitespace error
- ไม่มีการแก้ไฟล์นอกขอบเขตโดยไม่จำเป็น

## 4. ตรวจ Frontend

### 4.1 ตรวจ syntax

```powershell
Get-ChildItem js -Filter *.js | ForEach-Object { node --check $_.FullName }
```

ทุกไฟล์ต้องจบด้วย exit code `0`

### 4.2 เปิดระบบในเครื่อง

```powershell
netlify dev
```

เปิด URL ที่ Netlify CLI แสดง แล้วตรวจอย่างน้อยที่ viewport ต่อไปนี้:

- Desktop: `1440 x 900`
- Tablet: `768 x 1024`
- Mobile: `375 x 812`

### 4.3 Checklist หน้าจอ

- [ ] หน้าโหลดสำเร็จและไม่มี error ใน Console
- [ ] ไม่มี request ล้มเหลวใน Network
- [ ] ไม่มี horizontal overflow หรือข้อความ/ภาพซ้อนกัน
- [ ] Sidebar เปิด/ปิดได้บน mobile และไม่บังเนื้อหาอย่างผิดปกติ
- [ ] Logo และรูปภาพไม่ยืด, แตก, ล้นกรอบ หรือทำให้ layout shift
- [ ] KPI ตรงกับข้อมูลที่ผ่าน filter
- [ ] กราฟแสดงวันที่, จำนวนรายการ และยอดปรับถูกต้อง
- [ ] Tooltip ของกราฟตรงกับแท่งและข้อมูลวันเดียวกัน
- [ ] ตารางทั้ง 4 tab แสดง header ตรงกับข้อมูลแต่ละคอลัมน์
- [ ] ตารางไม่บีบข้อมูลทับกัน และยังอ่านได้บนหน้าจอแคบ
- [ ] ช่องค้นหาจะแสดง suggestion หลังผู้ใช้เริ่มพิมพ์เท่านั้น
- [ ] filter เดือน default เป็นเดือนปัจจุบัน และเปลี่ยนเดือนได้ครบ 12 เดือน
- [ ] filter ลูกค้า, พนักงานขับรถ, ประเภทรถ และสถานะการชำระทำงานร่วมกันได้
- [ ] ปุ่ม, input และองค์ประกอบ interactive ใช้ keyboard ได้และมี focus state
- [ ] loading, empty และ error state มีข้อความที่ถูกต้อง

## 5. ตรวจ Business Logic และข้อมูล

สุ่มเทียบข้อมูลหน้าเว็บกับ Google Sheet อย่างน้อย 5 แถว ครอบคลุมแถวปกติและแถวผิดปกติ

- [ ] `source_row` ตรงกับแถวต้นทาง
- [ ] วันที่, ลูกค้า, บาร์โค้ด, เส้นทาง และพนักงานตรงกับต้นทาง
- [ ] `ยอดคงเหลือคำนวณ = ยอดปรับ - ชำระแล้ว`
- [ ] รายการซ้ำและบาร์โค้ดซ้ำถูก flag ตามข้อมูลจริง
- [ ] รายการข้อมูลไม่ครบแสดงปัญหาที่ตรงกับช่องที่ขาด
- [ ] ยอดรวมของ KPI เท่ากับผลรวมจากรายการภายใต้ filter เดียวกัน
- [ ] จำนวนรายการใน KPI, กราฟ และตารางสอดคล้องกัน
- [ ] การเลือกเดือนใช้ `fine_year` และ `fine_month` ของข้อมูลจริง
- [ ] ประเภทรถแสดงเฉพาะ allowlist ต่อไปนี้:

```text
10W, 14W, 18W, 22W, 4W, 4WJ, 6W5.5, 6W6.5, 6W7.2, 6W8.8
```

ค่าอื่น เช่น `BTS` หรือ `2WNT` ต้องไม่ถูกแสดงเป็นประเภทรถ

## 6. ตรวจและ Deploy Backend

ทำส่วนนี้เมื่อมีการแก้ `Code.gs`, `appsscript.json` หรือ contract ข้อมูลเท่านั้น

### 6.1 ตรวจ syntax และ diff

```powershell
Get-Content Code.gs | node --check -
git diff -- Code.gs appsscript.json .clasp.json
clasp status
```

### 6.2 Push Apps Script

```powershell
clasp push
clasp deployments
```

อัปเดต deployment เดิมเพื่อให้ URL `/exec` ไม่เปลี่ยน:

```powershell
clasp deploy --deploymentId <DEPLOYMENT_ID> --description "release YYYY-MM-DD: <summary>"
```

หาก CLI ของเครื่องใช้ option แบบย่อ:

```powershell
clasp deploy -i <DEPLOYMENT_ID> -d "release YYYY-MM-DD: <summary>"
```

อย่าสร้าง deployment ใหม่โดยไม่จำเป็น เพราะต้องนำ URL ใหม่ไปแก้ `js/api-config.js` และตรวจ frontend ใหม่ทั้งหมด

### 6.3 ตรวจ Backend จริง

```powershell
$endpoint = (Select-String -Path js/api-config.js -Pattern "https://script.google.com/macros/s/.+/exec").Matches.Value
Invoke-RestMethod "$endpoint?action=health"
$payload = Invoke-RestMethod "$endpoint?action=data"
$payload | Select-Object ok, generated_at
$payload.source
$payload.metrics
$payload.rows.Count
```

เกณฑ์ผ่าน:

- [ ] `health.ok` เป็น `true`
- [ ] `spreadsheet_id` และ `sheet_name` ตรงกับระบบจริง
- [ ] `action=data` คืน `ok: true`
- [ ] `generated_at` เป็นเวลาปัจจุบัน ไม่ใช่ payload เก่า
- [ ] `source.row_count` เท่ากับจำนวนแถวข้อมูลต้นทาง
- [ ] `rows.Count` เท่ากับ `source.row_count`
- [ ] ไม่มี stack trace หรือข้อมูลลับใน response
- [ ] Web App execute as ผู้ deploy และอนุญาต anonymous access ตาม `appsscript.json`

เมื่อแก้ contract ของ backend ต้องให้ backend รองรับ frontend เวอร์ชันเดิมก่อน แล้วจึง deploy frontend เพื่อลดช่วงเวลาที่ระบบสองฝั่งไม่เข้ากัน

## 7. สร้าง Netlify Preview

ตรวจว่า CLI ผูกกับ site ถูกต้อง:

```powershell
netlify status
```

สร้าง preview จาก working tree ที่ผ่านการตรวจแล้ว:

```powershell
netlify deploy --dir .
```

เปิด Deploy Preview URL และทำ checklist ในหัวข้อ 4 และ 5 ซ้ำ โดยเน้นการเรียก Apps Script จริง

ให้บันทึกค่าต่อไปนี้จากผลลัพธ์ deploy:

- Draft URL
- Netlify deploy ID
- เวลา deploy
- ผู้ deploy

หมายเหตุ:

- ในโปรเจกต์นี้ `netlify deploy --dir .` คือขั้นตอนสำคัญ เพราะเป็น source of truth ของ artifact ที่จะ publish ขึ้น Production
- อย่าข้าม preview แล้วไปเชื่อว่า `git push` จะทำให้ Production ตามมาเอง

เกณฑ์ผ่าน:

- [ ] Preview เปิดได้และ asset ทุกไฟล์เป็น HTTP 200
- [ ] ไม่มี mixed content, CORS/JSONP error หรือ timeout
- [ ] ข้อมูลใน Preview ตรงกับ Google Sheet ล่าสุด
- [ ] แก้ข้อมูลทดสอบที่ต้นทางแล้ว refresh หน้า Preview จากนั้นเห็นข้อมูลใหม่

## 8. Commit และ Push GitHub

เพิ่มเฉพาะไฟล์ที่เกี่ยวข้อง:

```powershell
git add <file-1> <file-2> docs/PRODUCTION-RELEASE-CHECKLIST.md
git diff --cached --check
git diff --cached
git commit -m "<type>: <clear summary>"
git push origin main
```

ตรวจผล push:

```powershell
git status --short
git log -1 --oneline
git ls-remote origin refs/heads/main
gh run list --branch main --limit 5
```

เกณฑ์ผ่าน:

- [ ] commit มีเฉพาะไฟล์ที่ตั้งใจส่ง
- [ ] local `HEAD` ตรงกับ `origin/main`
- [ ] GitHub Actions สำเร็จ หาก workflow ถูกใช้งาน
- [ ] working tree สะอาด หรือไฟล์ที่เหลือได้รับการระบุว่าเป็นงานอื่นอย่างชัดเจน

## 9. Deploy Netlify Production

โปรเจกต์นี้ให้ใช้ลำดับความสำคัญดังนี้:

1. สร้าง draft deploy ที่ตรวจแล้วด้วย `netlify deploy --dir .`
2. publish draft deploy ตัวนั้นขึ้น Production
3. ตรวจ `published_deploy_id` และไฟล์จริงบน Production URL

อย่าถือว่า site นี้มี auto deploy จาก `main` จนกว่าจะพิสูจน์ได้จาก Netlify UI/API ว่ามี build settings ผูกกับ repo จริง

### 9.1 วิธีมาตรฐาน

สร้าง draft deploy ก่อนเสมอ:

```powershell
netlify deploy --dir .
```

จากนั้น publish draft ตัวที่ตรวจแล้วขึ้น Production ด้วยหนึ่งในวิธีต่อไปนี้:

- Netlify UI: เปิด deploy ที่ผ่านการตรวจแล้ว แล้วกด `Publish deploy`
- Netlify API/CLI flow: publish deploy ID เดิมขึ้น Production URL เดิม

ตัวอย่าง workflow ที่ใช้ได้จริง:

```text
1. netlify deploy --dir .
2. จด deploy ID ที่ได้จาก draft deploy
3. Publish deploy นั้นจาก Netlify UI หรือ Netlify API
4. ตรวจว่า published_deploy_id ของ site เปลี่ยนเป็น deploy ID เดียวกัน
```

### 9.2 ทางเลือกเมื่อใช้ CLI deploy ตรงได้

```powershell
netlify deploy --prod --dir .
```

ใช้วิธีนี้ได้ก็ต่อเมื่อ:

- ยืนยันแล้วว่า account ที่ login มีสิทธิ์ publish production
- คำสั่งไม่ขึ้น `Forbidden` หรือ `Not Found`
- หลังรันแล้วมีหลักฐานว่า `published_deploy_id` เปลี่ยนเป็น deploy ล่าสุดจริง

ถ้า `netlify deploy --prod --dir .` ล้มเหลว หรือ Production ยังเสิร์ฟไฟล์เก่า ให้กลับไปใช้วิธีมาตรฐาน: สร้าง draft deploy แล้ว publish draft นั้นแทน

ก่อน deploy ต้องยืนยันว่า working tree ไม่มีไฟล์ที่ยังไม่ commit ซึ่งอาจทำให้ Production ไม่ตรงกับ GitHub หากตั้งใจ release จาก commit

### 9.3 เกณฑ์ผ่านของขั้นตอน Production Deploy

- [ ] มี Draft URL ที่ตรวจแล้ว
- [ ] มี Netlify deploy ID ของ draft ตัวที่จะปล่อยจริง
- [ ] `published_deploy_id` หลัง release ตรงกับ deploy ที่เลือก
- [ ] Production URL เดิม (`https://2kfine-dashboard.netlify.app/`) ชี้ไป deploy ล่าสุดนั้นจริง
- [ ] หาก release จาก working tree ที่ใหม่กว่า GitHub ต้อง push GitHub ให้ตามมาด้วยเพื่อให้ trace กลับได้

หลัง deploy ให้บันทึก:

- Git commit SHA
- Netlify deploy ID/URL
- Netlify published deploy ID
- Apps Script deployment ID/version หาก backend เปลี่ยน
- ผู้ deploy และเวลาที่ deploy

## 10. Production Smoke Test

ทดสอบที่ `https://2kfine-dashboard.netlify.app/` ด้วย hard refresh หรือ private window

```powershell
$production = "https://2kfine-dashboard.netlify.app/"
$response = Invoke-WebRequest $production -UseBasicParsing
$response.StatusCode
$response.Headers["Cache-Control"]
```

ต้องได้ HTTP `200` และ header `Cache-Control` สอดคล้องกับ `netlify.toml`

### 10.1 ตรวจว่า Production เป็นเวอร์ชันล่าสุดจริง

ห้ามดูแค่หน้าเว็บเปิดได้ ให้ตรวจไฟล์ที่แก้จริงจาก Production ด้วย โดยเฉพาะไฟล์ JavaScript/CSS ที่เกี่ยวข้องกับงานรอบนั้น

ตัวอย่าง:

```powershell
Invoke-WebRequest https://2kfine-dashboard.netlify.app/js/data.js -UseBasicParsing
Invoke-WebRequest https://2kfine-dashboard.netlify.app/js/filters.js -UseBasicParsing
Invoke-WebRequest https://2kfine-dashboard.netlify.app/js/app.js -UseBasicParsing
```

จากนั้นตรวจ fingerprint ของงานรอบนั้น เช่น:

- ชื่อฟังก์ชันใหม่
- เงื่อนไข filter ใหม่
- ข้อความ UI ใหม่
- className / selector ใหม่

อย่าปิดงานถ้า Production ยังเสิร์ฟโค้ดเก่าแม้ว่า deploy command จะขึ้น success

### 10.2 ตรวจ Published Deploy จาก Netlify

ต้องตรวจจาก Netlify UI หรือ API ว่า deploy ที่ publish อยู่คือ deploy ตัวล่าสุดที่ผ่านการตรวจ ไม่ใช่ deploy เก่าที่ยังค้างเป็น published อยู่

ตัวอย่างสิ่งที่ต้องตรวจจาก Netlify:

- deploy ID ที่เพิ่งสร้างจาก draft
- deploy ID ที่ถูก publish อยู่จริง
- title / context / branch ของ deploy ที่ publish
- เวลาที่ publish ล่าสุด

- [ ] `published_deploy_id` ตรงกับ deploy ล่าสุดที่ตั้งใจปล่อย
- [ ] `published_at` เป็นเวลารอบ release นี้
- [ ] title / branch / context สอดคล้องกับ release ที่ทำจริง

- [ ] URL Production เปิดได้ทั้ง desktop และ mobile
- [ ] favicon, logo, CSS และ JavaScript โหลดครบ
- [ ] Console ไม่มี error
- [ ] backend health และ data ผ่านอีกครั้งจาก endpoint ใน Production config
- [ ] `generated_at` เปลี่ยนเมื่อ reload และข้อมูลใหม่จากต้นทางปรากฏจริง
- [ ] เดือนปัจจุบันถูกเลือกอัตโนมัติ
- [ ] KPI, กราฟ, filter และตารางทำงานครบ
- [ ] ตัวเลขสำคัญเทียบกับ Google Sheet แล้วตรงกัน
- [ ] ไม่มีข้อมูลส่วนบุคคลหรือ debug log ที่ไม่ควรเปิดเผย
- [ ] GitHub `main`, Netlify Production และไฟล์ในเครื่องอ้างอิง release เดียวกัน

## 11. Regression Test ตามส่วนที่แก้

| ส่วนที่แก้ | สิ่งที่ต้องตรวจเพิ่ม |
| --- | --- |
| `js/data.js` / `Code.gs` | parsing, normalization, date, duplicates, amount mismatch, null handling และข้อมูลใหม่ในอนาคต |
| `js/filters.js` | default state, suggestion, filter ผสมหลายค่า, clear/reset และผลลัพธ์ว่าง |
| `js/charts.js` | label วันที่, tooltip, จำนวนรายการ, ยอดเงิน, วันที่ไม่มีข้อมูล และ responsive |
| `js/tables.js` / `css/tables.css` | header ตรง cell, alignment, pagination, sorting, search, long text และ mobile overflow |
| `js/kpi.js` | ยอดรวมและจำนวนรายการตรงกับ filtered rows |
| `index.html` / CSS | semantic structure, asset path, responsive, accessibility และไม่มี layout shift |
| `js/api-config.js` | URL เป็น `/exec`, ไม่มี editor URL และ endpoint ตอบจริง |
| `netlify.toml` | publish path, security headers, cache policy และ redirect หากมี |

## 12. Rollback

หาก Production มีปัญหา ให้หยุดการ deploy เพิ่มและบันทึกอาการก่อนแก้

Frontend:

1. ใช้ Netlify UI เลือก deploy ล่าสุดที่ผ่านการตรวจแล้วและสั่ง Publish deploy
2. ทำ `git revert <bad-commit>` แทนการ rewrite history
3. push revert ไป `main`
4. ทำ Production Smoke Test ใหม่

Backend:

1. ใน Apps Script Deployments เลือก version ก่อนหน้าที่ใช้งานได้
2. คง deployment URL เดิม
3. ตรวจ `health` และ `data`
4. ตรวจ frontend Production ว่ากลับมาเข้ากันได้

ห้ามใช้ `git reset --hard`, force push หรือเปลี่ยน `/exec` URL โดยไม่มีการอนุมัติและแผนกู้คืน

## 13. Definition of Done

ปิดงานได้เมื่อครบทุกข้อที่เกี่ยวข้อง:

- [ ] Requirement ล่าสุดถูกทำครบและไม่มีส่วนเกินที่ไม่ร้องขอ
- [ ] Diff ผ่านการอ่านทบทวนและ syntax checks ผ่าน
- [ ] Local และ Netlify Preview ผ่าน functional/responsive checks
- [ ] Backend จริงผ่าน health/data checks หากมีการแก้ backend
- [ ] Business totals และตัวอย่างข้อมูลตรงกับ Google Sheet
- [ ] Commit และ push สำเร็จ โดย Production ตรงกับ release artifact ที่ระบุ
- [ ] Netlify Production ผ่าน smoke test
- [ ] Netlify `published_deploy_id` ตรงกับ deploy ที่ตรวจและตั้งใจปล่อย
- [ ] Production file fingerprints ยืนยันว่าเป็นโค้ดล่าสุดจริง
- [ ] ไม่มี secret, token, ข้อมูลส่วนบุคคล หรือไฟล์ต้นทางหลุดเข้า Git
- [ ] มีหลักฐาน release และระบุ test ที่ทำจริง
- [ ] ข้อจำกัดหรือ test ที่ทำไม่ได้ถูกแจ้งอย่างตรงไปตรงมา
- [ ] มี rollback path ที่ใช้งานได้

## 14. รูปแบบรายงานปิดงาน

```text
Release: <ชื่อ/วันที่>
Scope: <frontend/backend/files>
Git commit: <SHA>
GitHub push: PASS/FAIL
Apps Script deployment: <ID/version หรือ N/A>
Backend health/data: PASS/FAIL/N/A
Netlify preview: <URL>
Netlify production: <URL>
Desktop/tablet/mobile: PASS/FAIL
Data reconciliation: <จำนวนแถวและยอดที่ตรวจ>
Console/Network errors: NONE/<รายละเอียด>
Rollback target: <deploy/version>
Known limitations: NONE/<รายละเอียด>
Final status: READY / NOT READY
```

ใช้ `READY` เฉพาะเมื่อ Definition of Done ผ่านครบ หากมีข้อใดตรวจไม่ได้ ให้ใช้ `NOT READY` หรือระบุว่าเสร็จเฉพาะ local ห้ามสรุปเกินหลักฐาน

## 15. กติกาสำหรับ AI Agent

AI agent ที่ทำงานใน repo นี้ต้องปฏิบัติดังนี้:

1. อ่าน code path จริงและไฟล์ที่เกี่ยวข้องก่อนเสนอหรือแก้ไข ห้ามเดาโครงสร้างจากภาพอย่างเดียว
2. รักษาขอบเขตงาน แก้เฉพาะส่วนที่จำเป็น และใช้ pattern เดิมของ repo
3. ตรวจ `git status` ก่อนและหลังแก้ ห้ามย้อนหรือลบการเปลี่ยนแปลงของผู้ใช้
4. ห้ามนำ credential, PAT, OTP หรือ secret ที่ผู้ใช้ส่งมาใส่ในไฟล์, command history, commit หรือคำตอบ
5. หากพบ credential ถูกเปิดเผย ให้แจ้งให้ revoke/rotate และใช้วิธี authentication ที่ปลอดภัย
6. ห้าม deploy, push, เปลี่ยนสิทธิ์ หรือสร้าง external side effect หากผู้ใช้ยังไม่ได้อนุญาตในงานนั้น
7. ก่อน deploy ต้องทำ checklist ที่เกี่ยวข้องและรายงานผลจากหลักฐานจริง ไม่ใช้คำว่า `100%` จากการตรวจ syntax เพียงอย่างเดียว
8. ต้องตรวจทั้ง happy path, empty/error state, responsive และข้อมูลใหม่ในอนาคตตาม contract
9. เมื่อ backend และ frontend เปลี่ยนพร้อมกัน ให้ deploy ตามลำดับที่ยังรองรับเวอร์ชันเดิม และตรวจ endpoint ก่อน deploy frontend
10. หากเครื่องมือหรือสิทธิ์ทำให้ตรวจบางส่วนไม่ได้ ต้องบอกตรง ๆ ว่าอะไรยังไม่ถูกตรวจ และห้ามปิดงานเป็น `READY`
11. ก่อน commit ให้แสดง/ตรวจ staged diff และเพิ่มไฟล์แบบระบุชื่อเท่านั้น
12. หลัง deploy ต้องตรวจ Production URL จริง ไม่ถือว่า CLI แสดงคำว่า success แล้วงานเสร็จ
13. ห้ามสมมติว่า Netlify ของ repo นี้มี auto deploy จาก GitHub; ต้องตรวจจาก Netlify UI/API ก่อนทุกครั้ง
14. ถ้า `git push` สำเร็จแต่ Production ยังเป็นเวอร์ชันเก่า ให้ตรวจ `published_deploy_id`, deploy history และ file fingerprints ก่อนสรุป
15. ถ้า `netlify deploy --prod` ใช้ไม่ได้ ให้สร้าง draft deploy ที่ผ่านการตรวจ แล้ว publish draft deploy นั้นขึ้น Production แทน
16. รายงานปิดงานต้องสั้น ชัด และมี commit, deployment, published deploy ID, test result, limitation และ rollback target

เป้าหมายของ agent ไม่ใช่เพียงทำให้โค้ดเปลี่ยน แต่ต้องทำให้การเปลี่ยนแปลงนั้นตรวจสอบย้อนกลับได้, ปลอดภัย, ตรงข้อมูลจริง และพร้อมกู้คืนเมื่อเกิดปัญหา
