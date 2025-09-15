# scripts/fetch_cpcb_api.py
"""
Fetch PM2.5 live records from data.gov.in CPCB resource and:
 - Append to a historical CSV (data/historical/india_hourly_raw.csv)
 - Write a processed CSV used by backend (data/processed/india_realtime_api.csv)

Reads API key from env var CPCB_API_KEY (falls back to a sample key).
"""
from pathlib import Path
from dotenv import load_dotenv
import os
import re
import requests
import pandas as pd
from datetime import datetime

# Load .env from project root (if present)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# default sample key (replace with your key or set CPCB_API_KEY env var)
DEFAULT_API_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b"
RESOURCE_ID = "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"
BASE_URL = "https://api.data.gov.in/resource"

HERE = Path(__file__).resolve().parent.parent
OUT_DIR = HERE / "data" / "processed"
HIST_DIR = HERE / "data" / "historical"
OUT = OUT_DIR / "india_realtime_api.csv"
HIST = HIST_DIR / "india_hourly_raw.csv"

def make_station_id(station_name, city):
    s = f"{(station_name or '').strip()}__{(city or '').strip()}"
    slug = re.sub(r"\W+", "_", s).strip("_")
    return f"CPCB_{slug}"

def fetch_data(limit=1000, api_key=None):
    api_key = api_key or os.getenv("CPCB_API_KEY") or DEFAULT_API_KEY
    print(f"Using API key prefix: {str(api_key)[:8]}...")

    url = f"{BASE_URL}/{RESOURCE_ID}?api-key={api_key}&format=json&limit={limit}"
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    records = data.get("records", [])
    if not records:
        print("⚠️ No records returned from API.")
        return None

    df = pd.DataFrame(records)

    # keep only PM2.5 rows (robust)
    if "pollutant_id" not in df.columns:
        print("⚠️ 'pollutant_id' column missing in API response.")
        return None

    df = df[df["pollutant_id"].astype(str).str.strip().str.upper().str.contains("PM2.5")].copy()
    if df.empty:
        print("⚠️ No PM2.5 rows in fetched data.")
        return None

    # rename columns
    df = df.rename(columns={
        "station": "station_name",
        "latitude": "lat",
        "longitude": "lon",
        "avg_value": "pm25",
        "last_update": "datetime_utc",
        "state": "state",
        "city": "city",
    })

    # ensure string types for id building
    df["station_name"] = df["station_name"].astype(str)
    df["city"] = df["city"].astype(str)

    # build a stable station_id
    df["station_id"] = df.apply(lambda r: make_station_id(r["station_name"], r["city"]), axis=1)

    # add missing country column (backend expects 'country')
    df["country"] = "India"

    # normalize datatypes
    df["pm25"] = pd.to_numeric(df["pm25"], errors="coerce")
    df["datetime_utc"] = pd.to_datetime(df["datetime_utc"], errors="coerce", dayfirst=True)

    # drop invalid rows
    df = df.dropna(subset=["datetime_utc", "pm25", "station_id"])

    # keep only needed columns (order matches backend expectations)
    df = df[["station_id", "station_name", "state", "city", "country", "datetime_utc", "pm25", "lat", "lon"]]

    # ensure directories exist
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    HIST_DIR.mkdir(parents=True, exist_ok=True)

    # append to historical CSV and dedupe by (station_id, datetime_utc)
    if HIST.exists():
        hist_df = pd.read_csv(HIST, parse_dates=["datetime_utc"])
        combined = pd.concat([hist_df, df], ignore_index=True)
        combined = combined.drop_duplicates(subset=["station_id", "datetime_utc"], keep="last")
    else:
        combined = df.copy()

    # sort and save history
    combined = combined.sort_values(["station_id", "datetime_utc"])
    combined.to_csv(HIST, index=False)

    # save processed CSV for backend use
    combined.to_csv(OUT, index=False)

    print(f"✅ Saved {len(df)} PM2.5 rows (fetched) — total historical rows: {len(combined)}")
    return {"fetched": len(df), "historical_total": len(combined), "out": str(OUT), "hist": str(HIST)}

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Fetch CPCB PM2.5 realtime data")
    parser.add_argument("--limit", type=int, default=1000, help="How many records to request from API")
    args = parser.parse_args()
    try:
        info = fetch_data(limit=args.limit)
        if info:
            print("Done:", info)
    except requests.HTTPError as e:
        print("❌ HTTP error from API:", e)
        raise
    except Exception as e:
        print("❌ fetch failed:", e)
        raise
