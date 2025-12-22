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
    if not os.path.exists(filepath): 
        return print("   ⚠️ File not found: static_noise.geojson")
    
    gdf = gpd.read_file(filepath)
    events = []

    for _, row in gdf.iterrows():
        if row.geometry is None: continue
        geoms = []
        if row.geometry.geom_type == 'LineString':
            geoms = [row.geometry]
        elif row.geometry.geom_type == 'MultiLineString':
            geoms = list(row.geometry.geoms)
            
        for geom in geoms:
            for coord in geom.coords:
                events.append({
                    "type": "noise_static", 
                    "lat": coord[1],
                    "lng": coord[0],
                    "description": "Transport Noise",
                    "weight": 1
                })
    upload_batch(events)

def process_zoning():
    print("\n🏭 Processing Zoning (Industrial)...")
    filepath = os.path.join(DATA_DIR, "Zoning_By-law_Boundary.geojson")
    if not os.path.exists(filepath): 
        return print("   ⚠️ File not found: Zoning_By-law_Boundary.geojson")
    
    gdf = gpd.read_file(filepath)
    events = []
    
    for _, row in gdf.iterrows():
        if row.geometry is None: continue
        zoning_info = str(row.to_dict()).lower()
        
        if 'industrial' in zoning_info or 'm1' in zoning_info or 'm2' in zoning_info:
            c = row.geometry.centroid
            events.append({
                "type": "industrial", 
                "lat": c.y, 
                "lng": c.x, 
                "description": "Industrial Zone", 
                "weight": 1
            })
    upload_batch(events)

def process_amenities():
    print("\n🌳 Processing Amenities (Parks/Schools)...")
    
    # 1. PARKS
    park_path = os.path.join(DATA_DIR, "Parks.geojson")
    if os.path.exists(park_path):
        gdf = gpd.read_file(park_path)
        events = []
        for _, row in gdf.iterrows():
            if row.geometry is None: continue
            c = row.geometry.centroid
            events.append({
                "type": "park",
                "lat": c.y,
                "lng": c.x,
                "description": row.get('PARK_NAME', 'Local Park'),
                "weight": 2
            })
        print(f"   Found {len(events)} Parks.")
        upload_batch(events)

    # 2. SCHOOLS
    school_path = os.path.join(DATA_DIR, "Schools.geojson")
    if os.path.exists(school_path):
        gdf = gpd.read_file(school_path)
        events = []
        for _, row in gdf.iterrows():
            if row.geometry is None: continue
            lat = row.geometry.y if row.geometry.geom_type == 'Point' else row.geometry.centroid.y
            lng = row.geometry.x if row.geometry.geom_type == 'Point' else row.geometry.centroid.x
            events.append({
                "type": "school",
                "lat": lat,
                "lng": lng,
                "description": row.get('NAME', 'School'),
                "weight": 2
            })
        print(f"   Found {len(events)} Schools.")
        upload_batch(events)

def process_mobility():
    print("\n🚌 Processing Mobility (Transit Stops)...")
    filepath = os.path.join(DATA_DIR, "HSR_Bus_Stops.geojson") 
    
    if not os.path.exists(filepath): 
        return print(f"   ⚠️ File not found: {filepath}")
        
    gdf = gpd.read_file(filepath)
    events = []
    for _, row in gdf.iterrows():
        if row.geometry is None: continue
        events.append({
            "type": "mobility", 
            "lat": row.geometry.y, 
            "lng": row.geometry.x, 
            "description": row.get('STOP_NAME', 'HSR Bus Stop'), 
            "weight": 2
        })
    upload_batch(events)

def process_healthcare():
    print("\n🏥 Processing Healthcare (Hospitals)...")
    filepath = os.path.join(DATA_DIR, "Hospitals.geojson")
    if not os.path.exists(filepath): 
        return print("   ⚠️ File not found: Hospitals.geojson")
        
    gdf = gpd.read_file(filepath)
    events = []
    for _, row in gdf.iterrows():
        if row.geometry is None: continue
        lat = row.geometry.y if row.geometry.geom_type == 'Point' else row.geometry.centroid.y
        lng = row.geometry.x if row.geometry.geom_type == 'Point' else row.geometry.centroid.x
        events.append({
            "type": "healthcare", 
            "lat": lat, 
            "lng": lng, 
            "description": row.get('NAME', 'Hospital/Clinic'), 
            "weight": 3
        })
    upload_batch(events)

def process_rent():
    print("\n💰 Seeding Rent Prices (1BR & 2BR)...")
    
    # Exact prices extracted from your CMHC Table 1.1.2
    zones = [
        {"name": "Zone 1 - Downtown Core", "p1": 1398, "p2": 1643, "lat": 43.256, "lng": -79.868},
        {"name": "Zone 2 - Central East", "p1": 1102, "p2": 1291, "lat": 43.252, "lng": -79.835},
        {"name": "Zone 3 - East End", "p1": 1279, "p2": 1464, "lat": 43.235, "lng": -79.780},
        {"name": "Zone 4 - Central", "p1": 1365, "p2": 1506, "lat": 43.242, "lng": -79.820},
        {"name": "Zone 5 - West End", "p1": 1462, "p2": 1633, "lat": 43.261, "lng": -79.905},
        {"name": "Zone 6 - Mountain", "p1": 1320, "p2": 1479, "lat": 43.230, "lng": -79.880},
        {"name": "Zone 7 - Stoney Creek", "p1": 1230, "p2": 1408, "lat": 43.220, "lng": -79.750},
        {"name": "Zone 8 - Burlington", "p1": 1749, "p2": 2057, "lat": 43.325, "lng": -79.799},
        {"name": "Zone 9 - Ancaster/Dundas", "p1": 1493, "p2": 1811, "lat": 43.235, "lng": -79.945}
    ]
    
    events = []
    for z in zones:
        events.append({
            "type": "rent_info",
            "lat": z["lat"],
            "lng": z["lng"],
            # Store both prices in the description so the frontend just displays it
            "description": f"1BR: ${z['p1']}  |  2BR: ${z['p2']}",
            "weight": z["p2"] # Keep weight as 2BR for calculations if needed
        })
        
    upload_batch(events)
    
def process_grocery():
    print("\n🛒 Processing Grocery Stores...")
    # Make sure grocery.geojson is in your 'data' folder
    filepath = os.path.join(DATA_DIR, "grocery.geojson") 
    
    if not os.path.exists(filepath): 
        return print(f"   ⚠️ File not found: {filepath}")
        
    gdf = gpd.read_file(filepath)
    events = []
    
    for _, row in gdf.iterrows():
        if row.geometry is None: continue
        
        # Extract the name from the properties
        name = row.get('name', 'Grocery Store')
        if not name: name = "Local Supermarket"

        events.append({
            "type": "grocery", 
            "lat": row.geometry.y, 
            "lng": row.geometry.x, 
            "description": name, 
            "weight": 2 # Adds +2 to Livability Score
        })
    upload_batch(events)

if __name__ == "__main__":
    print("🚀 STARTING FULL DB SEEDER...")
    
    process_static_noise() 
    process_zoning()
    process_amenities() 
    process_mobility()
    process_healthcare()
    process_rent()
    process_grocery()
    
    print("\n✅ ALL DATA SEEDED SUCCESSFULLY!")