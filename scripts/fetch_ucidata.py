#!/usr/bin/env python3
# scripts/fetch_ucidata.py
# Fetch UCI "Air Quality" dataset via ucimlrepo and convert it to processed_hourly.csv
from ucimlrepo import fetch_ucirepo
import pandas as pd
from pathlib import Path

ROOT = Path.cwd()
RAW = ROOT / 'data' / 'raw' / 'uci_airquality.csv'
PROCESSED = ROOT / 'data' / 'processed' / 'processed_hourly.csv'
PROCESSED.parent.mkdir(parents=True, exist_ok=True)

print("Fetching UCI Air Quality dataset (id=360) ...")
ds = fetch_ucirepo(id=360)

# ds.data.features usually holds the DataFrame
if hasattr(ds.data, "features") and ds.data.features is not None:
    df = ds.data.features.copy()
else:
    # fallback if structure is different
    try:
        df = pd.DataFrame(ds.data)
    except Exception as e:
        raise RuntimeError("Could not parse dataset from ucimlrepo: " + str(e))

print("Saving raw CSV to:", RAW)
df.to_csv(RAW, index=False)

# Build processed table expected by our backend:
# columns: station_id, station_name, city, country, lat, lon, datetime_utc, pm25
print("Converting to processed format (using available pollutant column as 'pm25') ...")
# Combine Date + Time if present
if 'Date' in df.columns and 'Time' in df.columns:
    # Date format in UCI is day/month/year
    df['datetime_utc'] = pd.to_datetime(df['Date'] + ' ' + df['Time'], dayfirst=True, errors='coerce')
else:
    # fallback: use the index as datetime
    df['datetime_utc'] = pd.to_datetime(df.index, errors='coerce')

# pick a pollutant column to act as our 'pm25' proxy (NO2, C6H6, or CO)
cand = None
for c in ['NO2(GT)', 'C6H6(GT)', 'CO(GT)']:
    if c in df.columns:
        cand = c
        break
if cand is None:
    raise RuntimeError("Expected pollutant column not found in UCI dataset. Columns: " + ", ".join(df.columns[:20]))

out = pd.DataFrame()
out['datetime_utc'] = pd.to_datetime(df['datetime_utc']).dt.floor('H')
out['pm25'] = pd.to_numeric(df[cand], errors='coerce')  # use chosen pollutant as proxy
out['station_id'] = 'UCI_1'
out['station_name'] = 'UCI_AQ'
out['city'] = 'Unknown'
out['country'] = 'Unknown'
out['lat'] = 0.0
out['lon'] = 0.0

# reorder to match our other processed files
out = out[['station_id','station_name','city','country','lat','lon','datetime_utc','pm25']]
out.to_csv(PROCESSED, index=False)
print("Saved processed file to:", PROCESSED)
