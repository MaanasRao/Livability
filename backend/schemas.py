from pydantic import BaseModel
from datetime import datetime

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
        from_attributes = True

class UserReportBase(BaseModel):
    type: str
    lat: float
    lng: float
    description: str | None

class UserReportCreate(UserReportBase):
    pass

class UserReportResponse(UserReportBase):
    id: int
    created_at: datetime
    votes: int

    class Config:
        from_attributes = True