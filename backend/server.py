from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List
import os
import uuid

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
app = FastAPI(title="SELISIH")
api = APIRouter(prefix="/api")

class ReconciliationCreate(BaseModel):
    supplier_name: str
    reference: str = ""
    po_number: str = ""
    surat_jalan_numbers: List[str] = []
    faktur_number: str = ""
    po_lines: List[Dict[str, Any]]
    delivery_lines: List[Dict[str, Any]]
    invoice_lines: List[Dict[str, Any]]

def money(value: Any) -> int:
    return int(value or 0)

def compare_documents(data: ReconciliationCreate) -> Dict[str, Any]:
    po = {str(x.get("sku", "")).strip(): x for x in data.po_lines if str(x.get("sku", "")).strip()}
    received: Dict[str, Dict[str, Any]] = {}
    for line in data.delivery_lines:
        sku = str(line.get("sku", "")).strip()
        if not sku: continue
        item = received.setdefault(sku, {"sku": sku, "name": line.get("name", ""), "unit": line.get("unit", ""), "quantity": 0, "damaged": 0})
        item["quantity"] += money(line.get("quantity"))
        item["damaged"] += money(line.get("damaged"))
    invoice = {str(x.get("sku", "")).strip(): x for x in data.invoice_lines if str(x.get("sku", "")).strip()}
    skus = list(dict.fromkeys([*po.keys(), *received.keys(), *invoice.keys()]))
    products = []
    total = 0
    for sku in skus:
        p, d, f = po.get(sku, {}), received.get(sku, {}), invoice.get(sku, {})
        ordered, arrived, billed = money(p.get("quantity")), money(d.get("quantity")), money(f.get("quantity"))
        po_price, billed_price = money(p.get("unit_price")), money(f.get("unit_price"))
        damaged = money(d.get("damaged"))
        issues = []
        if p and arrived < ordered: issues.append({"type": "KURANG KIRIM", "value": (ordered-arrived)*po_price})
        if damaged: issues.append({"type": "BARANG RUSAK", "value": damaged*po_price})
        if f and billed > arrived: issues.append({"type": "TAGIH LEBIH", "value": (billed-arrived)*billed_price})
        if f and p and billed_price != po_price: issues.append({"type": "HARGA TIDAK SESUAI", "value": abs(billed_price-po_price)*billed})
        if f and not p: issues.append({"type": "TIDAK ADA DI PO", "value": billed*billed_price})
        if p and arrived > ordered: issues.append({"type": "KIRIM LEBIH", "value": 0})
        if d and not f: issues.append({"type": "BELUM DITAGIH", "value": 0})
        for issue in issues: total += money(issue["value"])
        products.append({"sku": sku, "name": p.get("name") or f.get("name") or d.get("name", ""), "unit": p.get("unit") or f.get("unit") or d.get("unit", ""), "po": {"quantity": ordered, "unit_price": po_price}, "delivery": {"quantity": arrived, "damaged": damaged}, "invoice": {"quantity": billed, "unit_price": billed_price}, "issues": issues, "impact": sum(money(i["value"]) for i in issues)})
    return {"products": products, "total_discrepancy": total}

def seed_lines(names: List[str], base: str, qty: int, price: int):
    return [{"sku": f"{base}-{i:03d}", "name": n, "unit": "karton", "quantity": qty, "unit_price": price} for i, n in enumerate(names, 1)]

async def ensure_seed():
    if await db.reconciliations.count_documents({}): return
    names = ["Minyak Goreng 2L", "Beras Pulen 5kg", "Gula Pasir", "Kecap Manis", "Mie Instan Goreng", "Susu Kental Manis", "Tepung Terigu", "Teh Celup", "Kopi Bubuk", "Sarden Kaleng", "Biskuit", "Air Mineral"]
    p = seed_lines(names, "MGR-2L", 100, 240000)
    matching = {"supplier_name": "CV Sumber Pangan Jaya", "reference": "REK-2026-0039", "po_number": "PO-0039", "surat_jalan_numbers": ["SJ-0039"], "faktur_number": "FK-0039", "po_lines": p, "delivery_lines": [{**x, "damaged": 0} for x in p], "invoice_lines": p}
    n2 = names + ["Saus Sambal", "Kornet Sapi", "Cokelat Batang", "Susu UHT", "Minuman Teh", "Minyak Goreng 1L"]
    p2 = seed_lines(n2, "SKU-FMCG", 100, 250000)
    d2 = [{**x, "damaged": 0, "quantity": x["quantity"]} for x in p2]; d2[0]["quantity"] = 88; d2[1]["damaged"] = 2; d2[2]["quantity"] = 90; d2[3]["quantity"] = 60
    f2 = [dict(x) for x in p2]; f2[4]["unit_price"] = 280000
    examples = [matching, {"supplier_name": "PT Mitra Boga Nusantara", "reference": "REK-2026-0040", "po_number": "PO-0040", "surat_jalan_numbers": ["SJ-0040-A", "SJ-0040-B"], "faktur_number": "FK-0040", "po_lines": p2, "delivery_lines": d2, "invoice_lines": f2}, {"supplier_name": "UD Anugerah Sentosa", "reference": "REK-2026-0041", "po_number": "PO-0041", "surat_jalan_numbers": ["SJ-0041"], "faktur_number": "FK-0041", "po_lines": p2[:9], "delivery_lines": [{**x, "quantity": 60, "damaged": 0} if x["sku"] == p2[0]["sku"] else {**x, "quantity": x["quantity"], "damaged": 0} for x in p2[:9]], "invoice_lines": [*p2[:9], {"sku": "TAMBAHAN-001", "name": "Barang Tambahan", "unit": "karton", "quantity": 10, "unit_price": 300000}] }]
    for item in examples:
        result = compare_documents(ReconciliationCreate(**item)); item.update(result); item.update({"id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat(), "share_token": uuid.uuid4().hex})
        await db.reconciliations.insert_one(item)

@api.get("/")
async def root(): return {"message": "SELISIH siap digunakan"}

@api.get("/reconciliations")
async def list_reconciliations():
    docs = await db.reconciliations.find({}, {"_id": 0, "po_lines": 0, "delivery_lines": 0, "invoice_lines": 0, "products": 0}).sort("created_at", -1).to_list(1000)
    return {"items": docs, "total_found": sum(money(x.get("total_discrepancy")) for x in docs)}

@api.get("/reconciliations/{rid}")
async def get_reconciliation(rid: str):
    doc = await db.reconciliations.find_one({"$or": [{"id": rid}, {"share_token": rid}]}, {"_id": 0})
    if not doc: raise HTTPException(404, "Rekonsiliasi tidak ditemukan")
    return doc

@api.delete("/reconciliations/{rid}")
async def delete_reconciliation(rid: str):
    result = await db.reconciliations.delete_one({"id": rid})
    if not result.deleted_count: raise HTTPException(404, "Rekonsiliasi tidak ditemukan")
    return {"message": "Rekonsiliasi dihapus"}

@api.post("/reconciliations")
async def create_reconciliation(data: ReconciliationCreate):
    result = compare_documents(data); doc = data.model_dump(); doc.update(result); doc.update({"id": str(uuid.uuid4()), "reference": data.reference or f"REK-{datetime.now().year}-{uuid.uuid4().hex[:4].upper()}", "created_at": datetime.now(timezone.utc).isoformat(), "share_token": uuid.uuid4().hex})
    await db.reconciliations.insert_one(doc)
    return {key: value for key, value in doc.items() if key != "_id"}

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","), allow_methods=["*"], allow_headers=["*"])
@app.on_event("startup")
async def startup(): await ensure_seed()
@app.on_event("shutdown")
async def shutdown(): client.close()