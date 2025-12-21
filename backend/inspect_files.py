import pandas as pd
import geopandas as gpd
import os

DATA_DIR = "./data"

def inspect_traffic():
    print("----- INSPECTING TRAFFIC CSV -----")
    path = os.path.join(DATA_DIR, "Traffic_Collisions.csv")
    if not os.path.exists(path):
        print("❌ File not found.")
        return

    df = pd.read_csv(path)
    print(f"✅ Loaded {len(df)} rows.")
    print("👇 COLUMN NAMES (Copy these!):")
    print(list(df.columns))
    print("\n👇 First Row Data:")
    print(df.iloc[0].to_dict())

def inspect_noise():
    print("\n----- INSPECTING NOISE GEOJSON -----")
    path = os.path.join(DATA_DIR, "static_noise.geojson")
    if not os.path.exists(path):
        print("❌ File not found.")
        return

    try:
        gdf = gpd.read_file(path)
        print(f"✅ Loaded {len(gdf)} rows.")
        print("👇 GEOMETRY TYPES FOUND:")
        print(gdf.geometry.type.value_counts())
    except Exception as e:
        print(f"❌ Error reading file: {e}")

if __name__ == "__main__":
    inspect_traffic()
    inspect_noise()