import os
import unittest
import json
# pyrefly: ignore [missing-import]
from fastapi.testclient import TestClient

from backend.sample_data import generate_all_datasets
from backend.data_loader import GeoDataLoader
from backend.scoring_engine import SiteScoringEngine, haversine_distance_km
from backend.spatial_analysis import SpatialAnalysisEngine
from backend.isochrone_engine import IsochroneEngine
from backend.ai_explainer import AISiteExplainer
from backend.exporter import ReportExporter
from backend.main import app, GDF_STORE, DATASETS, initialize_datasets

class TestGeoSpatialAnalyzer(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Generate datasets and initialize test client."""
        cls.paths = generate_all_datasets()
        initialize_datasets()
        cls.client = TestClient(app)

    def test_sample_datasets_created(self):
        self.assertTrue(os.path.exists(self.paths["demographics"]))
        self.assertTrue(os.path.exists(self.paths["transportation"]))
        self.assertTrue(os.path.exists(self.paths["pois"]))
        self.assertTrue(os.path.exists(self.paths["zoning"]))
        self.assertTrue(os.path.exists(self.paths["environmental"]))
        self.assertTrue(os.path.exists(self.paths["candidate_sites"]))

    def test_haversine_distance(self):
        # Distance between Bengaluru MG Road (12.9716, 77.5946) and Whitefield (12.9698, 77.7499) ~ 16.8 km
        d = haversine_distance_km(12.9716, 77.5946, 12.9698, 77.7499)
        self.assertGreater(d, 12.0)
        self.assertLess(d, 20.0)

    def test_data_loader_wkt_and_csv(self):
        # Test WKT
        wkt_str = "POINT (77.5946 12.9716)"
        gdf_wkt = GeoDataLoader.load_wkt(wkt_str)
        self.assertEqual(len(gdf_wkt), 1)

        # Test CSV with lat/lon
        csv_str = "latitude,longitude,name\n12.9716,77.5946,Bengaluru Site"
        gdf_csv = GeoDataLoader.load_csv(csv_str)
        self.assertEqual(len(gdf_csv), 1)
        self.assertEqual(gdf_csv.geometry.iloc[0].x, 77.5946)

    def test_scoring_engine_valid_site(self):
        # Bengaluru MG Road coordinate
        lat, lon = 12.9716, 77.5946
        res = SiteScoringEngine.evaluate_site(lat, lon, GDF_STORE, preset_key="ev_charging")
        self.assertIn("site_readiness_score", res)
        self.assertGreaterEqual(res["site_readiness_score"], 0.0)
        self.assertLessEqual(res["site_readiness_score"], 100.0)
        self.assertIn("sub_scores", res)

    def test_scoring_engine_flood_exclusion(self):
        # Bellandur Lake flood zone coordinate
        lat, lon = 12.9350, 77.6750
        res = SiteScoringEngine.evaluate_site(lat, lon, GDF_STORE, preset_key="ev_charging", hard_constraints=True)
        if res.get("is_ineligible"):
            self.assertEqual(res["site_readiness_score"], 0.0)
            self.assertIsNotNone(res["exclusion_reason"])

    def test_h3_hex_grid_and_gi_star(self):
        hex_grid = SpatialAnalysisEngine.generate_h3_hex_grid(GDF_STORE, resolution=8, preset_key="ev_charging")
        self.assertGreater(len(hex_grid["features"]), 0)

        gi_star_grid = SpatialAnalysisEngine.calculate_getis_ord_gi_star(hex_grid)
        first_props = gi_star_grid["features"][0]["properties"]
        self.assertIn("gi_star_zscore", first_props)
        self.assertIn("spot_type", first_props)

    def test_isochrone_engine(self):
        iso_res = IsochroneEngine.generate_isochrones(12.9716, 77.5946, GDF_STORE, mode="drive", time_minutes=[10, 20, 30])
        self.assertEqual(len(iso_res["catchments"]), 3)
        self.assertGreater(iso_res["catchments"][0]["reachable_population"], 0)

    def test_ai_explainer_query(self):
        evals = [
            {
                "site_id": "SITE-001", "name": "Site 1", "latitude": 12.9716, "longitude": 77.5946,
                "site_readiness_score": 85.0, "sub_scores": {"demographics": 80, "transportation": 90, "competitor_penalty": 80},
                "spatial_metrics": {"nearest_highway_km": 0.5, "competitor_count_2km": 1, "anchor_count_3km": 5}
            }
        ]
        res = AISiteExplainer.query_recommendations("Find best site with high traffic", evals)
        self.assertEqual(len(res["recommendations"]), 1)

    def test_pdf_exporter(self):
        eval_res = SiteScoringEngine.evaluate_site(12.9716, 77.5946, GDF_STORE)
        explanation = AISiteExplainer.explain_scoring_result(eval_res)
        pdf_bytes = ReportExporter.generate_site_pdf_bytes(eval_res, explanation)
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))

    def test_api_endpoints(self):
        # Preset profiles
        r1 = self.client.get("/api/preset-profiles")
        self.assertEqual(r1.status_code, 200)

        # Layers metadata
        r2 = self.client.get("/api/layers")
        self.assertEqual(r2.status_code, 200)

        # Score point API
        r3 = self.client.post("/api/score-point", json={"latitude": 12.9716, "longitude": 77.5946, "preset_key": "ev_charging"})
        self.assertEqual(r3.status_code, 200)

        # H3 grid API
        r4 = self.client.post("/api/h3-grid", json={"resolution": 8, "preset_key": "ev_charging"})
        self.assertEqual(r4.status_code, 200)

        # Isochrone API
        r5 = self.client.post("/api/isochrone", json={"latitude": 12.9716, "longitude": 77.5946, "mode": "drive", "time_minutes": [10, 20, 30]})
        self.assertEqual(r5.status_code, 200)

        # Compare sites API with AI comparison
        r6 = self.client.post("/api/compare-sites", json={"sites": [{"latitude": 12.9716, "longitude": 77.5946, "name": "Site A"}, {"latitude": 12.9352, "longitude": 77.6245, "name": "Site B"}]})
        self.assertEqual(r6.status_code, 200)
        self.assertIn("ai_comparison", r6.json())
        self.assertIn("verdict", r6.json()["ai_comparison"])

        # Route to hub API
        r_route = self.client.post("/api/route-to-hub", json={"latitude": 12.9716, "longitude": 77.5946, "hub_type": "highway"})
        self.assertEqual(r_route.status_code, 200)
        self.assertIn("distance_km", r_route.json())
        self.assertIn("duration_minutes", r_route.json())

        # Summary stats API
        r_stats = self.client.get("/api/summary-stats?preset_key=ev_charging")
        self.assertEqual(r_stats.status_code, 200)
        self.assertIn("total_candidate_parcels", r_stats.json())
        self.assertIn("metro_avg_score", r_stats.json())

        # Export CSV API
        r7 = self.client.post("/api/export-data?format_type=csv&preset_key=ev_charging")
        self.assertEqual(r7.status_code, 200)
        self.assertIn("site_readiness_score", r7.text)

    def test_distance_decay_variants(self):
        lat, lon = 12.9716, 77.5946
        r_exp = SiteScoringEngine.evaluate_site(lat, lon, GDF_STORE, decay_type="exponential")
        r_gauss = SiteScoringEngine.evaluate_site(lat, lon, GDF_STORE, decay_type="gaussian")
        r_inv = SiteScoringEngine.evaluate_site(lat, lon, GDF_STORE, decay_type="inverse_distance")
        self.assertEqual(r_exp["decay_type"], "exponential")
        self.assertEqual(r_gauss["decay_type"], "gaussian")
        self.assertEqual(r_inv["decay_type"], "inverse_distance")

if __name__ == "__main__":
    unittest.main()
