from sqlalchemy import Column, Integer, String, DateTime, Float
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from database import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String)  # "noise", "transit", "safety"
    description = Column(String, nullable=True)
    
    # It stores the location as a GEOMETRY point
    location = Column(Geometry("POINT", srid=4326)) 
    
    # Helpers for standard lat/lng (easier for React Native to read)
    lat = Column(Float)
    lng = Column(Float)

    created_at = Column(DateTime(timezone=True), server_default=func.now())