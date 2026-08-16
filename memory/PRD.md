# SELISIH — PRD

## Problem
Indonesian distributors reconcile three documents (Purchase Order, Surat Jalan, Faktur) by hand. Anything they miss is money the company pays for. SELISIH compares the three side-by-side and shows the exact rupiah being overcharged.

## Persona
Finance/admin staff at Indonesian FMCG distributor, working from Excel exports, needs a fast paper-like tool without login.

## Core Requirements (static)
- UI fully in Bahasa Indonesia
- Compare PO / Surat Jalan / Faktur by SKU
- 8 discrepancy rules: KURANG KIRIM, BARANG RUSAK, TAGIH LEBIH, HARGA TIDAK SESUAI, TIDAK ADA DI PO, KIRIM LEBIH, BELUM DITAGIH, COCOK
- All money as whole rupiah integers, `Rp 2.880.000` display format
- Paste from Excel with tab/comma/semicolon auto-detect
- Carbon-copy visual: white PO, yellow SJ, pink Faktur, stamp red only for discrepancies
- Nota Retur printable via browser print-to-PDF with terbilang and signature blocks
- Read-only supplier link via tokenised URL + WhatsApp share
- No auth, no third-party APIs, no payment

## Architecture
- Backend: FastAPI + MongoDB (Motor async). Endpoints prefixed `/api`.
- Frontend: React + react-router + axios. All views in `App.js`.
- Seed script runs on startup to inject the 3 example reconciliations.
- Fonts: Archivo (headings), Instrument Sans (body), IBM Plex Mono (all numbers/SKU) — via Google Fonts.
- Colors: `#F2F2ED` bg, `#FFFFFF` PO, `#F6E7A9` SJ, `#F5CBD1` Faktur, `#2F6B4F` matched green, `#C0272D` stamp red (discrepancies only).

## Implemented (Feb 2026)
- Dashboard listing all reconciliations with running `Total selisih ditemukan`
- New reconciliation wizard (paste PO / SJ / Faktur, preview, download template)
- Comparison logic with all 8 rules, split delivery aggregation, whole-integer math
- Comparison sheet with three stacked copy-color rows, red rule + red figures on discrepancies, per-product rupiah impact in largest mono type
- Result row stagger animation (40ms/240ms) and count-up total, honours `prefers-reduced-motion`
- Nota Retur A4 print layout with terbilang (up to miliar) + Dibuat oleh / Disetujui oleh signature block
- Tokenised share link `/bagikan/{token}` + WhatsApp deep-link
- Mobile tap-to-expand product block
- Graceful Indonesian 404 state for invalid reconciliation IDs
- Seed data: REK-2026-0039 (12 items, Rp 0), REK-2026-0040 (18 items, Rp 34.5 juta including split SJ), REK-2026-0041 (9 items, Rp 26 juta)

## Endpoints
- `GET /api/reconciliations` — list + total_found
- `POST /api/reconciliations` — create + compare
- `GET /api/reconciliations/{id_or_share_token}` — detail

## Backlog / P1
- Inline edit of failed paste rows
- Delete/archive reconciliation from dashboard
- Reduced-motion CSS toggle indicator
- Split App.js into pages/components directory

## Backlog / P2
- Export nota retur as XLSX
- History log per supplier with running claim total
- CSV template with sample rows pre-filled
