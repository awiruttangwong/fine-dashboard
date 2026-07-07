# Live GAS Package

โฟลเดอร์นี้เตรียมไว้สำหรับ Apps Script project:

- Script ID: `1qn1gCLwH26wctoRQb4t5AHfWskx4DaluyWiIgi-f9vNIgnO01c5qn-Fn`
- Spreadsheet ID: `1sF_ZHOwDGV55jA3WV_vqCh0aII_su2hFYaNmHh5xtLk`

ไฟล์ในนี้เป็น package สำหรับ `clasp push` โดยตรง เพื่อไม่ให้ชนกับ `.clasp.json` และ `.claspignore` ชุดเดิมที่ root ของ repo

คำสั่งใช้งาน:

```powershell
cd backend/live-gas
cmd /c clasp push -f
```

หลัง push แล้ว ให้ไปที่ Apps Script:

1. รัน `executeCentralDataSync`
2. ตรวจ `action=health`
3. ตรวจ `action=data`
