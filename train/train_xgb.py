# train/train_xgb.py
import pandas as pd
import joblib
from pathlib import Path
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

ROOT = Path.cwd()
PROC = ROOT / "data" / "processed" / "processed_hourly.csv"
MODELS_DIR = ROOT / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

print("Loading processed data:", PROC)
df = pd.read_csv(PROC, parse_dates=["datetime_utc"])
df = df.sort_values(["station_id","datetime_utc"])

# simple features
df["hour"] = df["datetime_utc"].dt.hour
df["dayofweek"] = df["datetime_utc"].dt.dayofweek

# create lags 1..24 per station
def make_lags(g):
    for lag in range(1,25):
        g[f"lag_{lag}"] = g["pm25"].shift(lag)
    g["rolling_24_mean"] = g["pm25"].rolling(24, min_periods=1).mean()
    return g

df = df.groupby("station_id").apply(make_lags).reset_index(drop=True)
df = df.dropna(subset=[f"lag_1"])
df["target"] = df.groupby("station_id")["pm25"].shift(-1)
df = df.dropna(subset=["target"])

feature_cols = [f"lag_{i}" for i in range(1,25)] + ["rolling_24_mean","hour","dayofweek","lat","lon"]
X = df[feature_cols].fillna(0)
y = df["target"]

print("X shape:", X.shape)
X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
model = XGBRegressor(n_estimators=200, max_depth=6, n_jobs=4)
model.fit(X_train, y_train, eval_set=[(X_val,y_val)], verbose=True)

out = MODELS_DIR / "model_global.pkl"
joblib.dump(model, out)
print("Saved model to", out)
