import os
import io
import json
# pyrefly: ignore [missing-import]
from typing import Dict, Any, List, Optional
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response
# pyrefly: ignore [missing-import]
from fastapi.staticfiles import StaticFiles
# pyrefly: ignore [missing-import]
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware

# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field

from backend.sample_data import generate_all_datasets
from backend.data_loader import GeoDataLoader
from backend.scoring_engine import SiteScoringEngine
from backend.spatial_analysis import SpatialAnalysisEngine
from backend.isochrone_engine import IsochroneEngine
from backend.ai_explainer import AISiteExplainer
from backend.exporter import ReportExporter

app = FastAPI(
    title="AI-Powered GeoSpatial Site Readiness Analyzer",
    description="Multi-layer geospatial data ingestion, H3 binning, Getis-Ord Gi* hotspot detection, isochrone catchment analysis, site scoring, and AI explanation engine.",
    version="2.0.0"
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global dataset store initialized on startup
DATASETS: Dict[str, Any] = {}
GDF_STORE: Dict[str, Any] = {}

def initialize_datasets():
    """Generates sample datasets and loads them into memory GeoDataFrames."""
    global DATASETS, GDF_STORE
    paths = generate_all_datasets()
    for layer_key, path in paths.items():
        gdf = GeoDataLoader.load_geojson(path)
        GDF_STORE[layer_key] = gdf
        with open(path, "r") as f:
            DATASETS[layer_key] = json.load(f)

@app.on_event("startup")
def startup_event():
    initialize_datasets()

# Pydantic Schemas
class ScorePointRequest(BaseModel):
    latitude: float
    longitude: float
    preset_key: str = "ev_charging"
    custom_weights: Optional[Dict[str, float]] = None
    hard_constraints: bool = True
    decay_type: Optional[str] = None

class H3GridRequest(BaseModel):
    resolution: int = 8
    preset_key: str = "ev_charging"
    include_gi_star: bool = True
    decay_type: Optional[str] = None
    hard_constraints: bool = True

class IsochroneRequest(BaseModel):
    latitude: float
    longitude: float
    mode: str = "drive" # drive or walk
    time_minutes: List[int] = [10, 20, 30]

class RouteToHubRequest(BaseModel):
    latitude: float
    longitude: float
    hub_type: str = "highway" # highway or anchor

class PolygonSearchRequest(BaseModel):
    coordinates: List[List[float]] # List of [lon, lat] points closing loop
    preset_key: str = "ev_charging"
    custom_weights: Optional[Dict[str, float]] = None
    decay_type: Optional[str] = None
    hard_constraints: bool = True

class CompareSitesRequest(BaseModel):
    sites: List[Dict[str, Any]] # List of {"latitude": lat, "longitude": lon, "name": name, ...}
    preset_key: str = "ev_charging"
    decay_type: Optional[str] = None
    hard_constraints: bool = True

class AIQueryRequest(BaseModel):
    query_text: str
    preset_key: str = "ev_charging"
    top_n: int = 5

# API Endpoints
@app.get("/api/preset-profiles")
def get_preset_profiles():
    """Returns available site readiness industry presets & default weights."""
    return SiteScoringEngine.PRESETS

@app.get("/api/layers")
def get_layers():
    """Returns metadata and feature collections of all loaded geospatial layers."""
    summary = {}
    for layer_key, data in DATASETS.items():
        summary[layer_key] = {
            "name": layer_key.replace("_", " ").title(),
            "feature_count": len(data.get("features", [])),
            "geojson": data
        }
    return summary

@app.post("/api/upload-layer")
async def upload_layer(
    layer_name: str = Form(...),
    file: UploadFile = File(...)
):
    """In-memory ingestion of user uploaded GeoJSON, Shapefile (.zip), CSV, WKT, or GeoTIFF."""
    content = await file.read()
    try:
        gdf = GeoDataLoader.parse_any(file.filename, content)
        clean_key = layer_name.lower().replace(" ", "_")
        GDF_STORE[clean_key] = gdf
        
        # Convert to GeoJSON dict for frontend rendering
        geojson_dict = json.loads(gdf.to_json())
        DATASETS[clean_key] = geojson_dict
        
        return {
            "status": "success",
            "message": f"Successfully ingested layer '{layer_name}' with {len(gdf)} features.",
            "layer_key": clean_key,
            "feature_count": len(gdf)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to ingest file: {str(e)}")

@app.get("/api/summary-stats")
def get_summary_stats(preset_key: str = "ev_charging"):
    """Returns top-level KPI metrics for the metro area and candidates."""
    candidate_gdf = GDF_STORE.get("candidate_sites")
    total_candidates = len(candidate_gdf) if candidate_gdf is not None else 0
    
    top_score = 0.0
    top_site_name = "N/A"
    total_score = 0.0
    scored_count = 0
    
    if candidate_gdf is not None and not candidate_gdf.empty:
        for idx, row in candidate_gdf.iterrows():
            eval_res = SiteScoringEngine.evaluate_site(row.geometry.y, row.geometry.x, GDF_STORE, preset_key=preset_key)
            sc = eval_res["site_readiness_score"]
            total_score += sc
            scored_count += 1
            if sc > top_score:
                top_score = sc
                top_site_name = row.get("name", f"Site {idx}")
                
    avg_score = round(total_score / scored_count, 1) if scored_count > 0 else 0.0
    
    return {
        "preset_key": preset_key,
        "total_candidate_parcels": total_candidates,
        "metro_avg_score": avg_score,
        "top_readiness_score": top_score,
        "top_candidate_name": top_site_name,
        "active_layers_count": len(DATASETS)
    }

@app.post("/api/score-point")
def score_point(req: ScorePointRequest):
    """Calculates Site Readiness Score, factor breakdown, and AI explanation for a coordinate."""
    res = SiteScoringEngine.evaluate_site(
        req.latitude, req.longitude, GDF_STORE,
        preset_key=req.preset_key,
        custom_weights=req.custom_weights,
        hard_constraints=req.hard_constraints,
        decay_type=req.decay_type
    )
    explanation = AISiteExplainer.explain_scoring_result(res)
    res["ai_explanation"] = explanation
    return res

@app.post("/api/h3-grid")
def get_h3_grid(req: H3GridRequest):
    """Generates H3 Hexagonal heatmap grid with optional Getis-Ord Gi* Hot-Spot stats."""
    hex_geojson = SpatialAnalysisEngine.generate_h3_hex_grid(
        GDF_STORE, resolution=req.resolution, preset_key=req.preset_key
    )
    if req.include_gi_star:
        hex_geojson = SpatialAnalysisEngine.calculate_getis_ord_gi_star(hex_geojson)
    return hex_geojson

@app.post("/api/isochrone")
def get_isochrone(req: IsochroneRequest):
    """Calculates 10m, 20m, 30m drive/walk catchment isochrones & demographics."""
    return IsochroneEngine.generate_isochrones(
        req.latitude, req.longitude, GDF_STORE,
        mode=req.mode, time_minutes=req.time_minutes
    )

@app.post("/api/route-to-hub")
def get_route_to_hub(req: RouteToHubRequest):
    """Calculates turn-by-turn road route and transit accessibility to nearest highway or anchor."""
    return IsochroneEngine.calculate_route_to_hub(
        req.latitude, req.longitude, GDF_STORE, hub_type=req.hub_type
    )

@app.post("/api/dbscan-clusters")
def get_dbscan_clusters(eps_km: float = 1.5, min_samples: int = 2):
    """Runs DBSCAN density clustering on candidate site points."""
    candidate_gdf = GDF_STORE.get("candidate_sites")
    return SpatialAnalysisEngine.run_dbscan_clustering(candidate_gdf, eps_km=eps_km, min_samples=min_samples)

@app.post("/api/polygon-search")
def polygon_search(req: PolygonSearchRequest):
    """Evaluates and ranks all candidate sites falling within a user-drawn bounding polygon."""
    from shapely.geometry import Polygon as ShapelyPoly
    
    # Coordinates in request are [lon, lat]
    try:
        search_poly = ShapelyPoly(req.coordinates)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid polygon coordinates format.")
        
    candidate_gdf = GDF_STORE.get("candidate_sites")
    if candidate_gdf is None or candidate_gdf.empty:
        return {"total_found": 0, "results": []}
        
    inside_gdf = candidate_gdf[candidate_gdf.geometry.within(search_poly)]
    
    results = []
    for idx, row in inside_gdf.iterrows():
        lat, lon = row.geometry.y, row.geometry.x
        eval_res = SiteScoringEngine.evaluate_site(
            lat, lon, GDF_STORE,
            preset_key=req.preset_key,
            custom_weights=req.custom_weights
        )
        eval_res["site_id"] = row.get("site_id", f"SITE-{idx}")
        eval_res["name"] = row.get("name", "Candidate Site")
        eval_res["address"] = row.get("address", "")
        eval_res["asking_price"] = float(row.get("asking_price", 0))
        eval_res["area_acres"] = float(row.get("area_acres", 0))
        
        explanation = AISiteExplainer.explain_scoring_result(eval_res)
        eval_res["ai_explanation"] = explanation
        results.append(eval_res)
        
    ranked_results = sorted(results, key=lambda x: x["site_readiness_score"], reverse=True)
    return {
        "total_found": len(ranked_results),
        "results": ranked_results
    }

@app.post("/api/compare-sites")
def compare_sites(req: CompareSitesRequest):
    """Side-by-side comparison matrix and AI comparative head-to-head analysis."""
    results = []
    for item in req.sites[:4]: # limit to 4
        lat = item["latitude"]
        lon = item["longitude"]
        name = item.get("name", f"Site ({lat:.3f}, {lon:.3f})")
        
        eval_res = SiteScoringEngine.evaluate_site(
            lat, lon, GDF_STORE,
            preset_key=req.preset_key,
            decay_type=req.decay_type,
            hard_constraints=req.hard_constraints
        )
        eval_res["name"] = name
        eval_res["asking_price"] = item.get("asking_price", 0)
        eval_res["area_acres"] = item.get("area_acres", 0)
        eval_res["address"] = item.get("address", "")
        explanation = AISiteExplainer.explain_scoring_result(eval_res)
        eval_res["ai_explanation"] = explanation
        results.append(eval_res)
        
    ai_comparison = AISiteExplainer.explain_site_comparison(results)
    return {
        "preset_key": req.preset_key,
        "compared_sites": results,
        "ai_comparison": ai_comparison
    }

@app.post("/api/ai-query")
def ai_query_recommendations(req: AIQueryRequest):
    """Natural language candidate site search & AI recommendation ranking."""
    candidate_gdf = GDF_STORE.get("candidate_sites")
    if candidate_gdf is None or candidate_gdf.empty:
        return {"query": req.query_text, "recommendations": []}
        
    evaluations = []
    for idx, row in candidate_gdf.iterrows():
        lat, lon = row.geometry.y, row.geometry.x
        eval_res = SiteScoringEngine.evaluate_site(lat, lon, GDF_STORE, preset_key=req.preset_key)
        eval_res["site_id"] = row.get("site_id", f"SITE-{idx}")
        eval_res["name"] = row.get("name", "Candidate Site")
        eval_res["address"] = row.get("address", "")
        eval_res["ai_explanation"] = AISiteExplainer.explain_scoring_result(eval_res)
        evaluations.append(eval_res)
        
    return AISiteExplainer.query_recommendations(req.query_text, evaluations, top_n=req.top_n)

@app.post("/api/export-pdf")
def export_pdf(req: ScorePointRequest):
    """Generates and streams a PDF site readiness evaluation report."""
    eval_res = SiteScoringEngine.evaluate_site(
        req.latitude, req.longitude, GDF_STORE,
        preset_key=req.preset_key,
        custom_weights=req.custom_weights
    )
    explanation = AISiteExplainer.explain_scoring_result(eval_res)
    pdf_bytes = ReportExporter.generate_site_pdf_bytes(eval_res, explanation)
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Site_Readiness_Report_{req.preset_key}.pdf"}
    )

@app.api_route("/api/export-data", methods=["GET", "POST"])
def export_data(format_type: str = "geojson", preset_key: str = "ev_charging"):
    """Exports evaluations of candidate sites as GeoJSON or CSV download."""
    candidate_gdf = GDF_STORE.get("candidate_sites")
    evaluations = []
    for idx, row in candidate_gdf.iterrows():
        lat, lon = row.geometry.y, row.geometry.x
        eval_res = SiteScoringEngine.evaluate_site(lat, lon, GDF_STORE, preset_key=preset_key)
        eval_res["site_id"] = row.get("site_id", f"SITE-{idx}")
        eval_res["name"] = row.get("name", "Candidate Site")
        eval_res["address"] = row.get("address", "")
        explanation = AISiteExplainer.explain_scoring_result(eval_res)
        eval_res["verdict"] = explanation["verdict"]
        evaluations.append(eval_res)
        
    if format_type.lower() == "csv":
        csv_str = ReportExporter.export_candidate_evaluations_csv(evaluations)
        return Response(
            content=csv_str,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=site_readiness_candidates.csv"}
        )
    else:
        geojson_str = ReportExporter.export_candidate_evaluations_geojson(evaluations)
        return Response(
            content=geojson_str,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=site_readiness_candidates.geojson"}
        )

# Serve Frontend static assets
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/", response_class=HTMLResponse)
def root():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>AI-Powered GeoSpatial Site Readiness Analyzer API Server</h1><p>Frontend template initializing...</p>")

if __name__ == "__main__":
    # pyrefly: ignore [missing-import]
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
