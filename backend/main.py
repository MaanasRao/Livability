from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, get_db
from models import Event
from schemas import EventCreate, EventResponse

# 1. Create the Tables in Supabase (Runs automatically on start)
Base.metadata.create_all(bind=engine)

app = FastAPI()

# 2. CORS Setup (Crucial for Mobile)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROUTES ---

@app.get("/")
def read_root():
    return {"message": "Liveability API is Online 🟢"}

# 1. Save a Report (Frontend sends this)
@app.post("/events", response_model=EventResponse)
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    # Convert lat/lng to PostGIS Geometry format (Optional, but good for future)
    # "POINT(longitude latitude)"
    geo_point = f"POINT({event.lng} {event.lat})"
    
    new_event = Event(
        type=event.type,
        description=event.description,
        lat=event.lat,
        lng=event.lng,
        weight=event.weight,  # <--- ✅ ADDED: Save the weight (danger score)
        location=geo_point
    )
    
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event

# 2. Get All Reports (Frontend reads this)
@app.get("/events", response_model=list[EventResponse])
def get_events(db: Session = Depends(get_db)):
    # ✅ CHANGED: Removed .limit(50)
    # We now fetch all data so the Heatmap can show Traffic, Industry, and Noise.
    # We order by ID to keep it consistent.
    return db.query(Event).all()