import os
import geopandas as gpd
from supabase import create_client, Client
from shapely.geometry import Point, LineString, Polygon, MultiLineString
from dotenv import load_dotenv

# 1. CONFIGURATION
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing API Keys in .env file")
    exit()

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
DATA_DIR = "./data"

def upload_batch(data_list, batch_size=100):
    total = len(data_list)
    if total == 0: return
    print(f"   🚀 Preparing to upload {total} items...")
    for i in range(0, total, batch_size):
        batch = data_list[i : i + batch_size]
        try:
            supabase.table("events").insert(batch).execute()
        except Exception as e:
            print(f"      ❌ Error on batch {i}: {e}")
    print("   ✨ Upload complete.")

def process_static_noise():
    print("\n🚂 Processing Static Noise (Rail/Highways)...")
    filepath = os.path.join(DATA_DIR, "static_noise.geojson")
    if not os.path.exists(filepath): return print("   ⚠️ File not found: static_noise.geojson")
    
    gdf = gpd.read_file(filepath)
    events = []

    for _, row in gdf.iterrows():
        if row.geometry is None: continue
        
        # Handle Lines and MultiLines
        geoms = []
        if row.geometry.geom_type == 'LineString':
            geoms = [row.geometry]
        elif row.geometry.geom_type == 'MultiLineString':
            geoms = list(row.geometry.geoms)
            
        for geom in geoms:
            # Extract points from the line
            for coord in geom.coords:
                events.append({
                    "type": "noise_static", 
                    "lat": coord[1],
                    "lng": coord[0],
                    "description": "Transport Noise",
                    "weight": 1
                })
                
    upload_batch(events)

# ... (Include process_zoning and process_amenities from previous script here) ...
# For brevity, I am assuming you kept the Zoning/Amenities functions the same.
# If you need them pasted again, let me know!

def process_zoning():
    print("\n🏭 Processing Zoning (Industrial)...")
    filepath = os.path.join(DATA_DIR, "Zoning_By-law_Boundary.geojson")
    if not os.path.exists(filepath): return print("   ⚠️ File not found")
    gdf = gpd.read_file(filepath)
    events = []
    for _, row in gdf.iterrows():
        if row.geometry is None: continue
        if 'industrial' in str(row.to_dict()).lower():
            c = row.geometry.centroid
            events.append({"type": "industrial", "lat": c.y, "lng": c.x, "description": "Industrial Zone", "weight": 1})
    upload_batch(events)

def process_amenities():
    print("\n🌳 Processing Amenities...")
    # ... (Same as before) ...
    pass 

if __name__ == "__main__":
    print("🚀 STARTING DB SEEDER...")      
    process_static_noise() 
    process_zoning()
    process_amenities() 
    print("\n✅ DONE!")