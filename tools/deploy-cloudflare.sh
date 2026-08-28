#!/usr/bin/env bash
# Deploy Fine Dashboard to Cloudflare Pages (project: 2kfine-dashboard).
#
# Cloudflare Pages' _redirects "force" (!) does NOT override an existing
# static file the way Netlify's forced redirects do — a real file at
# /backend/live-gas/Code.gs is served as-is regardless of any _redirects
# rule pointed at it. So instead of trying to block sensitive paths after
# upload, this script only ever uploads the files the public site needs:
# index.html, css/, js/, icons/, _headers. Everything else in the repo
# (backend/, docs/, tools/, references/, skills/, Code.gs, etc.) never
# leaves the machine.
set -euo pipefail
cd "$(dirname "$0")/.."

STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT

cp -r index.html css js icons _headers "$STAGE_DIR/"

# xlsx-comparison/ (โมดูลอัพโหลดขึ้นฐานข้อมูล) — คัดลอกเฉพาะ index.html/css/js เท่านั้น
# ห้ามคัดลอกทั้งโฟลเดอร์ เพราะมีไฟล์ "เปรียบเทียบค่าปรับ Acc Vs Express.xlsx" (ข้อมูล
# ลูกค้า/ยอดเงินจริง) วางอยู่ข้างในสำหรับทดสอบ local เท่านั้น ต้องไม่หลุดขึ้นเว็บสาธารณะ
mkdir -p "$STAGE_DIR/xlsx-comparison"
cp -r xlsx-comparison/index.html xlsx-comparison/css xlsx-comparison/js "$STAGE_DIR/xlsx-comparison/"

npx --yes wrangler pages deploy "$STAGE_DIR" \
  --project-name 2kfine-dashboard \
  --branch main \
  --commit-dirty=true
