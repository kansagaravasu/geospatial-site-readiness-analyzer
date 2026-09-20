import math

# pyrefly: ignore [missing-import]
import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, Polygon
from sklearn.cluster import DBSCAN
# pyrefly: ignore [missing-import]
import h3

from backend.scoring_engine import haversine_distance_km

class SpatialAnalysisEngine:
    """Spatial Clustering (DBSCAN), Getis-Ord Gi* Hot-Spot Detection, and H3 Hexagonal Binning."""

    @staticmethod
    def generate_h3_hex_grid(dataset_dict, resolution=8, preset_key="ev_charging"):
        """
        Aggregates spatial scores into an H3 hexagonal grid over the metropolitan bounding box.
        Resolution 8: Hexagon edge ~0.46 km (~0.7 km2 area).
        """
        from backend.scoring_engine import SiteScoringEngine

        # Bengaluru Metro bounding box (India)
        min_lat, max_lat = 12.82, 13.12
        min_lon, max_lon = 77.48, 77.78

        # Step 1: Sample points to get H3 hex set
        lats = np.arange(min_lat, max_lat, 0.010)
        lons = np.arange(min_lon, max_lon, 0.010)

        hex_set = set()
        for lat in lats:
            for lon in lons:
                h_index = h3.latlng_to_cell(lat, lon, resolution)
                hex_set.add(h_index)

        hex_features = []
        for h_index in hex_set:
            boundary = h3.cell_to_boundary(h_index) # list of (lat, lon) tuples
            # Convert to (lon, lat) for GeoJSON
            geo_boundary = [[pt[1], pt[0]] for pt in boundary]
            geo_boundary.append(geo_boundary[0]) # close loop

            center_lat, center_lon = h3.cell_to_latlng(h_index)

            # Evaluate site readiness score for hex centroid
            score_res = SiteScoringEngine.evaluate_site(
                center_lat, center_lon, dataset_dict, preset_key=preset_key
            )

            score = score_res["site_readiness_score"]
            sub = score_res["sub_scores"]

            hex_features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [geo_boundary]
                },
                "properties": {
                    "h3_index": h_index,
                    "center_lat": center_lat,
                    "center_lon": center_lon,
                    "score": score,
                    "demographics_score": sub["demographics"],
                    "transportation_score": sub["transportation"],
                    "anchor_score": sub["anchor_attraction"],
                    "competitor_score": sub["competitor_penalty"],
                    "zoning_score": sub["zoning_suitability"],
                    "is_ineligible": score_res["is_ineligible"],
                    "exclusion_reason": score_res.get("exclusion_reason")
                }
            })

        return {"type": "FeatureCollection", "features": hex_features}

    @staticmethod
    def calculate_getis_ord_gi_star(hex_geojson, distance_threshold_km=2.0):
        """
        Calculates Getis-Ord Gi* spatial autocorrelation Z-scores and p-values for H3 hex grid.
        Identifies statistically significant Hot-Spots (Z >= 1.96) and Cold-Spots (Z <= -1.96).
        """
        features = hex_geojson["features"]
        n = len(features)
        if n == 0:
            return hex_geojson

        coords = np.array([[f["properties"]["center_lat"], f["properties"]["center_lon"]] for f in features])
        scores = np.array([f["properties"]["score"] for f in features], dtype=float)

        x_bar = np.mean(scores)
        s = np.std(scores)
        if s == 0:
            s = 1e-6 # prevent div by 0

        # Construct spatial weight matrix W (distance-based binary fixed distance band)
        # Compute pairwise distance matrix in km
        w_matrix = np.zeros((n, n), dtype=float)
        for i in range(n):
            lat1, lon1 = coords[i]
            for j in range(n):
                lat2, lon2 = coords[j]
                d = haversine_distance_km(lat1, lon1, lat2, lon2)
                if d <= distance_threshold_km:
                    w_matrix[i, j] = 1.0 # includes self i=j (Gi* definition)

        # Compute Gi* for each location i
        gi_star_scores = np.zeros(n)
        p_values = np.zeros(n)
        spot_class = []

        for i in range(n):
            w_i = w_matrix[i, :]
            sum_w = np.sum(w_i)
            sum_w_sq = np.sum(w_i ** 2)

            numerator = np.sum(w_i * scores) - (x_bar * sum_w)
            denom_term = math.sqrt((n * sum_w_sq - (sum_w ** 2)) / (n - 1)) if n > 1 else 1.0
            denominator = s * denom_term

            z_score = numerator / denominator if denominator != 0 else 0.0
            gi_star_scores[i] = round(z_score, 2)

            # Two-tailed p-value approximation via standard normal CDF
            p_val = 2.0 * (1.0 - 0.5 * (1.0 + math.erf(abs(z_score) / math.sqrt(2.0))))
            p_values[i] = round(p_val, 4)

            if z_score >= 2.58:
                spot_class.append("Hot-Spot (99% Confidence)")
            elif z_score >= 1.96:
                spot_class.append("Hot-Spot (95% Confidence)")
            elif z_score >= 1.65:
                spot_class.append("Hot-Spot (90% Confidence)")
            elif z_score <= -2.58:
                spot_class.append("Cold-Spot (99% Confidence)")
            elif z_score <= -1.96:
                spot_class.append("Cold-Spot (95% Confidence)")
            else:
                spot_class.append("Not Significant")

            # Underserved Opportunity Area: High population demand & purchasing power, but low competitor penetration
            props = features[i]["properties"]
            demo_val = props.get("demographics_score", 0)
            comp_val = props.get("competitor_score", 0)
            ineligible = props.get("is_ineligible", False)

            is_underserved = bool(demo_val >= 55.0 and comp_val >= 75.0 and not ineligible)
            is_high_potential = bool(props.get("score", 0) >= 70.0 and not ineligible)
            is_hot = bool(z_score >= 1.65)
            is_cold = bool(z_score <= -1.65)

            if is_underserved:
                spot_class[i] = f"{spot_class[i]} | Underserved Opportunity" if spot_class[i] != "Not Significant" else "Underserved High-Demand Zone"

            # Enrich feature properties
            features[i]["properties"]["gi_star_zscore"] = gi_star_scores[i]
            features[i]["properties"]["gi_star_pvalue"] = p_values[i]
            features[i]["properties"]["spot_type"] = spot_class[i]
            features[i]["properties"]["is_hotspot"] = is_hot
            features[i]["properties"]["is_coldspot"] = is_cold
            features[i]["properties"]["is_underserved"] = is_underserved
            features[i]["properties"]["is_high_potential"] = is_high_potential

        summary_stats = {
            "total_hexagons": n,
            "hotspot_count": int(np.sum(gi_star_scores >= 1.65)),
            "coldspot_count": int(np.sum(gi_star_scores <= -1.65)),
            "high_potential_count": sum(1 for f in features if f["properties"]["is_high_potential"]),
            "underserved_count": sum(1 for f in features if f["properties"]["is_underserved"]),
            "mean_score": round(float(x_bar), 1)
        }

        return {
            "type": "FeatureCollection",
            "features": features,
            "summary": summary_stats
        }

    @staticmethod
    def run_dbscan_clustering(candidate_gdf, eps_km=1.5, min_samples=2):
        """
        Runs DBSCAN spatial density clustering on candidate sites.
        Identifies spatial cluster groups and noise outliers (-1).
        """
        if candidate_gdf is None or candidate_gdf.empty:
            return {"clusters": [], "feature_collection": {"type": "FeatureCollection", "features": []}}

        coords_deg = np.array([[row.geometry.y, row.geometry.x] for _, row in candidate_gdf.iterrows()])
        coords_rad = np.radians(coords_deg)

        kms_per_radian = 6371.0088
        epsilon = eps_km / kms_per_radian

        db = DBSCAN(eps=epsilon, min_samples=min_samples, metric='haversine')
        cluster_labels = db.fit_predict(coords_rad)

        features = []
        clusters_summary = {}

        for idx, (_, row) in enumerate(candidate_gdf.iterrows()):
            label = int(cluster_labels[idx])
            props = dict(row.to_dict())
            props.pop('geometry', None)
            props["cluster_id"] = label

            if label not in clusters_summary:
                clusters_summary[label] = {
                    "cluster_id": label,
                    "site_count": 0,
                    "site_names": []
                }
            clusters_summary[label]["site_count"] += 1
            clusters_summary[label]["site_names"].append(props.get("name", f"Site {idx}"))

            features.append({
                "type": "Feature",
                "geometry": row.geometry.__geo_interface__,
                "properties": props
            })

        return {
            "clusters_summary": list(clusters_summary.values()),
            "feature_collection": {"type": "FeatureCollection", "features": features}
        }
