from pydantic import BaseModel
from datetime import datetime

# What the User sends (React Native -> Backend)
class EventCreate(BaseModel):
    type: str
    lat: float
    lng: float
    description: str | None = None

# What the Backend sends back (Backend -> React Native)
class EventResponse(EventCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True