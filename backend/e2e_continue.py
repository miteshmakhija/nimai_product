"""Continue E2E from Step 2 (confirm) using existing run_id."""
import requests
import time
import json

BASE = "http://localhost:8000"
RUN_ID = "7f86c8a1-17fa-4610-b68e-6274caf26978"

def main():
    # Login
    r = requests.post(f"{BASE}/auth/login", data={"username": "admin@nimai.ai", "password": "password!123"})
    r.raise_for_status()
    token = r.json()["access_token"]
    hdrs = {"Authorization": f"Bearer {token}"}
    print("[1] Login OK")

    # Check current run status
    r = requests.get(f"{BASE}/rfqs/{RUN_ID}", headers=hdrs, timeout=30)
    run = r.json()
    print(f"[2] Current status: {run['status']}")
    print(f"    Company: {run.get('meta_company_name')}, Product: {run.get('meta_product')}")
    print(f"    RFQ#: {run.get('meta_rfq_number')}, Date: {run.get('meta_rfq_date')}")

    if run["status"] not in ("pending_confirmation", "pending_data", "queued", "processing"):
        print(f"    Unexpected status — proceeding anyway")

    # Step 2: Confirm metadata
    if run["status"] == "pending_confirmation":
        print("[3] Confirming metadata...")
        confirm_payload = {
            "meta_company_name": run.get("meta_company_name"),
            "meta_product": run.get("meta_product"),
            "meta_rfq_date": run.get("meta_rfq_date"),
            "meta_rfq_number": run.get("meta_rfq_number"),
        }
        t0 = time.time()
        r = requests.post(f"{BASE}/rfqs/{RUN_ID}/confirm", json=confirm_payload, headers=hdrs, timeout=300)
        elapsed = time.time() - t0
        print(f"    HTTP {r.status_code} in {elapsed:.1f}s")
        if r.status_code != 200:
            print("ERROR:", r.text[:500])
            return
        confirm_data = r.json()
        print(f"    Status     : {confirm_data['status']}")
        data_points = confirm_data.get("data_points", [])
        print(f"    Data points: {len(data_points)}")
        for dp in data_points:
            print(f"      {dp['key']}: {dp.get('value')} ({dp.get('source')})")
    else:
        print("[3] Skipping confirm (not in pending_confirmation)")
        data_points = []

    # Step 3: Submit data
    if run["status"] in ("pending_confirmation", "pending_data"):
        print("[4] Submitting data points...")
        submit_payload = {"data_points": [{"key": dp["key"], "value": dp.get("value")} for dp in data_points]}
        r = requests.post(f"{BASE}/rfqs/{RUN_ID}/submit-data", json=submit_payload, headers=hdrs, timeout=30)
        print(f"    HTTP {r.status_code}")
        if r.status_code == 200:
            print(f"    Status: {r.json()['status']}")
        elif r.status_code == 422:
            print("    Validation error:", r.text[:300])
            return
        else:
            print("ERROR:", r.text[:300])
            return
    else:
        print("[4] Skipping submit-data (already queued/processing)")

    # Poll until done
    print("[5] Polling pipeline status...")
    for i in range(60):
        time.sleep(10)
        r = requests.get(f"{BASE}/rfqs/{RUN_ID}", headers=hdrs, timeout=30)
        run = r.json()
        status = run["status"]
        print(f"    [{i+1:02d}] status={status}")
        if status == "done":
            print("[6] Pipeline DONE!")
            result = run.get("result_json")
            if result:
                keys = list(result.keys()) if isinstance(result, dict) else type(result)
                print(f"    result_json keys: {keys}")
                print(f"    Preview:\n{json.dumps(result, indent=2)[:800]}")
            else:
                print("    result_json is empty!")
            break
        elif status == "failed":
            print("[6] Pipeline FAILED")
            print("    Check celery.log for details")
            break
    else:
        print("[6] Timed out after 10 minutes")

if __name__ == "__main__":
    main()
