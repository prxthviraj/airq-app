# scripts/augment_stations.py
import pandas as pd
from pathlib import Path

RAW = Path("data/processed/processed_hourly.csv")
OUT = Path("data/processed/processed_hourly_augmented.csv")

# Load the processed dataset
df = pd.read_csv(RAW, parse_dates=["datetime_utc"])

# Mapping of station_id → metadata (name, city, country, lat, lon)
station_info = {
    "UCI_1": {
        "station_name": "UCI_AQ",
        "city": "Delhi",
        "country": "India",
        "lat": 28.6139,
        "lon": 77.2090,
    },
    "UCI_2": {
        "station_name": "UCI_AQ",
        "city": "Mumbai",
        "country": "India",
        "lat": 19.0760,
        "lon": 72.8777,
    },
    "UCI_3": {
        "station_name": "UCI_AQ",
        "city": "Bengaluru",
        "country": "India",
        "lat": 12.9716,
        "lon": 77.5946,
    },
}

# Apply metadata
# Assign rows cyclically to 3 stations (just to simulate multi-station data)
stations = ["UCI_1", "UCI_2", "UCI_3"]
df["station_id"] = [stations[i % 3] for i in range(len(df))]


# Enrich columns
for sid, meta in station_info.items():
    df.loc[df["station_id"] == sid, "station_name"] = meta["station_name"]
    df.loc[df["station_id"] == sid, "city"] = meta["city"]
    df.loc[df["station_id"] == sid, "country"] = meta["country"]
    df.loc[df["station_id"] == sid, "lat"] = meta["lat"]
    df.loc[df["station_id"] == sid, "lon"] = meta["lon"]

# Save augmented CSV
df.to_csv(OUT, index=False)
print(f"✅ Augmented data written to {OUT}")
