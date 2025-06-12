from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Float
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")

# Create SQLAlchemy engine
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # For PostgreSQL and other databases
    engine = create_engine(DATABASE_URL)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

# Journal Entry model
class JournalEntry(Base):
    __tablename__ = "journal_entries"
    
    id = Column(Integer, primary_key=True)
    date = Column(DateTime)                  # detected date in the entry
    text = Column(Text)                      # full transcript
    tags = Column(JSON)                      # list[str]
    core_insights = Column(JSON)             # list[str]
    image_paths = Column(JSON)               # list[str]
    image_hash = Column(String, index=True, unique=True)
    transcript_hash = Column(String, index=True, unique=True)
    embedding = Column(Text)                 # store as base64 of np.ndarray.tobytes()
    created_at = Column(DateTime, default=datetime.utcnow)

# Influence model
class Influence(Base):
    __tablename__ = "influences"
    
    id = Column(Integer, primary_key=True)
    type = Column(String)                    # "video" | "article" | ...
    source_url = Column(String, unique=True)
    title = Column(String)
    text = Column(Text)
    core_tags = Column(JSON)
    core_insights = Column(JSON)
    embedding = Column(Text)                 # store as base64 of np.ndarray.tobytes()
    created_at = Column(DateTime, default=datetime.utcnow)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()