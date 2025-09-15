# backend/app/model_utils.py
import os
import joblib
import pandas as pd
from datetime import datetime
from pathlib import Path

def default_model_dir():
    # project-root/models
    root = Path.cwd()
    return str(root / "models")

MODEL_DIR = os.getenv("MODEL_DIR", default_model_dir())

def load_model():
    model_path = os.path.join(MODEL_DIR, "model_global.pkl")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found at {model_path}. Train a model first (see train/).")
    return joblib.load(model_path)

def build_features_for_station(processed_csv_path, station_id, max_lag=24):
    """
    Simple feature builder:
    - reads processed hourly CSV (must contain station_id, datetime_utc, pm25, lat, lon)
    - builds lag_1..lag_{max_lag}, rolling_24_mean, hour, dayofweek, lat, lon
    Returns: pandas.DataFrame with one row of features (or None if station not found).
    """
    df = pd.read_csv(processed_csv_path, parse_dates=["datetime_utc"])
    df = df[df["station_id"] == station_id].sort_values("datetime_utc")
    if df.empty:
        return None

    # ensure datetime index and hourly continuity
    df = df.set_index("datetime_utc").resample("h").mean(numeric_only=True).ffill().reset_index()


    # create lags
    for lag in range(1, max_lag + 1):
        df[f"lag_{lag}"] = df["pm25"].shift(lag)

    # rolling mean
    df["rolling_24_mean"] = df["pm25"].rolling(24, min_periods=1).mean()

    # take last valid row
    last = df.iloc[-1]

    features = {}
    for lag in range(1, max_lag + 1):
        val = last.get(f"lag_{lag}", 0.0)
        features[f"lag_{lag}"] = float(val) if not pd.isna(val) else 0.0

    features["rolling_24_mean"] = float(last["rolling_24_mean"]) if not pd.isna(last["rolling_24_mean"]) else 0.0

    # hour & dayofweek
    try:
        ts = pd.to_datetime(last["datetime_utc"])
        features["hour"] = int(ts.hour)
        features["dayofweek"] = int(ts.dayofweek)
    except Exception:
        features["hour"] = 0
        features["dayofweek"] = 0

    # lat/lon
    features["lat"] = float(last.get("lat", 0.0)) if not pd.isna(last.get("lat", 0.0)) else 0.0
    features["lon"] = float(last.get("lon", 0.0)) if not pd.isna(last.get("lon", 0.0)) else 0.0

    return pd.DataFrame([features])
