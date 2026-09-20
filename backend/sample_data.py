import os
import json
import math
import geopandas as gpd
from shapely.geometry import Point, Polygon, LineString

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

# Centered around Bengaluru Metropolitan & Tech Hub (India)
CENTER_LAT = 12.9716
CENTER_LON = 77.5946

def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)

def generate_demographics():
    """Generates Census Ward / Neighborhood Polygons with Demographics data for Bengaluru, India."""
    # Prominent IT corridors, commercial cores, and residential hubs in Bengaluru
    neighborhoods = [
        ("MG Road / CBD Commercial Core", 12.9756, 77.6066, 12500, 145000, 0.48, 0.07),
        ("Koramangala Startup & Retail Hub", 12.9352, 77.6245, 11200, 138000, 0.58, 0.12),
        ("Indiranagar / 100ft Road Corridor", 12.9784, 77.6408, 9800, 142000, 0.52, 0.09),
        ("Whitefield / ITPL Tech Corridor", 12.9698, 77.7499, 8900, 126000, 0.62, 0.16),
        ("Electronic City Phase 1 & 2", 12.8399, 77.6770, 7800, 115000, 0.65, 0.14),
        ("HSR Layout / Unicorn Hub", 12.9121, 77.6446, 10500, 132000, 0.60, 0.15),
        ("Bellandur / Outer Ring Road Tech Belt", 12.9304, 77.6784, 9400, 135000, 0.64, 0.18),
        ("Hebbal / Manyata Tech Park North", 13.0358, 77.5970, 8200, 118000, 0.49, 0.13),
        ("Jayanagar / JP Nagar South", 12.9250, 77.5938, 11800, 110000, 0.38, 0.06),
        ("Peenya Industrial Zone", 13.0334, 77.5132, 4200, 72000, 0.32, 0.05),
        ("Yelahanka / Airport North Corridor", 13.1007, 77.5963, 6100, 98000, 0.44, 0.14),
        ("Rajajinagar / Malleshwaram West", 12.9982, 77.5530, 13200, 102000, 0.36, 0.05)
    ]

    features = []
    for name, lat, lon, pop_density, median_inc, youth_ratio, growth in neighborhoods:
        # Create roughly rectangular ward polygon ~0.03 deg wide (~3.3 km)
        half = 0.022
        poly = Polygon([
            (lon - half, lat - half),
            (lon + half, lat - half),
            (lon + half, lat + half),
            (lon - half, lat + half),
            (lon - half, lat - half)
        ])
        pop = int(pop_density * 9.2)
        features.append({
            "type": "Feature",
            "geometry": poly.__geo_interface__,
            "properties": {
                "name": name,
                "population": pop,
                "pop_density": pop_density,
                "median_income": median_inc,
                "age_18_35_ratio": youth_ratio,
                "growth_rate_pct": growth,
                "layer_type": "demographics"
            }
        })
    
    geojson = {"type": "FeatureCollection", "features": features}
    path = os.path.join(DATA_DIR, "demographics.geojson")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)
    return path

def generate_transportation():
    """Generates road network line features and transit hubs in Bengaluru, India."""
    features = []
    
    # Key Expressways & Arterial Corridors in Bengaluru
    highways = [
        ("Outer Ring Road (ORR) Tech Expressway", [
            (77.620, 12.915), (77.645, 12.918), (77.678, 12.930), 
            (77.700, 12.960), (77.685, 13.000), (77.620, 13.040), (77.580, 13.035)
        ], 165000),
        ("Hosur Road & Electronic City Elevated Expressway (NH-44)", [
            (77.610, 12.930), (77.630, 12.890), (77.660, 12.855), (77.680, 12.835)
        ], 145000),
        ("Bengaluru Airport Expressway / Bellary Road (NH-44)", [
            (77.590, 12.990), (77.597, 13.035), (77.610, 13.120), (77.680, 13.200)
        ], 130000),
        ("Old Madras Road Arterial (NH-75)", [
            (77.620, 12.980), (77.660, 12.985), (77.720, 13.000), (77.780, 13.020)
        ], 95000),
        ("NICE Peripheral Ring Road", [
            (77.500, 12.880), (77.530, 12.860), (77.610, 12.840), (77.670, 12.845)
        ], 85000),
        ("Bannerghatta Road Commercial Arterial", [
            (77.595, 12.920), (77.600, 12.880), (77.595, 12.840)
        ], 78000)
    ]
    
    for name, coords, aadt in highways:
        ls = LineString(coords)
        features.append({
            "type": "Feature",
            "geometry": ls.__geo_interface__,
            "properties": {
                "name": name,
                "road_type": "Highway",
                "traffic_aadt": aadt,
                "speed_limit_mph": 50,
                "accessibility_score": 95,
                "layer_type": "transportation"
            }
        })
        
    # Major Transit Hubs & Namma Metro Interchange Stations (Points)
    hubs = [
        ("Majestic / Kempegowda Metro Interchange Hub", 12.9757, 77.5728, "Metro Rail Hub", 85000),
        ("Silk Board Junction Transit & Metro Terminal", 12.9174, 77.6234, "Bus Rapid / Metro", 62000),
        ("Whitefield (Kadugodi) Metro Terminal", 12.9960, 77.7600, "Metro Rail", 38000),
        ("Kempegowda International Airport Terminal (BLR)", 13.1986, 77.7066, "International Airport", 95000),
        ("Yeshwanthpur Railway & Metro Station", 13.0232, 77.5501, "Intercity Rail / Metro", 48000),
        ("KR Puram Multi-Modal Transit Interchange", 13.0012, 77.6792, "Rail / Metro / Bus", 42000),
        ("Indiranagar Metro Station", 12.9783, 77.6385, "Metro Rail", 32000),
        ("Electronic City Metro Hub", 12.8452, 77.6650, "Metro Rail", 36000)
    ]
    for name, lat, lon, htype, pass_count in hubs:
        pt = Point(lon, lat)
        features.append({
            "type": "Feature",
            "geometry": pt.__geo_interface__,
            "properties": {
                "name": name,
                "road_type": "Transit Hub",
                "hub_type": htype,
                "daily_passengers": pass_count,
                "layer_type": "transportation"
            }
        })
        
    geojson = {"type": "FeatureCollection", "features": features}
    path = os.path.join(DATA_DIR, "transportation.geojson")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)
    return path

def generate_pois():
    """Generates Points of Interest, Competitors, Anchor Tenants, and Substations in India."""
    features = []
    
    pois = [
        # Competitors (EV Charging / Retail / Telecom / Dark Stores)
        ("Tata Power EV Supercharging Hub - Indiranagar", 12.9770, 77.6415, "competitor", "EV Fast Charging Station", 16),
        ("Ather Grid Fast Charging Point - Koramangala", 12.9340, 77.6220, "competitor", "EV Two-Wheeler / Car Hub", 10),
        ("Jio-bp Pulse EV Charging Hub - Electronic City", 12.8420, 77.6740, "competitor", "EV Charging Station", 12),
        ("Zepto Quick-Commerce Dark Store - HSR Sector 1", 12.9140, 77.6480, "competitor", "Quick Commerce Micro-Warehouse", 0),
        ("Blinkit Dark Fulfillment Depot - Whitefield", 12.9720, 77.7410, "competitor", "Quick Commerce Warehouse", 0),
        ("Competitor 5G Cell Tower - Bellandur ORR", 12.9320, 77.6820, "competitor", "5G Telecom Infrastructure", 0),
        ("Competitor Hypermarket - Marathahalli", 12.9550, 77.7010, "competitor", "Retail Superstore", 0),
        
        # Anchor Tenants (Commercial Attractors & Tech Parks)
        ("Phoenix Marketcity & VR Bengaluru", 12.9960, 77.6970, "anchor_tenant", "Regional Mega Mall", 35000),
        ("Nexus Mall Koramangala", 12.9345, 77.6110, "anchor_tenant", "Urban Mall & Cinema", 22000),
        ("Manyata Embassy Business Park (Nagavara)", 13.0480, 77.6200, "anchor_tenant", "Major IT Tech Park (120k techies)", 75000),
        ("RMZ Ecoworld & Ecospace Tech Hub (ORR)", 12.9260, 77.6850, "anchor_tenant", "Tier-1 Tech Park Campus", 60000),
        ("International Tech Park Bangalore (ITPL)", 12.9860, 77.7380, "anchor_tenant", "IT Tech Park (Whitefield)", 50000),
        ("UB City Luxury Business & Retail Core", 12.9715, 77.5960, "anchor_tenant", "Central CBD Commercial Complex", 18000),
        ("Bagmane Tech Park - CV Raman Nagar", 12.9800, 77.6600, "anchor_tenant", "ITeS Software Park", 32000),
        
        # Complementary Businesses (Cafes, Mobility Centers, Showrooms)
        ("Third Wave Coffee Flagship - Indiranagar 12th Main", 12.9710, 77.6430, "complementary", "Premium Cafe / Workspace", 2800),
        ("Nature's Basket Gourmet - Koramangala", 12.9360, 77.6270, "complementary", "Gourmet Supermarket", 3200),
        ("Shell Mobility Fuel & EV Station - Bellandur", 12.9330, 77.6740, "complementary", "Mobility / EV Quick Stop", 4100),
        ("Decathlon Sports Megastore - Whitefield", 12.9890, 77.7290, "complementary", "Sports & Retail Complex", 5500),
        ("Starbucks Reserve - Church Street", 12.9750, 77.6040, "complementary", "Premium Dining & Cafe", 3400),

        # Utility Substations (BESCOM Karnataka Power Infrastructure)
        ("BESCOM 220/66kV Substation - Peenya Industrial", 13.0310, 77.5180, "utility_substation", "High Voltage Industrial Grid", 120),
        ("BESCOM 220kV Electrical Substation - Hoodi / Whitefield", 12.9920, 77.7150, "utility_substation", "High Capacity Grid Substation", 150),
        ("BESCOM 66kV Electrical Substation - Koramangala", 12.9380, 77.6190, "utility_substation", "Urban Power Substation", 65),
        ("BESCOM 220kV Substation - Electronic City Phase 1", 12.8360, 77.6710, "utility_substation", "Hi-Tech Power Substation", 100),
        ("BESCOM 66kV Substation - Hebbal / Nagavara", 13.0400, 77.6050, "utility_substation", "Substation", 80)
    ]
    
    for name, lat, lon, cat, desc, metric in pois:
        pt = Point(lon, lat)
        features.append({
            "type": "Feature",
            "geometry": pt.__geo_interface__,
            "properties": {
                "name": name,
                "category": cat,
                "sub_type": desc,
                "metric_value": metric,
                "layer_type": "poi"
            }
        })
        
    geojson = {"type": "FeatureCollection", "features": features}
    path = os.path.join(DATA_DIR, "pois_competitors.geojson")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)
    return path

def generate_zoning():
    """Generates Zoning & Land Use Polygons following Indian Urban Master Plan (BBMP/BDA)."""
    features = []
    
    zones = [
        ("CBD-1 Central Commercial Core (MG Rd / Brigade)", 12.968, 12.982, 77.595, 77.615, "Commercial", 100, 4.0, "ALLOWED"),
        ("IT-1 Hi-Tech Software Tech Park Zone (Whitefield)", 12.960, 12.990, 77.725, 77.760, "Commercial", 95, 3.5, "ALLOWED"),
        ("IT-2 Electronic City Special Tech Corridor", 12.830, 12.855, 77.660, 77.690, "Commercial", 95, 3.5, "ALLOWED"),
        ("COM-2 Outer Ring Road Commercial Belt", 12.920, 12.945, 77.660, 77.700, "Commercial", 90, 3.25, "ALLOWED"),
        ("IND-1 Peenya Heavy & Light Industrial Zone", 13.015, 13.050, 77.500, 77.535, "Industrial", 90, 2.0, "ALLOWED"),
        ("IND-2 Bommasandra Industrial & Logistics Area", 12.810, 12.835, 77.680, 77.710, "Industrial", 85, 2.0, "ALLOWED"),
        ("R-3 Residential High Density (HSR / Koramangala)", 12.905, 12.935, 77.620, 77.655, "Residential", 60, 2.0, "CONDITIONAL"),
        ("R-2 Residential Low Density (Sadashivanagar)", 13.000, 13.025, 77.575, 77.595, "Residential", 25, 1.5, "RESTRICTED"),
        ("ECO-1 Bellandur & Varthur Lake Wetland Buffer", 12.925, 12.955, 77.655, 77.715, "Conservation", 0, 0.0, "PROHIBITED")
    ]
    
    for code, min_lat, max_lat, min_lon, max_lon, ztype, score, far, status in zones:
        poly = Polygon([
            (min_lon, min_lat),
            (max_lon, min_lat),
            (max_lon, max_lat),
            (min_lon, max_lat),
            (min_lon, min_lat)
        ])
        features.append({
            "type": "Feature",
            "geometry": poly.__geo_interface__,
            "properties": {
                "name": code,
                "zoning_code": code,
                "zoning_type": ztype,
                "zoning_score": score,
                "far_max": far,
                "commercial_status": status,
                "layer_type": "zoning"
            }
        })

    # Building Footprints (Commercial & Industrial tech park building structures)
    building_footprints = [
        ("ITPL Explorer Building Footprint", 12.9855, 77.7375, 0.003, 0.002, 12, "Commercial Tech Office", 45000),
        ("RMZ Ecoworld Tower 4 Footprint", 12.9255, 77.6845, 0.003, 0.003, 14, "Commercial IT Office", 62000),
        ("Manyata Block D4 Building Footprint", 13.0475, 77.6195, 0.004, 0.003, 10, "Commercial Software Park", 52000),
        ("UB City Concorde Tower Footprint", 12.9710, 77.5955, 0.002, 0.002, 19, "Commercial Mixed-Use", 28000),
        ("Peenya Industrial Warehouse Shed #12", 13.0315, 77.5135, 0.004, 0.003, 2, "Industrial Warehouse", 38000),
        ("Electronic City Cyber Park Footprint", 12.8385, 77.6765, 0.003, 0.003, 8, "Commercial Office", 34000)
    ]
    for bname, blat, blon, w_deg, h_deg, floors, btype, roof_sqft in building_footprints:
        bpoly = Polygon([
            (blon - w_deg/2, blat - h_deg/2),
            (blon + w_deg/2, blat - h_deg/2),
            (blon + w_deg/2, blat + h_deg/2),
            (blon - w_deg/2, blat + h_deg/2),
            (blon - w_deg/2, blat - h_deg/2)
        ])
        features.append({
            "type": "Feature",
            "geometry": bpoly.__geo_interface__,
            "properties": {
                "name": bname,
                "zoning_type": "Building Footprint",
                "structure_type": btype,
                "building_floors": floors,
                "rooftop_area_sqft": roof_sqft,
                "zoning_score": 95,
                "layer_type": "zoning"
            }
        })
        
    geojson = {"type": "FeatureCollection", "features": features}
    path = os.path.join(DATA_DIR, "zoning_landuse.geojson")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)
    return path

def generate_environmental():
    """Generates Environmental, Lake Catchment, Monsoon Flood Risk, Earthquake Hazard, and Air Quality (AQI) data for Bengaluru."""
    features = []
    
    # 1. 100-Year Monsoon Flood & Lake Catchment Risk Polygons (Bellandur Lake basin, Varthur basin)
    flood_zones = [
        ("Bellandur Lake Wetland & 100-Yr Flood Basin", [
            (77.655, 12.935), (77.675, 12.942), (77.695, 12.938), (77.700, 12.928),
            (77.685, 12.925), (77.665, 12.928), (77.655, 12.935)
        ], "HIGH_RISK_100YR", 100, "Monsoon Floodplain"),
        ("Varthur Lake Stormwater Overflow Channel", [
            (77.710, 12.945), (77.740, 12.952), (77.745, 12.938), (77.720, 12.935), (77.710, 12.945)
        ], "HIGH_RISK_100YR", 100, "Flood Hazard Channel"),
        ("Rainbow Drive / Sarjapur Low-Lying Storm Basin", [
            (77.690, 12.905), (77.705, 12.915), (77.712, 12.902), (77.695, 12.898), (77.690, 12.905)
        ], "MEDIUM_RISK_500YR", 40, "Low-Lying Drainage Area")
    ]
    
    for name, coords, rlevel, penalty, htype in flood_zones:
        poly = Polygon(coords)
        features.append({
            "type": "Feature",
            "geometry": poly.__geo_interface__,
            "properties": {
                "name": name,
                "risk_type": "Flood Risk",
                "hazard_detail": htype,
                "risk_level": rlevel,
                "flood_risk_penalty": penalty,
                "air_quality_aqi": 68,
                "steep_slope_flag": False,
                "layer_type": "environmental"
            }
        })

    # 2. BIS Seismic Hazard & Earthquake Risk Zones (Zone II / Zone III)
    seismic_zones = [
        ("BIS Seismic Zone II (Deccan Shield - Low Earthquake Risk)", [
            (77.45, 12.80), (77.85, 12.80), (77.85, 13.00), (77.45, 13.00), (77.45, 12.80)
        ], "Zone II (Low)", 0.10, "PGA 0.10g"),
        ("Seismic Zone III Transition Corridor (Mandya-Bengaluru Fault Margin)", [
            (77.45, 13.00), (77.85, 13.00), (77.85, 13.20), (77.45, 13.20), (77.45, 13.00)
        ], "Zone III (Moderate)", 0.16, "PGA 0.16g")
    ]
    for name, coords, zlabel, pga, detail in seismic_zones:
        poly = Polygon(coords)
        features.append({
            "type": "Feature",
            "geometry": poly.__geo_interface__,
            "properties": {
                "name": name,
                "risk_type": "Earthquake / Seismic Hazard",
                "hazard_detail": detail,
                "risk_level": zlabel,
                "pga_value": pga,
                "flood_risk_penalty": 0,
                "layer_type": "environmental"
            }
        })

    # 3. CPCB / EPA Continuous Ambient Air Quality Monitoring Stations (Points)
    aqi_stations = [
        ("CPCB CAAQMS Station - City Railway Station (CBD)", 12.9780, 77.5680, 112, "Moderate", 58, 95),
        ("CPCB CAAQMS Station - BTM Layout / Silk Board", 12.9160, 77.6100, 78, "Satisfactory", 38, 64),
        ("CPCB CAAQMS Station - Peenya Industrial Corridor", 13.0300, 77.5120, 148, "Moderate", 82, 128),
        ("CPCB CAAQMS Station - Saneguruvanahalli (West)", 12.9920, 77.5450, 65, "Satisfactory", 30, 55),
        ("CPCB CAAQMS Station - Whitefield Export Promotion Park", 12.9750, 77.7320, 92, "Satisfactory", 46, 78),
        ("CPCB CAAQMS Station - Hebbal Manyata North", 13.0360, 77.6020, 84, "Satisfactory", 42, 71)
    ]
    for name, lat, lon, aqi, cat, pm25, pm10 in aqi_stations:
        pt = Point(lon, lat)
        features.append({
            "type": "Feature",
            "geometry": pt.__geo_interface__,
            "properties": {
                "name": name,
                "risk_type": "Air Quality (AQI)",
                "hazard_detail": f"AQI {aqi} ({cat})",
                "air_quality_aqi": aqi,
                "aqi_category": cat,
                "pm25": pm25,
                "pm10": pm10,
                "layer_type": "environmental"
            }
        })
        
    geojson = {"type": "FeatureCollection", "features": features}
    path = os.path.join(DATA_DIR, "flood_environmental.geojson")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)
    return path

def generate_candidate_sites():
    """Generates 25 Candidate Site Locations with realistic attributes across Bengaluru, India."""
    base_locations = [
        ("Site #1 - Koramangala 80ft Road Commercial Plot", 12.9358, 77.6238, "80 Feet Road, 4th Block, Koramangala", 0.75, 185000000),
        ("Site #2 - Outer Ring Road Bellandur Tech Pad", 12.9295, 77.6760, "Opp. RMZ Ecospace, Marathahalli-Sarjapur ORR", 1.40, 320000000),
        ("Site #3 - Indiranagar 100ft Road Corner Site", 12.9790, 77.6402, "100 Feet Rd, HAL 2nd Stage, Indiranagar", 0.65, 210000000),
        ("Site #4 - Whitefield ITPL Main Road EV Hub", 12.9715, 77.7475, "ITPB Main Road, Pattandur Agrahara, Whitefield", 1.80, 240000000),
        ("Site #5 - Electronic City Phase 1 Highway Parcel", 12.8415, 77.6750, "Hosur Main Road, Electronic City Phase 1", 2.50, 195000000),
        ("Site #6 - HSR Layout Sector 1 Commercial Pad", 12.9135, 77.6430, "19th Main Road, Sector 1, HSR Layout", 0.85, 175000000),
        ("Site #7 - Manyata Tech Park Gateway Plot", 13.0420, 77.6180, "Thanisandra Main Rd, Nagavara", 2.20, 260000000),
        ("Site #8 - Peenya Industrial 4th Phase Logistics Lot", 13.0320, 77.5140, "4th Phase, Peenya Industrial Area", 5.50, 160000000),
        ("Site #9 - Airport Road Devanahalli Logistics Pad", 13.1850, 77.7020, "NH-44 Airport Corridor, Devanahalli", 8.00, 220000000),
        ("Site #10 - MG Road Commercial Redevelopment Site", 12.9745, 77.6080, "MG Road near Trinity Metro Station", 0.55, 290000000),
        ("Site #11 - Marathahalli Bridge Junction Site", 12.9560, 77.7020, "Varthur Main Rd, Marathahalli", 1.10, 150000000),
        ("Site #12 - JP Nagar 24th Main Retail Parcel", 12.9100, 77.5850, "24th Main, JP Nagar 5th Phase", 0.90, 140000000),
        ("Site #13 - Yeshwanthpur Express Hub Site", 13.0250, 77.5520, "Tumkur Road, Yeshwanthpur Industrial Suburb", 2.10, 210000000),
        ("Site #14 - Sarjapur Road WIPRO Corporate Pad", 12.9080, 77.6880, "Sarjapur Main Road, Doddakannelli", 3.20, 230000000),
        ("Site #15 - Hebbal Flyover North Commercial Plot", 13.0380, 77.5930, "Bellary Road, Hebbal Kempapura", 1.60, 250000000),
        ("Site #16 - Bommasandra Industrial Link Plot", 12.8180, 77.6860, "Bommasandra Industrial Area, Hosur Road", 6.00, 130000000),
        ("Site #17 - Hoodi Junction Metro Fringe Site", 12.9930, 77.7170, "Hoodi Main Rd, Mahadevapura", 1.75, 180000000),
        ("Site #18 - Jayanagar 4th Block Shopping Pad", 12.9280, 77.5840, "11th Main, 4th Block, Jayanagar", 0.70, 190000000),
        ("Site #19 - Yelahanka New Town Express Pad", 13.1020, 77.5880, "Major Sandeep Unnikrishnan Rd, Yelahanka", 2.80, 165000000),
        ("Site #20 - Rajajinagar Industrial Town Site", 12.9940, 77.5480, "West of Chord Road, Rajajinagar", 1.30, 195000000),
        ("Site #21 - Kadugodi Tree Park Tech Site", 12.9980, 77.7580, "Whitefield-Hoskote Road, Kadugodi", 3.00, 170000000),
        ("Site #22 - Silk Board Transit Interchange Pad", 12.9185, 77.6250, "Hosur Road, Madiwala / Silk Board", 1.05, 230000000),
        ("Site #23 - Bannerghatta Road IIM-B Fringe Site", 12.8950, 77.6010, "Bannerghatta Main Road, Bilekahalli, Bengaluru", 1.50, 185000000),
        ("Site #24 - Domlur Flyover Corporate Plot", 12.9620, 77.6380, "Intermediate Ring Road, Domlur, Bengaluru", 1.20, 240000000),
        ("Site #25 - Bellandur Lake Lowland Restricted Plot", 12.9340, 77.6680, "Bellandur Lake Wetland Buffer Margin, Bengaluru", 1.10, 85000000),
        # Nationwide Candidate Hubs across Indian Metros
        ("Site #26 - Mumbai BKC Commercial Gateway Parcel", 19.0665, 72.8685, "G-Block, Bandra Kurla Complex (BKC), Mumbai", 1.20, 580000000),
        ("Site #27 - Navi Mumbai JNPT Expressway Logistics Hub", 19.0220, 73.0450, "Sion-Panvel Highway / JNPT Port Corridor, Navi Mumbai", 6.50, 290000000),
        ("Site #28 - Gurugram Cyber City / NH-48 Commercial Pad", 28.4920, 77.0890, "DLF Phase 2, NH-48 Express Corridor, Gurugram", 2.10, 420000000),
        ("Site #29 - Noida Expressway Sector 135 Tech Campus", 28.5020, 77.4080, "Noida-Greater Noida Expressway, Sector 135, Noida", 3.80, 310000000),
        ("Site #30 - Delhi Aerocity Hospitality & Transit Pad", 28.5520, 77.1210, "Northern Access Rd, IGI Airport Aerocity, New Delhi", 1.80, 490000000),
        ("Site #31 - Hyderabad HITEC City Cyber Towers Plot", 17.4490, 78.3780, "HITEC City Main Road, Madhapur, Hyderabad", 1.95, 340000000),
        ("Site #32 - Hyderabad Financial District Gachibowli Pad", 17.4180, 78.3420, "Nanakramguda Financial District, Gachibowli, Hyderabad", 4.20, 380000000),
        ("Site #33 - Chennai OMR Sholinganallur IT Gateway", 12.9010, 80.2280, "Old Mahabalipuram Road (OMR), Sholinganallur, Chennai", 2.50, 260000000),
        ("Site #34 - Chennai Sriperumbudur EV & Auto Mega Plot", 12.9680, 79.9520, "NH-48 Industrial Corridor, Sriperumbudur, Tamil Nadu", 9.50, 210000000),
        ("Site #35 - Pune Hinjewadi Phase 1 Software Pad", 18.5920, 73.7380, "Rajiv Gandhi Infotech Park, Phase 1, Hinjewadi, Pune", 3.10, 280000000),
        ("Site #36 - Pune Chakan Auto Industrial Hub Lot", 18.7520, 73.8540, "MIDC Phase 2, Chakan Industrial Area, Pune", 7.80, 180000000),
        ("Site #37 - Ahmedabad SG Highway Commercial Core", 23.0250, 72.5080, "Sarkhej-Gandhinagar (SG) Highway, Bodakdev, Ahmedabad", 1.60, 240000000),
        ("Site #38 - GIFT City International Finance SEZ Pad", 23.1620, 72.6840, "GIFT City Special Economic Zone, Gandhinagar, Gujarat", 3.40, 350000000),
        ("Site #39 - Kolkata Salt Lake Sector V Tech Pad", 22.5810, 88.4320, "Sector V, Salt Lake Electronic Complex, Kolkata", 1.75, 195000000),
        ("Site #40 - Jaipur Sitapura Industrial & Solar Logistics", 26.7820, 75.8290, "RIICO Industrial Area, Sitapura, Jaipur, Rajasthan", 5.20, 150000000)
    ]
    
    features = []
    for idx, (name, lat, lon, address, area_acres, price_inr) in enumerate(base_locations, 1):
        pt = Point(lon, lat)
        features.append({
            "type": "Feature",
            "geometry": pt.__geo_interface__,
            "properties": {
                "site_id": f"SITE-{idx:03d}",
                "name": name,
                "address": address,
                "area_acres": area_acres,
                "asking_price_inr": price_inr,
                "asking_price_display": f"₹{price_inr / 10000000:.2f} Cr",
                "latitude": lat,
                "longitude": lon,
                "layer_type": "candidate_site"
            }
        })
        
    geojson = {"type": "FeatureCollection", "features": features}
    path = os.path.join(DATA_DIR, "candidate_sites.geojson")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)
    return path

def generate_all_datasets():
    """Generates all 6 layer GeoJSON datasets for Bengaluru, India."""
    ensure_data_dir()
    p1 = generate_demographics()
    p2 = generate_transportation()
    p3 = generate_pois()
    p4 = generate_zoning()
    p5 = generate_environmental()
    p6 = generate_candidate_sites()
    return {
        "demographics": p1,
        "transportation": p2,
        "pois": p3,
        "zoning": p4,
        "environmental": p5,
        "candidate_sites": p6
    }

if __name__ == "__main__":
    paths = generate_all_datasets()
    print("Generated Bengaluru & India Metro sample datasets successfully:")
    for k, v in paths.items():
        print(f" - {k}: {v}")
