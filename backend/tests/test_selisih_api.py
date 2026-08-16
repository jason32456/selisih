import os
import uuid
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://selisih-compare.preview.emergentagent.com").rstrip("/")


def test_seed_list_and_total():
    r = requests.get(f"{BASE_URL}/api/reconciliations", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert len(data["items"]) == 3
    assert data["total_found"] == sum(x["total_discrepancy"] for x in data["items"])
    clean = next(x for x in data["items"] if x["reference"] == "REK-2026-0039")
    assert clean["total_discrepancy"] == 0


def test_seed_detail_and_share_token():
    items = requests.get(f"{BASE_URL}/api/reconciliations", timeout=15).json()["items"]
    item = next(x for x in items if x["reference"] == "REK-2026-0040")
    detail = requests.get(f"{BASE_URL}/api/reconciliations/{item['id']}", timeout=15)
    assert detail.status_code == 200
    body = detail.json()
    assert body["products"] and body["total_discrepancy"] > 0
    shared = requests.get(f"{BASE_URL}/api/reconciliations/{body['share_token']}", timeout=15)
    assert shared.status_code == 200
    assert shared.json()["id"] == body["id"]


def test_create_persists_and_comparison_rules():
    sku = f"TEST-{uuid.uuid4().hex[:8]}"
    payload = {
        "supplier_name": "TEST Pemasok",
        "reference": "TEST-REK",
        "po_lines": [{"sku": sku, "name": "Produk", "unit": "karton", "quantity": 10, "unit_price": 1000}],
        "delivery_lines": [{"sku": sku, "name": "Produk", "unit": "karton", "quantity": 8, "damaged": 1}],
        "invoice_lines": [{"sku": sku, "name": "Produk", "unit": "karton", "quantity": 9, "unit_price": 1200}],
        "surat_jalan_numbers": [], "po_number": "", "faktur_number": "",
    }
    created = requests.post(f"{BASE_URL}/api/reconciliations", json=payload, timeout=15)
    assert created.status_code == 200
    body = created.json()
    assert body["reference"] == "TEST-REK"
    assert {x["type"] for x in body["products"][0]["issues"]} == {"KURANG KIRIM", "BARANG RUSAK", "TAGIH LEBIH", "HARGA TIDAK SESUAI"}
    fetched = requests.get(f"{BASE_URL}/api/reconciliations/{body['id']}", timeout=15)
    assert fetched.status_code == 200
    assert fetched.json()["total_discrepancy"] == body["total_discrepancy"]