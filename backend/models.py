from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from database import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    type = Column(String)        # e.g. "traffic", "noise"
    description = Column(String) 
    lat = Column(Float)
    lng = Column(Float)
    
    # 👇 ADD THIS LINE
    weight = Column(Integer, default=0) 
    
    # (Optional) Geoalchemy field if you used it, otherwise ignore
    location = Column(String)