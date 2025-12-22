from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from database import Base

# 1. Permanent Infrastructure (Parks, Schools, Rent Zones, Factories)
class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String)       # e.g., 'park', 'industrial', 'grocery'
    description = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    weight = Column(Integer)    # Impact on score (e.g., +2 or -5)
    location = Column(String)   # PostGIS point (optional)

# 2. Temporary User Reports (Safety Pins, Noise Complaints)
class UserReport(Base):
    __tablename__ = "user_reports"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String)       # e.g., 'safety', 'noise'
    lat = Column(Float)
    lng = Column(Float)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())