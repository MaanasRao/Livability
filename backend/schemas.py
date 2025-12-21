from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class EventCreate(BaseModel):
    type: str
    description: str
    lat: float
    lng: float
    weight: Optional[int] = 0 # <--- Add this

class EventResponse(BaseModel):
    id: int
    created_at: datetime
    type: str
    description: str
    lat: float
    lng: float
    weight: int # <--- Add this

    class Config:
        orm_mode = True