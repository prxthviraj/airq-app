# backend/app/main.py
from dotenv import load_dotenv   
load_dotenv()                    

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os
import logging
from typing import Optional
from .model_utils import load_model, build_features_for_station
from datetime import datetime
import importlib.util

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="AirQ Forecast API - Prototype")

# CORS for local dev (allow Vite dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROCESSED_CSV = os.getenv(
    "PROCESSED_CSV",
    os.path.join(os.getcwd(), "data", "processed", "india_realtime_api.csv"),
)

# ---- helper: load fetch function from scripts/fetch_cpcb_api.py (robust import) ----
def _load_fetch_function():
    """
    Try direct import first, else load by path. Returns a callable fetch_data(limit=..., api_key=None).
    """
    try:
        from scripts.fetch_cpcb_api import fetch_data as _fetch  # type: ignore
        logging.info("Imported fetch_data from scripts.fetch_cpcb_api via normal import.")
        return _fetch
    except Exception:
        module_path = os.path.join(os.getcwd(), "scripts", "fetch_cpcb_api.py")
        if not os.path.exists(module_path):
            raise FileNotFoundError(f"fetch script not found at {module_path}")
        spec = importlib.util.spec_from_file_location("fetch_cpcb_api", module_path)
        module = importlib.util.module_from_spec(spec)
        loader = spec.loader
        assert loader is not None
        loader.exec_module(module)  # type: ignore
        if not hasattr(module, "fetch_data"):
            raise AttributeError("fetch_cpcb_api.py does not define fetch_data(...)")
        logging.info("Imported fetch_data from scripts/fetch_cpcb_api.py via file-loader.")
        return getattr(module, "fetch_data")

_fetch_data = None
try:
    _fetch_data = _load_fetch_function()
except Exception as e:
    logging.warning("Could not load fetch function on startup: %s", e)
    _fetch_data = None


# ---- basic endpoints ----
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/stations")
def get_stations(limit: int = 200):
    if not os.path.exists(PROCESSED_CSV):
        raise HTTPException(
            status_code=500,
            detail=f"Processed CSV not found at {PROCESSED_CSV}. Run data scripts.",
        )
    df = pd.read_csv(PROCESSED_CSV, parse_dates=["datetime_utc"])
    stations = (
        df.groupby(
            ["station_id", "station_name", "city", "country", "lat", "lon"]
        )
        .size()
        .reset_index()
        .iloc[:, :6]
    )
    return stations.head(limit).to_dict(orient="records")

@app.get("/api/predict")
def predict(station_id: str, horizon: int = Query(24, ge=1, le=168)):
    if not os.path.exists(PROCESSED_CSV):
        raise HTTPException(
            status_code=500,
            detail=f"Processed CSV not found at {PROCESSED_CSV}. Run data scripts.",
        )

    try:
        model = load_model()
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))

    features = build_features_for_station(PROCESSED_CSV, station_id, max_lag=24)
    if features is None:
        raise HTTPException(
            status_code=404, detail="station_id not found in processed data"
        )

    preds = []
    cur = features.copy()

    for i in range(horizon):
        pred = float(model.predict(cur)[0])
        pred = max(pred, 0.0)
        pred = min(pred, 1000.0)
        preds.append(pred)

        for lag in range(24, 1, -1):
            cur[f"lag_{lag}"] = cur[f"lag_{lag-1}"]
        cur["lag_1"] = pred
        cur["rolling_24_mean"] = (cur["rolling_24_mean"] * 23 + pred) / 24.0

        try:
            current_hour = int(cur["hour"].iloc[0])
        except Exception:
            current_hour = int(datetime.utcnow().hour)
        cur.at[cur.index[0], "hour"] = int((current_hour + 1) % 24)

    df_all = pd.read_csv(PROCESSED_CSV, parse_dates=["datetime_utc"])
    last_ts = df_all[df_all["station_id"] == station_id]["datetime_utc"].max()
    if pd.isna(last_ts):
        last_ts = datetime.utcnow()
    else:
        last_ts = pd.to_datetime(last_ts)

    timestamps = [(last_ts + pd.Timedelta(hours=i + 1)).isoformat() for i in range(horizon)]
    output = [{"timestamp": ts, "pm25": float(p)} for ts, p in zip(timestamps, preds)]

    return {
        "station_id": station_id,
        "last_updated": last_ts.isoformat(),
        "predictions": output
    }



@app.get("/api/predict")
def predict(station_id: str, horizon: int = Query(24, ge=1, le=168)):
    if not os.path.exists(PROCESSED_CSV):
        raise HTTPException(
            status_code=500,
            detail=f"Processed CSV not found at {PROCESSED_CSV}. Run data scripts.",
        )

    try:
        model = load_model()
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))

    features = build_features_for_station(PROCESSED_CSV, station_id, max_lag=24)
    if features is None:
        raise HTTPException(
            status_code=404, detail="station_id not found in processed data"
        )

    preds = []
    cur = features.copy()

    for i in range(horizon):
        pred = float(model.predict(cur)[0])
        pred = max(pred, 0.0)
        pred = min(pred, 1000.0)
        preds.append(pred)

        for lag in range(24, 1, -1):
            cur[f"lag_{lag}"] = cur[f"lag_{lag-1}"]
        cur["lag_1"] = pred
        cur["rolling_24_mean"] = (cur["rolling_24_mean"] * 23 + pred) / 24.0

        try:
            current_hour = int(cur["hour"].iloc[0])
        except Exception:
            current_hour = int(datetime.utcnow().hour)
        cur.at[cur.index[0], "hour"] = int((current_hour + 1) % 24)

    df_all = pd.read_csv(PROCESSED_CSV, parse_dates=["datetime_utc"])
    last_ts = df_all[df_all["station_id"] == station_id]["datetime_utc"].max()
    if pd.isna(last_ts):
        last_ts = datetime.utcnow()
    else:
        last_ts = pd.to_datetime(last_ts)

    timestamps = [(last_ts + pd.Timedelta(hours=i + 1)).isoformat() for i in range(horizon)]
    output = [{"timestamp": ts, "pm25": float(p)} for ts, p in zip(timestamps, preds)]

    return {"station_id": station_id, "predictions": output}


@app.get("/api/predict_by_city")
def predict_by_city(city: str = Query(..., description="City name"), horizon: int = Query(24, ge=1, le=168)):
    if not os.path.exists(PROCESSED_CSV):
        raise HTTPException(
            status_code=500,
            detail=f"Processed CSV not found at {PROCESSED_CSV}. Run data scripts.",
        )

    df = pd.read_csv(PROCESSED_CSV, parse_dates=["datetime_utc"])
    matches = df[df["city"].str.lower() == city.lower()]

    if matches.empty:
        raise HTTPException(status_code=404, detail=f"City '{city}' not found in processed data")

    station_ids = matches["station_id"].unique()
    results = []
    for sid in station_ids:
        try:
            res = predict(sid, horizon)
            results.append(res)
        except Exception as e:
            results.append({"station_id": sid, "error": str(e)})

    last_updated = matches["datetime_utc"].max()
    if pd.isna(last_updated):
        last_updated = datetime.utcnow()

    return {
        "city": city,
        "last_updated": pd.to_datetime(last_updated).isoformat(),
        "stations": results
    }



@app.post("/api/refresh")
def refresh(
    background_tasks: BackgroundTasks,
    blocking: bool = Query(False, description="If true, run fetch synchronously and return the result."),
    limit: int = Query(1000, ge=1, le=5000, description="Number of rows to request from CPCB API."),
    api_key: Optional[str] = Query(None, description="Optional: override the CPCB_API_KEY for this run."),
    x_refresh_token: Optional[str] = Header(None, description="Optional: pass REFRESH_TOKEN header."),
):
    required_token = os.getenv("REFRESH_TOKEN")
    if required_token:
        if not x_refresh_token or x_refresh_token != required_token:
            raise HTTPException(status_code=403, detail="Invalid or missing refresh token")

    global _fetch_data
    if _fetch_data is None:
        try:
            _fetch_data = _load_fetch_function()
        except Exception as e:
            logging.exception("Unable to load fetch function on refresh: %s", e)
            raise HTTPException(status_code=500, detail=f"Could not load fetch logic: {e}")

    def _run_fetch(limit_arg, api_key_arg):
        try:
            logging.info("Starting CPCB fetch (limit=%s)...", limit_arg)
            res = _fetch_data(limit=limit_arg, api_key=api_key_arg)
            logging.info("CPCB fetch finished: %s", res)
        except Exception as e:
            logging.exception("CPCB fetch failed: %s", e)

    if blocking:
        try:
            res = _fetch_data(limit=limit, api_key=api_key)
            return {"status": "ok", "result": res}
        except Exception as e:
            logging.exception("Blocking fetch failed: %s", e)
            raise HTTPException(status_code=500, detail=f"Fetch failed: {e}")
    else:
        background_tasks.add_task(_run_fetch, limit, api_key)
        return {"status": "scheduled", "message": "Fetch scheduled in background. Check logs when done."}
