import math
import geopandas as gpd
from shapely.geometry import Point
from backend.geo_resolver import GeoSpatialResolver

def haversine_distance_km(lat1, lon1, lat2, lon2):
    """Calculates great circle distance in km between two lat/lon coordinates."""
    R = 6371.0 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class SiteScoringEngine:
    """Configurable Multi-Factor Site Readiness Scoring Engine (0-100)."""

    PRESETS = {
        "ev_charging": {
            "name": "EV Charging Station",
            "weights": {
                "demographics": 25,
                "transportation": 30,
                "anchor_attraction": 20,
                "competitor_penalty": 15,
                "zoning_suitability": 10
            },
            "decay_type": "exponential",
            "decay_alpha": 0.5, # km
            "min_competitor_dist_km": 0.5
        },
        "retail_store": {
            "name": "Retail Store / Supermarket",
            "weights": {
                "demographics": 35,
                "transportation": 20,
                "anchor_attraction": 25,
                "competitor_penalty": 15,
                "zoning_suitability": 5
            },
            "decay_type": "gaussian",
            "decay_sigma": 1.5,
            "min_competitor_dist_km": 0.8
        },
        "warehouse_logistics": {
            "name": "Warehouse / Logistics Hub",
            "weights": {
                "demographics": 10,
                "transportation": 45,
                "anchor_attraction": 10,
                "competitor_penalty": 5,
                "zoning_suitability": 30
            },
            "decay_type": "inverse_distance",
            "decay_beta": 0.3,
            "min_competitor_dist_km": 0.2
        },
        "telecom_tower": {
            "name": "Telecom 5G Tower",
            "weights": {
                "demographics": 40,
                "transportation": 15,
                "anchor_attraction": 10,
                "competitor_penalty": 15,
                "zoning_suitability": 20
            },
            "decay_type": "exponential",
            "decay_alpha": 0.8,
            "min_competitor_dist_km": 1.0
        },
        "solar_farm": {
            "name": "Solar Energy Array",
            "weights": {
                "demographics": 5,
                "transportation": 15,
                "anchor_attraction": 5,
                "competitor_penalty": 5,
                "zoning_suitability": 70
            },
            "decay_type": "exponential",
            "decay_alpha": 0.2,
            "min_competitor_dist_km": 0.1
        }
    }

    @staticmethod
    def calculate_decay(distance_km, decay_type="exponential", alpha=0.5, sigma=1.5, beta=0.3):
        """Calculates distance-decay factor in range [0, 1]."""
        if distance_km <= 0:
            return 1.0
        if decay_type == "exponential":
            return math.exp(-alpha * distance_km)
        elif decay_type == "gaussian":
            return math.exp(-((distance_km / sigma) ** 2))
        elif decay_type == "inverse_distance":
            return 1.0 / (1.0 + beta * distance_km)
        else:
            return math.exp(-alpha * distance_km)

    @classmethod
    def evaluate_site(cls, lat, lon, dataset_dict, preset_key="ev_charging", custom_weights=None, hard_constraints=True, decay_type=None):
        """
        Evaluates a single site coordinate (lat, lon) against multi-layer geospatial data.
        Returns composite readiness score (0-100) and detailed factor breakdown.
        """
        pt = Point(lon, lat)
        preset = cls.PRESETS.get(preset_key, cls.PRESETS["ev_charging"])
        weights = custom_weights if custom_weights else preset["weights"]

        # Normalize weights to sum to 1.0
        total_w = sum(weights.values()) or 1.0
        norm_w = {k: v / total_w for k, v in weights.items()}

        effective_decay_type = decay_type if decay_type else preset.get("decay_type", "exponential")
        alpha = preset.get("decay_alpha", 0.5)
        sigma = preset.get("decay_sigma", 1.5)
        beta = preset.get("decay_beta", 0.3)

        # Resolve nationwide geographic context and place intelligence
        place = GeoSpatialResolver.resolve_place(lat, lon)

        # 1. Demographics Sub-score (0-100)
        demo_score = 50.0
        pop_dens_val = place["population_density_sqkm"]
        median_inc_val = place["median_income_inr"]
        youth_val = place["youth_ratio"]

        demo_gdf = dataset_dict.get("demographics")
        found_local_demo = False
        if demo_gdf is not None and not demo_gdf.empty:
            containing = demo_gdf[demo_gdf.geometry.contains(pt)]
            if not containing.empty:
                row = containing.iloc[0]
                pop_dens_val = float(row.get("pop_density", pop_dens_val))
                median_inc_val = float(row.get("median_income", median_inc_val))
                youth_val = float(row.get("age_18_35_ratio", youth_val))
                found_local_demo = True

        # Continuous realistic demographic scoring
        dens_score = min(100.0, (pop_dens_val / 11000.0) * 100)
        inc_score = min(100.0, (median_inc_val / 150000.0) * 100)
        youth_score = min(100.0, (youth_val / 0.62) * 100)
        demo_score = (dens_score * 0.45) + (inc_score * 0.35) + (youth_score * 0.20)

        # 2. Transportation Sub-score (0-100)
        trans_score = 40.0
        trans_gdf = dataset_dict.get("transportation")
        dist_to_highway = 999.0
        highway_traffic = 50000
        highway_name = place["highway_info"]["corridor_name"]

        if trans_gdf is not None and not trans_gdf.empty:
            for _, row in trans_gdf.iterrows():
                geom = row.geometry
                if geom.geom_type in ['LineString', 'MultiLineString']:
                    nearest_pt = geom.interpolate(geom.project(pt))
                    d_km = haversine_distance_km(lat, lon, nearest_pt.y, nearest_pt.x)
                    if d_km < dist_to_highway:
                        dist_to_highway = d_km
                        highway_traffic = float(row.get("traffic_aadt", 50000))
                        highway_name = str(row.get("name", highway_name))

        if dist_to_highway > 15.0 or dist_to_highway >= 990.0:
            # Leverage nationwide corridor and highway network
            hwy = place["highway_info"]
            dist_to_highway = hwy["distance_km"]
            highway_traffic = hwy["traffic_aadt"]
            highway_name = hwy["corridor_name"]
            trans_score = hwy["highway_access_score"]
        else:
            if dist_to_highway < 0.1:
                access_factor = 0.92
            elif dist_to_highway <= 2.0:
                access_factor = 1.0 - (dist_to_highway - 0.2) * 0.12
            else:
                access_factor = max(0.2, 1.0 - (dist_to_highway * 0.18))
            traffic_factor = min(1.0, highway_traffic / 140000.0)
            trans_score = max(0.0, min(100.0, (access_factor * 70.0) + (traffic_factor * 30.0)))

        # 3. Anchor Attraction Sub-score & 4. Competitor Penalty Sub-score
        anchor_score = 20.0
        competitor_score = 100.0
        poi_gdf = dataset_dict.get("pois")
        competitor_count_1km = 0
        anchor_count_2km = 0

        has_nearby_pois = False
        if poi_gdf is not None and not poi_gdf.empty:
            anchor_pull = 0.0
            comp_penalty = 0.0
            for _, row in poi_gdf.iterrows():
                geom = row.geometry
                cat = str(row.get("category", "")).lower()
                d_km = haversine_distance_km(lat, lon, geom.y, geom.x)

                if d_km <= 5.0:
                    has_nearby_pois = True
                    if cat in ["anchor_tenant", "complementary", "utility_substation"]:
                        if d_km <= 3.0:
                            anchor_count_2km += 1
                            pull = cls.calculate_decay(d_km, effective_decay_type, alpha, sigma, beta)
                            anchor_pull += pull * 25.0
                    elif cat == "competitor":
                        if d_km <= 2.0:
                            competitor_count_1km += 1
                            penalty_weight = cls.calculate_decay(d_km, effective_decay_type, alpha, sigma, beta)
                            comp_penalty += penalty_weight * 30.0

            if has_nearby_pois:
                anchor_score = min(100.0, anchor_pull)
                competitor_score = max(0.0, 100.0 - comp_penalty)

        if not has_nearby_pois:
            # Use place-specific micro-market density
            competitor_count_1km = place["competitor_count_2km"]
            anchor_count_2km = place["anchor_count_3km"]
            competitor_score = max(25.0, 100.0 - (competitor_count_1km * 16.0))
            anchor_score = min(100.0, anchor_count_2km * 28.0 + (15.0 if place["distance_to_nearest_city_km"] <= 15 else 5.0))

        # 5. Zoning Suitability Sub-score (0-100)
        zoning_score = place["zoning_score"]
        zoning_type = place["zoning_classification"]
        zoning_gdf = dataset_dict.get("zoning")
        if zoning_gdf is not None and not zoning_gdf.empty:
            containing = zoning_gdf[zoning_gdf.geometry.contains(pt)]
            if not containing.empty:
                zrow = containing.iloc[0]
                zoning_score = float(zrow.get("zoning_score", zoning_score))
                zoning_type = str(zrow.get("zoning_type", zoning_type))

        # Check Constraints & Hazards
        is_ineligible = False
        exclusion_reason = None
        environmental_penalty = 0.0

        env_gdf = dataset_dict.get("environmental")
        if env_gdf is not None and not env_gdf.empty:
            containing_env = env_gdf[env_gdf.geometry.contains(pt)]
            if not containing_env.empty:
                for _, erow in containing_env.iterrows():
                    rlevel = str(erow.get("risk_level", "")).upper()
                    if "100YR" in rlevel or "HIGH" in rlevel:
                        if hard_constraints:
                            is_ineligible = True
                            exclusion_reason = f"Located inside 100-Year High Risk Floodplain ({erow.get('name', 'Flood Zone')})"
                            break
                        else:
                            environmental_penalty = 35.0
                            exclusion_reason = f"Flood Risk Warning: Located inside 100-Year Floodplain (-35 pt soft penalty applied)"

        # Check for water bodies (oceans, seas, lakes)
        if place.get("is_water_body"):
            is_ineligible = True
            exclusion_reason = f"Water Area / Submerged Zone ({place['place_name']}): Population density is 0 /km² and commercial construction is strictly prohibited."
            demo_score = 0.0
            zoning_score = 0.0
            trans_score = 0.0
            anchor_score = 0.0
            competitor_score = 100.0
            pop_dens_val = 0
            environmental_penalty = 100.0

        # Apply nationwide environmental model if no local hazard polygon
        if not is_ineligible and environmental_penalty == 0.0:
            env = place["environmental"]

            if env.get("flood_penalty", 0) > 0:
                if hard_constraints and "Buffer" in env["flood_risk_level"]:
                    is_ineligible = True
                    exclusion_reason = f"Coastal / Wetland Buffer Hazard ({env['flood_risk_level']})"
                else:
                    environmental_penalty = env["flood_penalty"]
                    exclusion_reason = f"Environmental Hazard Notice: {env['flood_risk_level']} (-{int(environmental_penalty)} pts)"

        # Compute Raw Weighted Score
        sub_scores = {
            "demographics": round(demo_score, 1),
            "transportation": round(trans_score, 1),
            "anchor_attraction": round(anchor_score, 1),
            "competitor_penalty": round(competitor_score, 1),
            "zoning_suitability": round(zoning_score, 1)
        }

        composite_score = sum(sub_scores[k] * norm_w[k] for k in sub_scores)
        if not hard_constraints and environmental_penalty > 0:
            composite_score = max(0.0, composite_score - environmental_penalty)

        if is_ineligible:
            final_score = 0.0
        else:
            final_score = round(max(0.0, min(100.0, composite_score)), 1)

        return {
            "latitude": lat,
            "longitude": lon,
            "site_readiness_score": final_score,
            "raw_composite_score": round(composite_score, 1),
            "is_ineligible": is_ineligible,
            "exclusion_reason": exclusion_reason,
            "hard_constraints": hard_constraints,
            "decay_type": effective_decay_type,
            "preset_used": preset_key,
            "preset_name": preset["name"],
            "sub_scores": sub_scores,
            "weights": weights,
            "place_profile": place,
            "spatial_metrics": {
                "place_name": place["place_name"],
                "district": place["district"],
                "state": place["state"],
                "region": place["region"],
                "nearest_highway_km": round(dist_to_highway, 2),
                "nearest_highway_name": highway_name,
                "traffic_aadt": highway_traffic,
                "transit_hub_name": place["transit_hub_name"],
                "transit_hub_distance_km": place["transit_hub_distance_km"],
                "competitor_count_2km": competitor_count_1km,
                "anchor_count_3km": anchor_count_2km,
                "population_density_sqkm": pop_dens_val,
                "median_income_inr": median_inc_val,
                "youth_ratio": youth_val,
                "zoning_classification": zoning_type,
                "seismic_zone": place["environmental"]["seismic_zone"],
                "ambient_aqi": place["environmental"]["ambient_aqi"],
                "flood_risk_level": place["environmental"]["flood_risk_level"]
            }
        }
