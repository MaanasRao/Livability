from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# --- Events ---
class EventBase(BaseModel):
    type: str
    description: str
    lat: float
    lng: float
    weight: int

class EventCreate(EventBase):
    pass

class EventResponse(EventBase):
    id: int
    class Config:
        orm_mode = True

# --- User Reports ---
class UserReportCreate(BaseModel):
    type: str
    lat: float
    lng: float
    description: Optional[str] = None

class UserReportResponse(UserReportCreate):
    id: int
    created_at: datetime
    class Config:
        orm_mode = True