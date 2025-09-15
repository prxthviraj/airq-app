# scripts/clean_data.py
import pandas as pd
from pathlib import Path

RAW = Path.cwd() / "data" / "raw" / "openaq_pm25_sample.csv"
OUT_DIR = Path.cwd() / "data" / "processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT = OUT_DIR / "processed_hourly.csv"

print("Loading raw:", RAW)
df = pd.read_csv(RAW, parse_dates=["date_utc"])
df = df.rename(columns={"date_utc": "datetime_utc", "value": "pm25"})
df = df.dropna(subset=["lat","lon","datetime_utc"])
# floor to hour
df["datetime_utc"] = pd.to_datetime(df["datetime_utc"]).dt.tz_localize(None)
df["datetime_utc"] = df["datetime_utc"].dt.floor("H")
agg = df.groupby(["station_id","station_name","city","country","lat","lon","datetime_utc"]).pm25.mean().reset_index()
agg.to_csv(OUT, index=False)
print("Saved processed hourly:", OUT)
