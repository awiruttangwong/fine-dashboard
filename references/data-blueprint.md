# Fine Dashboard Data Blueprint

## Source Inventory

- Source workbook: `Data ค่าปรับ.xlsx`
- Source sheet: `data`
- Used range: `A1:Z123`
- Actual data range: `A1:I123`
- Header row: `1`
- Data rows: `122`
- Columns `J:Z`: currently empty and should be ignored in ingestion.
- Excel tables: none
- Formulas: none found
- Merged ranges: none

## Raw Columns

| Excel | Raw header | Canonical field | Type target | Current profile | Notes |
|---|---|---|---|---|---|
| A | วันที่ | `fine_date_raw`, `fine_date` | date | 122 nonblank; 62 Excel datetime, 60 text | Mixed date encoding. Normalize with audit status. |
| B | ลูกค้า | `customer` | category text | 122 nonblank; 2 unique | Values: `FLASH` 117 rows, `SPX` 5 rows. |
| C | บาร์โค้ด | `barcode` | identifier text | 122 nonblank; 113 unique | Not unique in current data; use duplicates as quality signal. |
| D | เส้นทาง | `route_raw` | text | 122 nonblank; 75 unique | Parse useful tokens, but preserve raw route. |
| E | ชื่อ พขร | `driver_name` | person/category text | 117 nonblank, 5 blank; 69 unique | Blank driver rows currently match SPX records. |
| F | ชื่อผู้รับโอน | `transfer_receiver_name` | person/category text | 0 nonblank, 122 blank | Keep field for future collection workflow. |
| G | ยอดปรับ | `fine_amount` | number | 122 nonblank; sum 21,700 | Values: 100, 200, 300, 400, 500. |
| H | ปรับได้ | `paid_amount` | number | 2 nonblank; sum 300 | Treat blank as 0 only in computed layer, not raw layer. |
| I | คงเหลือ | `remaining_amount` | number | 3 nonblank; sum -200 | Current row 25 has `-200` while paid is blank; flag for review. |

## Canonical Fields

| Field | Definition | Rule |
|---|---|---|
| `source_file` | Workbook name | Always `Data ค่าปรับ.xlsx` for this source. |
| `source_sheet` | Worksheet name | Always `data` for this source. |
| `source_row` | Excel row number | Preserve to trace dashboard data back to source. |
| `raw_record_hash` | Stable hash of raw A-I values | Use for full duplicate detection. |
| `fine_date_raw` | Exact source date value as text | Keep before normalization. |
| `fine_date` | Normalized ISO date | Use `yyyy-mm-dd` after date rule below. |
| `fine_date_parse_status` | Date QA status | Values: `ok_text_dmy`, `ok_excel_serial_swapped`, `ok_excel_serial_as_is`, `invalid`, `needs_review`. |
| `customer` | Customer/platform | Trim whitespace, preserve uppercase. |
| `barcode` | Shipment/penalty identifier | Trim; keep as text; do not coerce to number. |
| `route_raw` | Full route string | Preserve exactly after trimming. |
| `route_group` | First route token | Example: `FD`, `LH`, `CPU`, `SHOP`, `FSOCW1`. |
| `vehicle_type` | Vehicle-like route token | Examples from current data: `4W`, `4WJ`, `6W7.2`, `14W`, `6W5.5`, `2WNT`, `BTS`. |
| `route_time` | First `HH:mm` token from route | Examples: `03:00`, `07:00`, `05:30`. |
| `route_status` | Last status-like token | Usually `RO`, `RS1`, `RS2`; preserve odd suffixes for QA. |
| `route_tokens` | Route split by `-` | Use for drill-down/search. |
| `driver_name` | Driver name | Trim; blank becomes null. |
| `transfer_receiver_name` | Receiver name | Trim; blank becomes null. |
| `fine_amount` | Original fine amount | Numeric; required. |
| `paid_amount` | Amount collected/paid | Numeric; raw blank stays null; computed layer may treat null as 0. |
| `remaining_amount` | Source remaining value | Numeric nullable. |
| `computed_remaining_amount` | `fine_amount - COALESCE(paid_amount, 0)` | Used to detect mismatches; dashboard can show computed if source remaining is blank. |
| `payment_status` | Collection status | See payment status rules. |

## Date Normalization Rule

Current source has mixed date representations:

- 62 cells are Excel datetimes with number format `mm/dd/yyyy`, such as stored value `2026-01-06`.
- 60 cells are text dates, such as `13/06/2026`, `18/06/2026`, and `21/06/2026`.

Business-context inference: the dataset appears to cover June 1-21, 2026. Rows with Excel datetime values like `2026-01-06`, `2026-02-06`, ..., `2026-12-06` likely mean `01/06/2026`, `02/06/2026`, ..., `12/06/2026`, because the later rows continue as text dates `13/06/2026` through `21/06/2026`.

Implementation rule for the first script draft:

1. If raw value is text matching `d/m/yyyy` or `dd/mm/yyyy`, parse as day-first and set `fine_date_parse_status = ok_text_dmy`.
2. If raw value is an Excel datetime in this workbook, year is `2026`, day is `6`, and month is `1..12`, normalize by swapping month/day to June day `1..12`, then set `fine_date_parse_status = ok_excel_serial_swapped`.
3. If future Excel datetime values do not match that pattern, keep the actual date and set `fine_date_parse_status = ok_excel_serial_as_is` only after review.
4. If parsing fails, set `fine_date = null` and `fine_date_parse_status = invalid`.

Do not silently aggregate by date until `fine_date_parse_status` is included in QA output.

## Current Aggregates

| Metric | Value |
|---|---:|
| Fine rows | 122 |
| Total fine amount | 21,700 |
| Paid amount recorded | 300 |
| Source remaining sum where filled | -200 |
| Customers | 2 |
| Unique barcodes | 113 |
| Unique routes | 75 |
| Unique drivers excluding blanks | 69 |
| Blank driver rows | 5 |
| Blank receiver rows | 122 |
| Full duplicate rows | 1 |
| Duplicate barcodes | 9 barcode values |

Customer split:

| Customer | Rows | Fine amount | Paid amount |
|---|---:|---:|---:|
| FLASH | 117 | 20,400 | 300 |
| SPX | 5 | 1,300 | 0 |

Top route groups:

| Route group | Rows |
|---|---:|
| FD | 79 |
| LH | 25 |
| CPU | 6 |
| SHOP | 4 |
| FSOCW1 | 4 |
| DD1 | 3 |
| FSOCN | 1 |

Top route status/suffix values:

| Status/suffix | Rows |
|---|---:|
| RO | 73 |
| RS1 | 23 |
| RS2 | 18 |
| SOCN | 4 |
| Other odd suffixes | 4 |

## Quality Findings To Preserve

- Full duplicate row: row values for `19/06/2026`, `FLASH`, barcode `BKK1R63R18`, route `SHOP-4W-BSU-LAS-20:30-BD-RO`, driver `ณัฐพงษ์ ศรีคุณ`, fine `200` appears twice.
- Duplicate barcode values currently found: `SAM1QHPQ45`, `KKC1QM2E72`, `UTH1QMN727`, `AYU1QZ7A54`, `SAM1R0X872`, `NAK1R4BM72`, `BKK1R52K45`, `BFV1R4A109`, `BKK1R63R18`.
- `ชื่อผู้รับโอน` is blank for every current row; do not build receiver analytics until populated.
- `คงเหลือ` is mostly blank. Row 25 has `remaining_amount = -200` while `paid_amount` is blank and `fine_amount = 200`; flag as `has_amount_mismatch`.
- No formulas exist, so computed dashboard fields must be generated by script/model layer.

## Payment Status Rules

Use source fields plus computed fields:

| Status | Rule |
|---|---|
| `paid` | `paid_amount >= fine_amount` and computed remaining is `0` or less, with no mismatch flag. |
| `partial` | `paid_amount > 0` and `paid_amount < fine_amount`. |
| `open` | `paid_amount` is null or `0`, and no source remaining mismatch exists. |
| `overpaid` | `paid_amount > fine_amount`. |
| `data_error` | Source `remaining_amount` is present and differs from `fine_amount - COALESCE(paid_amount, 0)`, or values are negative unexpectedly. |

## Route Parsing Heuristics

Keep parsing conservative:

1. Split `route_raw` by `-`.
2. `route_group` is token 1.
3. `vehicle_type` is the first token matching known vehicle patterns or the current observed vehicle set.
4. `route_time` is the first token matching `^\d{1,2}:\d{2}$`.
5. `route_status` is the last token when it matches `RO`, `RS1`, `RS2`, `SOCN`, or `SOCE`; otherwise set `route_status = needs_review` and keep the raw suffix.
6. Keep `route_tokens` for search/filtering because route formats are not uniform.

Current notable route examples:

- `FD-4W-CT1-KLH-SWC-03:00-BD-1-RO`
- `LH-6W7.2-NE3-LAS-22:45-BD-78-RS2`
- `SHOP-4W-BSU-LAS-20:30-BD-RO`
- `FSOCW1-SOCN`

## Data Pipeline Structure For Later Scripts

Recommended layers:

1. `raw_rows`: direct read of worksheet rows A-I with `source_row`.
2. `normalized_rows`: trimmed text, normalized dates, numeric coercion, parsed route fields.
3. `quality_flags`: duplicate/missing/mismatch flags joined by `source_row`.
4. `fact_fines`: one canonical fine event per source row unless dedup policy is explicitly enabled.
5. `dim_customer`, `dim_driver`, `dim_route`, `dim_date`: derived dimensions for dashboard filters.
6. `dashboard_metrics`: pre-aggregated totals for KPI cards/charts.

Do not drop duplicates automatically in the first implementation. Show both raw totals and duplicate-adjusted totals only after a dedup rule is confirmed.

## Dashboard Data Contract

Future dashboard components should expect:

- KPI cards: `fine_count`, `total_fine_amount`, `paid_amount`, `computed_remaining_amount`, `collection_rate`, `data_quality_issue_count`
- Filters: date range, customer, driver, route group, vehicle type, route status, payment status, quality flag
- Charts: daily fine trend, fine amount by customer, top drivers, top routes, route group distribution, payment status distribution
- Tables: raw fine list, duplicate barcode watchlist, amount mismatch watchlist, blank driver/receiver watchlist

## Open Decisions

- Confirm whether Excel dates stored as `2026-01-06` through `2026-12-06` should be treated as June 1-12, 2026.
- Decide whether duplicate barcodes represent separate fines or duplicate source records.
- Decide whether blank `ชื่อผู้รับโอน` means unpaid, unknown receiver, or not yet tracked.
- Decide whether `คงเหลือ` should be source truth or recalculated from `ยอดปรับ - ปรับได้`.
