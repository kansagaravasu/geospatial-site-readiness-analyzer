import os
import io
import json
import zipfile
import tempfile
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, Polygon, LineString, MultiPolygon, MultiPoint
from shapely import wkt
try:
    import rasterio
    from rasterio.features import shapes
except ImportError:
    rasterio = None

class GeoDataLoader:
    """Multi-format Geospatial Data Ingestion & Indexing Engine."""

    @staticmethod
    def load_geojson(file_path_or_dict):
        """Loads GeoJSON file or dict into GeoDataFrame in EPSG:4326."""
        if isinstance(file_path_or_dict, dict):
            gdf = gpd.GeoDataFrame.from_features(file_path_or_dict.get("features", []))
        else:
            gdf = gpd.read_file(file_path_or_dict)
        if gdf.crs is None or gdf.crs.to_epsg() != 4326:
            try:
                gdf = gdf.set_crs(epsg=4326, allow_override=True)
            except Exception:
                pass
        return gdf

    @staticmethod
    def load_shapefile_bytes(zip_bytes):
        """Extracts and loads shapefile from zip byte buffer."""
        with tempfile.TemporaryDirectory() as tmpdir:
            zip_path = os.path.join(tmpdir, "shapefile.zip")
            with open(zip_path, "wb") as f:
                f.write(zip_bytes)
            
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(tmpdir)
                
            shp_files = [f for f in os.listdir(tmpdir) if f.endswith(".shp")]
            if not shp_files:
                raise ValueError("No .shp file found inside the uploaded zip archive.")
            
            shp_path = os.path.join(tmpdir, shp_files[0])
            gdf = gpd.read_file(shp_path)
            if gdf.crs and gdf.crs.to_epsg() != 4326:
                gdf = gdf.to_crs(epsg=4326)
            return gdf

    @staticmethod
    def load_wkt(wkt_text_or_df):
        """Converts WKT string or CSV table with WKT column into GeoDataFrame."""
        if isinstance(wkt_text_or_df, str):
            wkt_text = wkt_text_or_df.strip()
            if wkt_text.startswith("WELLKNOWNTEXT") or wkt_text.startswith("WKT") or "\n" in wkt_text:
                # Could be a CSV containing WKT
                df = pd.read_csv(io.StringIO(wkt_text))
                wkt_col = [c for c in df.columns if 'wkt' in c.lower() or 'geom' in c.lower()]
                if wkt_col:
                    geometry = df[wkt_col[0]].apply(wkt.loads)
                    gdf = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")
                    return gdf
            # Single WKT geometry string
            geom = wkt.loads(wkt_text)
            gdf = gpd.GeoDataFrame([{"id": 1, "geometry": geom}], crs="EPSG:4326")
            return gdf
        elif isinstance(wkt_text_or_df, pd.DataFrame):
            df = wkt_text_or_df
            wkt_col = [c for c in df.columns if 'wkt' in c.lower() or 'geom' in c.lower()][0]
            geometry = df[wkt_col].apply(wkt.loads)
            return gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")
        raise ValueError("Invalid WKT input format.")

    @staticmethod
    def load_csv(csv_bytes_or_str):
        """Loads CSV with lat/lon coordinates or geometry columns."""
        if isinstance(csv_bytes_or_str, bytes):
            df = pd.read_csv(io.BytesIO(csv_bytes_or_str))
        elif isinstance(csv_bytes_or_str, str):
            if os.path.exists(csv_bytes_or_str):
                df = pd.read_csv(csv_bytes_or_str)
            else:
                df = pd.read_csv(io.StringIO(csv_bytes_or_str))
        else:
            df = csv_bytes_or_str

        cols = [c.lower() for c in df.columns]
        lat_col = next((c for c in df.columns if c.lower() in ['lat', 'latitude', 'y']), None)
        lon_col = next((c for c in df.columns if c.lower() in ['lon', 'long', 'longitude', 'x']), None)
        wkt_col = next((c for c in df.columns if 'wkt' in c.lower() or 'geom' in c.lower()), None)

        if lat_col and lon_col:
            geometry = [Point(xy) for xy in zip(df[lon_col], df[lat_col])]
            gdf = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")
            return gdf
        elif wkt_col:
            geometry = df[wkt_col].apply(wkt.loads)
            gdf = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")
            return gdf
        else:
            raise ValueError("CSV must contain latitude/longitude or WKT geometry columns.")

    @staticmethod
    def load_geotiff(geotiff_bytes):
        """Extracts vector polygon features from GeoTIFF raster band."""
        if rasterio is None:
            raise RuntimeError("rasterio library is required to process GeoTIFF files.")
        
        with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as tmp:
            tmp.write(geotiff_bytes)
            tmp_path = tmp.name

        try:
            with rasterio.open(tmp_path) as src:
                image = src.read(1) # first band
                mask = image != src.nodata if src.nodata is not None else None
                
                results = (
                    {'properties': {'raster_val': float(v)}, 'geometry': s}
                    for i, (s, v) in enumerate(shapes(image, mask=mask, transform=src.transform))
                )
                
                geoms = list(results)
                gdf = gpd.GeoDataFrame.from_features(geoms, crs=src.crs)
                if gdf.crs and gdf.crs.to_epsg() != 4326:
                    gdf = gdf.to_crs(epsg=4326)
                return gdf
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    @staticmethod
    def parse_any(filename, content_bytes):
        """Auto-detects file extension and parses into GeoDataFrame."""
        ext = os.path.splitext(filename)[1].lower()
        if ext in ['.geojson', '.json']:
            data = json.loads(content_bytes.decode('utf-8'))
            return GeoDataLoader.load_geojson(data)
        elif ext == '.zip':
            return GeoDataLoader.load_shapefile_bytes(content_bytes)
        elif ext == '.csv':
            return GeoDataLoader.load_csv(content_bytes)
        elif ext in ['.tif', '.tiff', '.geotiff']:
            return GeoDataLoader.load_geotiff(content_bytes)
        elif ext in ['.wkt', '.txt']:
            return GeoDataLoader.load_wkt(content_bytes.decode('utf-8'))
        else:
            # Fallback: try json
            try:
                data = json.loads(content_bytes.decode('utf-8'))
                return GeoDataLoader.load_geojson(data)
            except Exception:
                raise ValueError(f"Unsupported geospatial file format: {ext}")
