from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from database import Base

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String)
    description = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    weight = Column(Integer)
    location = Column(String)

class UserReport(Base):
    __tablename__ = "user_reports"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    votes = Column(Integer, default=0) 