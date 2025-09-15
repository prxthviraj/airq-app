# AirQ App

A full-stack Air Quality Prediction app.
- **Backend:** FastAPI + Python ML models
- **Frontend:** React + Tailwind + Leaflet
- **Data:** OpenAQ + reanalysis datasets
- **Goal:** Provide city-level air quality forecasts in a clean web interface


# AirQ-App 🌍💨
Real-time air quality dashboard with AI-powered 24-hour PM2.5 predictions for major Indian cities.  
Built with **FastAPI (backend)** + **React/Vite/Tailwind (frontend)**.

## Features
- 📊 24-hour predictions with interactive charts
- 🗺️ Map with CPCB monitoring stations
- 🟢 AQI categories + health recommendations
- ⚡ Real-time CPCB data fetch
- 🏙️ City-wise & station-wise analysis

## Tech Stack
- **Backend**: FastAPI, Uvicorn, Scikit-learn/XGBoost
- **Frontend**: React, Vite, TailwindCSS, Recharts, Leaflet
- **Data**: CPCB Open API

## Running locally
```bash
# Backend
cd backend
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
