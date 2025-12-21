import geopandas as gpd
import os

# Check Traffic File
path = "./data/Traffic_Collisions.geojson"
print(f"📂 Checking: {path}")

if os.path.exists(path):
    # 1. Check File Size
    size_mb = os.path.getsize(path) / (1024 * 1024)
    print(f"   Size: {size_mb:.2f} MB")
    
    if size_mb < 0.01:
        print("   ⚠️ WARNING: File is too small! It might be empty or corrupted.")
    else:
        # 2. Check Data
        try:
            gdf = gpd.read_file(path)
            print(f"   Rows loaded: {len(gdf)}")
            print(f"   Columns: {list(gdf.columns)}")
            
            # 3. Check Geometry
            print("\n   🕵️ Checking first row geometry:")
            first_geom = gdf.geometry.iloc[0] if len(gdf) > 0 else "NO DATA"
            print(f"   Geometry Object: {first_geom}")
            
            # 4. Check for 'None' geometries
            missing_geom = gdf.geometry.isna().sum()
            print(f"   Rows with MISSING geometry: {missing_geom}")

        except Exception as e:
            print(f"   ❌ Error reading file: {e}")
else:
    print("   ❌ File does not exist at this path.")