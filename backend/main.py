import os
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from database import engine, Base, get_db
from models import Event, UserReport
from schemas import EventCreate, EventResponse, UserReportCreate, UserReportResponse

# --- 1. CONFIGURATION ---

# Load environment variables from .env file
load_dotenv()

# Get the key from the .env file
API_KEY = os.getenv("BACKEND_SECRET")

# Safety Check: Stop server if key is missing to prevent insecure startups
if not API_KEY:
    raise RuntimeError("CRITICAL ERROR: 'BACKEND_SECRET' is missing from .env file!")

# Initialize Database Tables
Base.metadata.create_all(bind=engine)

# Initialize Rate Limiter (Anti-Spam)
limiter = Limiter(key_func=get_remote_address)

app = FastAPI()

# --- 2. MIDDLEWARE & SECURITY SETUP ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define where to look for the key (in the Header "X-API-Key")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Security Function: Checks if the password is correct
async def get_api_key(api_key_header: str = Depends(api_key_header)):
    if api_key_header == API_KEY:
        return api_key_header
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Could not validate credentials"
        )

# --- 3. ROUTES ---

@app.get("/")
def read_root():
    return {"message": "Liveability API is Online 🟢"}

# --- STATIC EVENTS ---

# Public: Anyone can READ events
@app.get("/events", response_model=list[EventResponse])
def get_events(db: Session = Depends(get_db)):
    return db.query(Event).all()

# Protected: Only the App can CREATE events
@app.post("/events", response_model=EventResponse, dependencies=[Depends(get_api_key)])
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    new_event = Event(
        type=event.type, description=event.description,
        lat=event.lat, lng=event.lng, weight=event.weight
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event

# --- USER REPORTS ---

# Public: Anyone can READ reports
@app.get("/user_reports", response_model=list[UserReportResponse])
def get_reports(db: Session = Depends(get_db)):
    return db.query(UserReport).all()

# Protected + Limited: Max 5 reports per minute per person
@app.post("/user_reports", response_model=UserReportResponse, dependencies=[Depends(get_api_key)])
@limiter.limit("5/minute")
def create_report(request: Request, report: UserReportCreate, db: Session = Depends(get_db)):
    new_report = UserReport(
        type=report.type, lat=report.lat, lng=report.lng, description=report.description, votes=0
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    return new_report

# --- VOTING & RESOLUTION ---

# Protected + Limited: Max 20 votes per minute
# NOTE: 'request' parameter is required for the rate limiter to work
@app.post("/reports/{report_id}/vote", dependencies=[Depends(get_api_key)])
@limiter.limit("20/minute")
def vote_report(request: Request, report_id: int, vote_type: str, db: Session = Depends(get_db)):
    # 1. Find the report
    report = db.query(UserReport).filter(UserReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # 2. Apply the vote
    if vote_type == "up":
        report.votes += 1
    elif vote_type == "down":
        report.votes -= 1
    else:
        raise HTTPException(status_code=400, detail="Use 'up' or 'down'")

    # 3. Community Deletion: Remove if score hits -3
    if report.votes <= -3:
        db.delete(report)
        db.commit()
        return {"message": "Report removed", "deleted": True, "votes": report.votes}

    db.commit()
    db.refresh(report)
    return {"message": "Vote recorded", "deleted": False, "votes": report.votes}

# Protected: Only the App can DELETE
@app.delete("/user_reports", dependencies=[Depends(get_api_key)])
def delete_report(id: int, db: Session = Depends(get_db)):
    report = db.query(UserReport).filter(UserReport.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
    return {"message": "Report resolved/deleted"}

# Protected: Only the App can RESOLVE (Explicit removal)
@app.post("/reports/{report_id}/resolve", dependencies=[Depends(get_api_key)])
def resolve_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(UserReport).filter(UserReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    db.delete(report)
    db.commit()
    return {"message": "Report resolved and removed"}