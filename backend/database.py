from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

# 1. Load environment variables (DB URL)
load_dotenv()

# 2. Get the DB URL from .env (We will create this .env file next)
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Fallback for when you haven't set up the .env yet
    DATABASE_URL = "sqlite:///./test.db" 

# 3. Create the Database Engine
engine = create_engine(DATABASE_URL)

# 4. Create a SessionLocal class
# Each request will create a new session instance
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 5. Base class for our models
Base = declarative_base()

# 6. Helper function to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()