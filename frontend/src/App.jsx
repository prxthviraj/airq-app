import { useState, useEffect } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});


// ✅ Format timestamp
const formatTimestamp = (ts) => {
  const d = new Date(ts);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

  


// ✅ AQI colors for text
const getColorForPM25 = (value) => {
  if (value <= 50) return "text-emerald-600";
  if (value <= 100) return "text-amber-600";
  if (value <= 150) return "text-orange-600";
  if (value <= 200) return "text-red-600";
  if (value <= 300) return "text-purple-600";
  return "text-pink-800";
};

// ✅ Marker icon colors
const getMarkerIcon = (pm25) => {
  let color = "green";
  if (pm25 > 100) color = "red";
  else if (pm25 > 50) color = "orange";

  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
};

// ✅ AQI summary + advice
const getAQISummary = (avgPM25) => {
  if (avgPM25 <= 50)
    return { level: "Good", advice: "Air quality is safe for everyone.", color: "from-emerald-100 to-emerald-200 text-emerald-800 border-emerald-300" };
  if (avgPM25 <= 100)
    return { level: "Moderate", advice: "Acceptable air quality with mild risk for sensitive groups.", color: "from-amber-100 to-amber-200 text-amber-800 border-amber-300" };
  if (avgPM25 <= 150)
    return { level: "Unhealthy for Sensitive Groups", advice: "Children, elderly, and people with respiratory conditions should limit outdoor activities.", color: "from-orange-100 to-orange-200 text-orange-800 border-orange-300" };
  if (avgPM25 <= 200)
    return { level: "Unhealthy", advice: "Everyone may experience health effects; sensitive groups may experience more serious health effects.", color: "from-red-100 to-red-200 text-red-800 border-red-300" };
  if (avgPM25 <= 300)
    return { level: "Very Unhealthy", advice: "Health alert: The risk of health effects is increased for everyone.", color: "from-purple-100 to-purple-200 text-purple-800 border-purple-300" };
  return { level: "Hazardous", advice: "Health warning of emergency conditions: everyone is more likely to be affected.", color: "from-pink-100 to-pink-200 text-pink-800 border-pink-300" };
};

function App() {
  const [lastUpdated, setLastUpdated] = useState(null);
  const [stations, setStations] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [cityPredictions, setCityPredictions] = useState(null);
  const [mapCenter, setMapCenter] = useState([22.9734, 78.6569]); // India center
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // ✅ Safe fallback used where UI shows "Last updated"
  const cityLastUpdated =
    cityPredictions?.last_updated ||
    cityPredictions?.stations?.[0]?.predictions?.[0]?.timestamp ||
    predictions?.[0]?.timestamp ||
    null;



  const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  // ✅ Load stations
  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API_BASE}/api/stations?limit=200`)
      .then((res) => {
        setStations(res.data);
        const cities = [...new Set(res.data.map((s) => s.city))].sort();
        setCityList(cities);
        setLoading(false);
      })
      .catch(() => {
        setError("⚠️ Failed to load stations. Check backend connection.");
        setLoading(false);
      });
  }, []);

  // ✅ Predict for one station
  const handlePredict = (stationId) => {
    setSelectedStation(stationId);
    setPredictions([]);
    setCityPredictions(null);
    setLoading(true);

    const station = stations.find((s) => s.station_id === stationId);
    if (station) setMapCenter([station.lat, station.lon]);

    axios
      .get(`${API_BASE}/api/predict?station_id=${stationId}&horizon=24`)
      .then((res) => {
        setPredictions(res.data.predictions);
        setLastUpdated(new Date().toISOString()); 
        setLoading(false);
      })
      .catch(() => {
        setError("⚠️ Failed to fetch predictions.");
        setLoading(false);
      });
  };



  // ✅ Predict for a city
  const handleCityPredict = (city) => {
    setSelectedStation(null);
    setPredictions([]);
    setCityPredictions(null);
    setLoading(true);

    axios
      .get(`${API_BASE}/api/predict_by_city?city=${city}&horizon=24`)
      .then((res) => {
        setCityPredictions(res.data);
        setLastUpdated(new Date().toISOString());
        const firstStation = stations.find((s) => s.city === city);
        if (firstStation) setMapCenter([firstStation.lat, firstStation.lon]);
        setLoading(false);
      })
      .catch(() => {
        setError("⚠️ Failed to fetch city predictions.");
        setLoading(false);
      });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-emerald-400/20 to-cyan-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-7xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-800 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Air Quality Dashboard
          </h1>
          <div className="inline-block ml-3 relative group">
  <button
    type="button"
    aria-label="PM2.5 info"
    className="w-8 h-8 rounded-full bg-white/90 text-gray-700 flex items-center justify-center shadow-sm"
  >
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M12 20a9 9 0 100-18 9 9 0 000 18z" />
    </svg>
  </button>
  <div className="absolute hidden group-hover:block w-72 p-3 bg-white rounded-md shadow-lg text-sm text-gray-700 -left-16 top-10 z-50">
    PM2.5 = fine particulate matter (particles &lt;2.5µm). High PM2.5 increases respiratory and cardiovascular risk.
    Use this dashboard to plan outdoor activities; sensitive groups should limit exposure when levels are high.
  </div>
</div>

          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Real-time air quality monitoring and <span className="font-semibold text-blue-600">24-hour PM2.5 predictions</span> for major cities across India
          </p>
          

        </div>

        {/* AQI Legend Card */}
        <div className="mb-8">
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              AQI Categories & Health Guidelines
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { range: "0–50", level: "Good", color: "emerald", icon: "😊" },
                { range: "51–100", level: "Moderate", color: "amber", icon: "😐" },
                { range: "101–150", level: "Unhealthy (Sensitive)", color: "orange", icon: "😷" },
                { range: "151–200", level: "Unhealthy", color: "red", icon: "😨" },
                { range: "201–300", level: "Very Unhealthy", color: "purple", icon: "🚨" },
                { range: "301+", level: "Hazardous", color: "pink", icon: "☠️" }
              ].map((item, index) => (
                <div key={index} className={`bg-gradient-to-br from-${item.color}-50 to-${item.color}-100 border border-${item.color}-200 rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:scale-105`}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{item.icon}</span>
                    <span className={`text-${item.color}-700 font-bold text-lg`}>{item.range}</span>
                  </div>
                  <p className={`text-${item.color}-800 font-medium text-sm`}>{item.level}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-4 shadow-lg animate-bounce">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-red-800 font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* City Selector */}
        <div className="mb-8 text-center">
          <div className="inline-block relative">
            <select
              className="appearance-none bg-white/90 backdrop-blur-lg border-2 border-blue-200 rounded-xl px-8 py-4 pr-12 text-lg font-medium text-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-300/50 focus:border-blue-400"
              onChange={(e) => handleCityPredict(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>🏙️ Select a City for Predictions</option>
              {cityList.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-8 shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-lg font-medium text-gray-700">Loading predictions...</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Map Section */}
          <div className="xl:col-span-2">
            <div className="bg-white/90 backdrop-blur-lg shadow-2xl rounded-2xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Interactive Map View
                </h2>
                <p className="text-blue-100 mt-2">Click on any marker to view detailed predictions</p>
              </div>
              <div className="p-0">
                <MapContainer center={mapCenter} zoom={5} style={{ height: "500px", width: "100%" }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {stations.map((s) => (
                    <Marker
                      key={s.station_id}
                      position={[s.lat, s.lon]}
                      icon={getMarkerIcon(
                        predictions.length > 0 && selectedStation === s.station_id
                          ? predictions[0].pm25
                          : 0
                      )}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-bold text-lg text-gray-800 mb-1">{s.station_name}</h3>
                          <p className="text-gray-600 mb-3">{s.city}, {s.country}</p>
                          {predictions.length > 0 && selectedStation === s.station_id && (
                            <p className="mb-3">
                              Latest PM2.5: <span className="font-bold text-blue-600">{predictions[0].pm25.toFixed(2)} µg/m³</span>
                            </p>
                          )}
                          <button
                            className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg"
                            onClick={() => handlePredict(s.station_id)}
                          >
                            Get Predictions
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>
          </div>

          {/* Station List */}
          <div className="xl:col-span-1">
            <div className="bg-white/90 backdrop-blur-lg shadow-2xl rounded-2xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Monitoring Stations
                </h2>
                <p className="text-emerald-100 mt-2">{stations.length} stations available</p>
              </div>
              <div className="p-6 max-h-96 overflow-y-auto">
                <div className="space-y-3">
                  {stations.map((s, index) => (
                    <div
                      key={s.station_id}
                      className={`group p-4 rounded-xl border-2 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${
                        selectedStation === s.station_id 
                          ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-300' 
                          : 'bg-gray-50/80 border-gray-200 hover:border-blue-300'
                      }`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                            {s.station_name}
                          </h3>
                          <p className="text-sm text-gray-600">{s.city}</p>
                        </div>
                      </div>
                      <button
                        className="w-full px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 transform hover:scale-105 shadow-md"
                        onClick={() => handlePredict(s.station_id)}
                      >
                        Predict Air Quality
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Predictions Section */}
          <div className="xl:col-span-3">
            <div className="bg-white/90 backdrop-blur-lg shadow-2xl rounded-2xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  24-Hour Predictions & Analysis
                </h2>
                <p className="text-purple-100 mt-2">Detailed forecasts with health recommendations</p>
              </div>
              
              <div className="p-6">
                {/* Station predictions */}
                {selectedStation && predictions.length > 0 && (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">
                        📍 {stations.find((s) => s.station_id === selectedStation)?.station_name}
                      </h3>
                      <p className="text-gray-600 mb-4">24-hour PM2.5 forecast with hourly breakdown</p>
                    </div>

                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg">
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={predictions}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="timestamp"
                            tick={{ fontSize: 12, fill: "#6b7280" }}
                            tickFormatter={(ts) =>
                              new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            }
                          />
                          <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} />
                          <Tooltip 
                            labelFormatter={(ts) => formatTimestamp(ts)}
                            contentStyle={{
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '12px',
                              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="pm25" 
                            stroke="url(#gradient)" 
                            strokeWidth={3} 
                            dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }} 
                            activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2, fill: '#white' }}
                          />
                          <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#6366f1" />
                              <stop offset="100%" stopColor="#8b5cf6" />
                            </linearGradient>
                          </defs>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {predictions.slice(0, 8).map((p, i) => (
                        <div
                          key={i}
                          className={`p-4 rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${getColorForPM25(p.pm25).includes('emerald') ? 'bg-emerald-50 border-emerald-200' :
                            getColorForPM25(p.pm25).includes('amber') ? 'bg-amber-50 border-amber-200' :
                            getColorForPM25(p.pm25).includes('orange') ? 'bg-orange-50 border-orange-200' :
                            getColorForPM25(p.pm25).includes('red') ? 'bg-red-50 border-red-200' :
                            getColorForPM25(p.pm25).includes('purple') ? 'bg-purple-50 border-purple-200' :
                            'bg-pink-50 border-pink-200'
                          }`}
                        >
                          <div className="text-sm font-medium text-gray-600 mb-1">
                            {formatTimestamp(p.timestamp)}
                          </div>
                          <div className={`text-xl font-bold ${getColorForPM25(p.pm25)}`}>
                            {p.pm25.toFixed(1)} <span className="text-sm font-normal text-gray-500">µg/m³</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Station Summary */}
                    {(() => {
                      const avg = predictions.reduce((a, b) => a + b.pm25, 0) / predictions.length;
                      const summary = getAQISummary(avg);
                      return (
                        <div className={`bg-gradient-to-r ${summary.color} border-2 rounded-2xl p-6 shadow-lg`}>
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h4 className="text-xl font-bold mb-2">
                                Air Quality Summary: {summary.level}
                              </h4>
                              <p className="text-lg mb-2">
                                Average PM2.5: <span className="font-bold">{avg.toFixed(2)} µg/m³</span>
                              </p>
                              <p className="leading-relaxed">{summary.advice}</p>
                              <p className="mt-2 text-sm text-gray-600">
                                ⏱️ Last updated: {new Date(cityPredictions?.last_updated || predictions[0].timestamp).toLocaleString("en-GB")
                                }
                              </p>

                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    
                    
                    {(() => {
                                const max = predictions.reduce((a, b) => (a.pm25 > b.pm25 ? a : b));
                                const min = predictions.reduce((a, b) => (a.pm25 < b.pm25 ? a : b));
                                return (
                                  <div className="mt-6 text-center text-gray-700">
                                    <p className="mb-2">
                                      📊 These predictions represent the <b>expected PM2.5 levels for the next 24 hours</b>, 
                                      updated hourly using CPCB data and AI forecasting.
                                    </p>
                                    <p className="mb-2">
                                      🔴 Worst air expected around <b>{formatTimestamp(max.timestamp)}</b> with {max.pm25.toFixed(1)} µg/m³.
                                    </p>
                                    <p>
                                      🟢 Best air expected around <b>{formatTimestamp(min.timestamp)}</b> with {min.pm25.toFixed(1)} µg/m³.
                                    </p>
                                  </div>
                                );
                              })()}

                  </div>
                )}
                

                {/* City predictions */}
                {cityPredictions && (
                  <div className="space-y-8">
                    <div className="text-center">
                      <h3 className="text-3xl font-bold text-gray-800 mb-4">
                        🏙️ City-wide Analysis: {cityPredictions.city}
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">
  ⏱️ Last updated: {new Date(cityLastUpdated || new Date().toISOString()).toLocaleString("en-GB")}
</p>


                      {(() => {
                        const allValues = cityPredictions.stations.flatMap((s) => s.predictions || []).map((p) => p.pm25);
                        const avg = allValues.reduce((a, b) => a + b, 0) / allValues.length;
                        const summary = getAQISummary(avg);
                        return (
                          <div className={`inline-block bg-gradient-to-r ${summary.color} border-2 rounded-2xl p-6 shadow-lg`}>
                            <h4 className="text-2xl font-bold mb-2">
                              Overall City AQI: {summary.level}
                            </h4>
                            <p className="text-lg mb-2">
                              City Average PM2.5: <span className="font-bold">{avg.toFixed(2)} µg/m³</span>
                            </p>
                            <p className="leading-relaxed">{summary.advice}</p>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Extra Explanation for City Predictions */}
{(() => {
  const allValues = cityPredictions.stations
    .flatMap((s) => s.predictions || [])
    .map((p) => p.pm25);

  if (allValues.length === 0) return null;

  const max = cityPredictions.stations
    .flatMap((s) => s.predictions || [])
    .reduce((a, b) => (a.pm25 > b.pm25 ? a : b));

  const min = cityPredictions.stations
    .flatMap((s) => s.predictions || [])
    .reduce((a, b) => (a.pm25 < b.pm25 ? a : b));

  return (
    <div className="mt-6 text-center text-gray-700">
      <p className="mb-2">
        📊 These forecasts show the <b>city-wide PM2.5 levels for the next 24 hours</b>, 
        aggregated across all monitoring stations.
      </p>
      <p className="mb-2">
        🔴 Highest pollution expected around{" "}
        <b>{formatTimestamp(max.timestamp)}</b> with {max.pm25.toFixed(1)} µg/m³.
      </p>
      <p>
        🟢 Best air expected around{" "}
        <b>{formatTimestamp(min.timestamp)}</b> with {min.pm25.toFixed(1)} µg/m³.
      </p>
    </div>
  );
})()}


                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {cityPredictions.stations.map((s, index) => (
                        <div key={s.station_id} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                          <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 text-white">
                            <h4 className="text-lg font-bold flex items-center gap-2">
                              <span className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">
                                {index + 1}
                              </span>
                              {s.station_id}
                            </h4>
                          </div>
                          
                          {s.predictions ? (
                            <div className="p-6">
                              <div className="mb-6">
                                <ResponsiveContainer width="100%" height={250}>
                                  <LineChart data={s.predictions}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis
                                      dataKey="timestamp"
                                      tick={{ fontSize: 10, fill: "#6b7280" }}
                                      tickFormatter={(ts) =>
                                        new Date(ts).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      }
                                    />
                                    <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                                    <Tooltip 
                                      labelFormatter={(ts) => formatTimestamp(ts)}
                                      contentStyle={{
                                        backgroundColor: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '12px'
                                      }}
                                    />
                                    <Line 
                                      type="monotone" 
                                      dataKey="pm25" 
                                      stroke="#10b981" 
                                      strokeWidth={2} 
                                      dot={{ fill: '#10b981', strokeWidth: 1, r: 3 }}
                                      activeDot={{ r: 4, stroke: '#10b981', strokeWidth: 2, fill: 'white' }}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>

                              <div className="grid grid-cols-2 gap-3 mb-4">
                                {s.predictions.slice(0, 4).map((p, i) => (
                                  <div
                                    key={i}
                                    className={`p-3 rounded-lg border ${
                                      getColorForPM25(p.pm25).includes('emerald') ? 'bg-emerald-50 border-emerald-200' :
                                      getColorForPM25(p.pm25).includes('amber') ? 'bg-amber-50 border-amber-200' :
                                      getColorForPM25(p.pm25).includes('orange') ? 'bg-orange-50 border-orange-200' :
                                      getColorForPM25(p.pm25).includes('red') ? 'bg-red-50 border-red-200' :
                                      getColorForPM25(p.pm25).includes('purple') ? 'bg-purple-50 border-purple-200' :
                                      'bg-pink-50 border-pink-200'
                                    }`}
                                  >
                                    <div className="text-xs font-medium text-gray-600 mb-1">
                                      {formatTimestamp(p.timestamp)}
                                    </div>
                                    <div className={`text-lg font-bold ${getColorForPM25(p.pm25)}`}>
                                      {p.pm25.toFixed(1)} <span className="text-xs text-gray-500">µg/m³</span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {(() => {
                                const avg = s.predictions.reduce((a, b) => a + b.pm25, 0) / s.predictions.length;
                                const summary = getAQISummary(avg);
                                return (
                                  <div className={`bg-gradient-to-r ${summary.color} border rounded-xl p-4`}>
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      </div>
                                      <div className="flex-1">
                                        <div className="font-bold text-sm">
                                          Station Status: {summary.level}
                                        </div>
                                        <div className="text-sm opacity-90">
                                          Avg: {avg.toFixed(2)} µg/m³ • {summary.advice}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="p-6 text-center">
                              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <p className="text-red-600 font-medium">{s.error}</p>
                              <p className="text-gray-500 text-sm mt-2">Unable to fetch predictions for this station</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!selectedStation && !cityPredictions && (
                  <div className="text-center py-16">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Ready for Air Quality Analysis</h3>
                    <p className="text-gray-600 text-lg max-w-md mx-auto leading-relaxed">
                      Select a city from the dropdown above or click on any station marker on the map to view detailed 24-hour air quality predictions
                    </p>
                    <div className="flex justify-center gap-4 mt-8">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span>Real-time Data</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        <span>AI Predictions</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                        <span>Health Advice</span>
                      </div>
                    </div>
                  </div>
                  
                )}

                

    

              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
<footer className="mt-16 text-center">
  <div className="bg-white/60 backdrop-blur-lg rounded-2xl border border-white/20 p-8 shadow-lg">
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-center gap-4 mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-800">Air Quality Intelligence</h3>
      </div>
      <p className="text-gray-600 text-lg leading-relaxed mb-6">
        Empowering communities with real-time air quality data and predictive insights for better health decisions
      </p>
      <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Live Data Monitoring</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span>24-Hour Predictions</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
          <span>Health Recommendations</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
          <span>Multi-City Coverage</span>
        </div>
      </div>

      {/* Last updated note */}
      <div className="mt-6 text-gray-500 text-sm">
        Powered by CPCB Open Data + AI Forecasts
        <br />
        ⏱️ Last updated: {lastUpdated ? formatTimestamp(lastUpdated) : "N/A"}
      </div>
    </div>
  </div>
</footer>

      </div>
    </div>
  );
}

export default App;