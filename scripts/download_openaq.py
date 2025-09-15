#!/usr/bin/env python3
# scripts/download_openaq.py
# Fetch a small sample (limit * pages rows) from OpenAQ v3 measurements API
# Saves: data/raw/openaq_pm25_sample.csv

import requests, time, csv, sys
from pathlib import Path

OUT_DIR = Path.cwd() / "data" / "raw"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_CSV = OUT_DIR / "openaq_pm25_sample.csv"

BASE = "https://api.openaq.org/v3/measurements"
LIMIT = 1000      # rows per page
PAGES = 5         # total pages -> adjust to get more/less rows

print(f"Fetching up to {LIMIT * PAGES} rows from OpenAQ v3...")

rows = []
for page in range(1, PAGES + 1):
    params = {"limit": LIMIT, "page": page, "parameter": "pm25", "sort": "desc"}
    try:
        r = requests.get(BASE, params=params, timeout=30)
    except Exception as e:
        print("Request failed:", e)
        sys.exit(1)

    if r.status_code == 410:
        print("OpenAQ API returned 410 Gone. Aborting v3 fetch.")
        sys.exit(2)
    r.raise_for_status()
    data = r.json()
    results = data.get("results", [])
    print(f"Page {page}: {len(results)} rows")
    for item in results:
        coords = item.get("coordinates") or {}
        date = item.get("date") or {}
        date_utc = date.get("utc") or date.get("utc")
        rows.append({
            "station_id": item.get("location") or "",
            "station_name": item.get("location") or "",
            "city": item.get("city"),
            "country": item.get("country"),
            "lat": coords.get("latitude"),
            "lon": coords.get("longitude"),
            "parameter": item.get("parameter"),
            "value": item.get("value"),
            "unit": item.get("unit"),
            "date_utc": date_utc
        })
    # polite pause
    time.sleep(1)

if len(rows) == 0:
    print("No rows fetched from OpenAQ v3. Exiting with code 3.")
    sys.exit(3)

fieldnames = ["station_id","station_name","city","country","lat","lon","parameter","value","unit","date_utc"]
with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    for row in rows:
        w.writerow(row)

print("Saved sample CSV to:", OUT_CSV)
