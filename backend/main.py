from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, get_db
from models import Event, UserReport
from schemas import EventCreate, EventResponse, UserReportCreate, UserReportResponse

# Initialize Tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Liveability API is Online 🟢"}

# --- ROUTES: STATIC EVENTS ---

@app.get("/events", response_model=list[EventResponse])
def get_events(db: Session = Depends(get_db)):
    return db.query(Event).all()

@app.post("/events", response_model=EventResponse)
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    geo = f"POINT({event.lng} {event.lat})"
    new_event = Event(
        type=event.type, description=event.description,
        lat=event.lat, lng=event.lng, weight=event.weight, location=geo
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event

# --- ROUTES: USER REPORTS ---

@app.get("/user_reports", response_model=list[UserReportResponse])
def get_reports(db: Session = Depends(get_db)):
    return db.query(UserReport).all()

@app.post("/user_reports", response_model=UserReportResponse)
def create_report(report: UserReportCreate, db: Session = Depends(get_db)):
    new_report = UserReport(
        type=report.type, lat=report.lat, lng=report.lng, description=report.description
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    return new_report

@app.delete("/user_reports")
def delete_report(id: int, db: Session = Depends(get_db)):
    report = db.query(UserReport).filter(UserReport.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
    return {"message": "Report resolved/deleted"}