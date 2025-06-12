from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import database setup and models
from db import engine, Base, get_db, JournalEntry, Influence
from embedding import embed, embedding_to_base64, base64_to_embedding
from simple_faiss import faiss_index

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables on startup
    Base.metadata.create_all(bind=engine)
    
    # Load FAISS index into app state
    app.state.faiss_index = faiss_index
    print("Loaded FAISS index into app state")
    
    yield
    
    # Save FAISS index on shutdown
    app.state.faiss_index.save_index()
    print("Saved FAISS index on shutdown")

# Create FastAPI app
app = FastAPI(
    title="FastAPI Project",
    description="A FastAPI project with SQLAlchemy, OpenAI, and file processing capabilities",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "FastAPI project is running!"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "1.0.0"}

# Pydantic models for API
class JournalEntryCreate(BaseModel):
    date: Optional[datetime] = None
    text: str
    tags: Optional[List[str]] = []
    core_insights: Optional[List[str]] = []
    image_paths: Optional[List[str]] = []

class JournalEntryResponse(BaseModel):
    id: int
    date: Optional[datetime]
    text: str
    tags: List[str]
    core_insights: List[str]
    image_paths: List[str]
    created_at: datetime

class InfluenceCreate(BaseModel):
    type: str
    source_url: str
    title: str
    text: str
    core_tags: Optional[List[str]] = []
    core_insights: Optional[List[str]] = []

class InfluenceResponse(BaseModel):
    id: int
    type: str
    source_url: str
    title: str
    text: str
    core_tags: List[str]
    core_insights: List[str]
    created_at: datetime

class SearchResult(BaseModel):
    id: int
    similarity_score: float
    entry_type: str
    text_preview: str

class SearchRequest(BaseModel):
    query: str
    k: Optional[int] = 5
    entry_type: Optional[str] = None

# Journal Entry endpoints
@app.post("/journal-entries", response_model=JournalEntryResponse)
async def create_journal_entry(entry: JournalEntryCreate, db: Session = Depends(get_db)):
    """Create a new journal entry with automatic embedding generation"""
    try:
        # Generate embedding for the text
        embedding = embed(entry.text)
        embedding_b64 = embedding_to_base64(embedding)
        
        # Create database entry
        db_entry = JournalEntry(
            date=entry.date,
            text=entry.text,
            tags=entry.tags,
            core_insights=entry.core_insights,
            image_paths=entry.image_paths,
            embedding=embedding_b64
        )
        
        db.add(db_entry)
        db.commit()
        db.refresh(db_entry)
        
        # Add to FAISS index
        faiss_index.add_entry(entry.text, db_entry.id, "journal")
        
        return JournalEntryResponse(
            id=db_entry.id,
            date=db_entry.date,
            text=db_entry.text,
            tags=db_entry.tags or [],
            core_insights=db_entry.core_insights or [],
            image_paths=db_entry.image_paths or [],
            created_at=db_entry.created_at
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create journal entry: {str(e)}")

@app.get("/journal-entries", response_model=List[JournalEntryResponse])
async def get_journal_entries(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    """Get all journal entries"""
    entries = db.query(JournalEntry).offset(skip).limit(limit).all()
    return [
        JournalEntryResponse(
            id=entry.id,
            date=entry.date,
            text=entry.text,
            tags=entry.tags or [],
            core_insights=entry.core_insights or [],
            image_paths=entry.image_paths or [],
            created_at=entry.created_at
        )
        for entry in entries
    ]

@app.get("/journal-entries/{entry_id}", response_model=JournalEntryResponse)
async def get_journal_entry(entry_id: int, db: Session = Depends(get_db)):
    """Get a specific journal entry"""
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    
    return JournalEntryResponse(
        id=entry.id,
        date=entry.date,
        text=entry.text,
        tags=entry.tags or [],
        core_insights=entry.core_insights or [],
        image_paths=entry.image_paths or [],
        created_at=entry.created_at
    )

# Influence endpoints
@app.post("/influences", response_model=InfluenceResponse)
async def create_influence(influence: InfluenceCreate, db: Session = Depends(get_db)):
    """Create a new influence with automatic embedding generation"""
    try:
        # Generate embedding for the text
        embedding = embed(influence.text)
        embedding_b64 = embedding_to_base64(embedding)
        
        # Create database entry
        db_influence = Influence(
            type=influence.type,
            source_url=influence.source_url,
            title=influence.title,
            text=influence.text,
            core_tags=influence.core_tags,
            core_insights=influence.core_insights,
            embedding=embedding_b64
        )
        
        db.add(db_influence)
        db.commit()
        db.refresh(db_influence)
        
        # Add to FAISS index
        faiss_index.add_entry(influence.text, db_influence.id, "influence")
        
        return InfluenceResponse(
            id=db_influence.id,
            type=db_influence.type,
            source_url=db_influence.source_url,
            title=db_influence.title,
            text=db_influence.text,
            core_tags=db_influence.core_tags or [],
            core_insights=db_influence.core_insights or [],
            created_at=db_influence.created_at
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create influence: {str(e)}")

@app.get("/influences", response_model=List[InfluenceResponse])
async def get_influences(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    """Get all influences"""
    influences = db.query(Influence).offset(skip).limit(limit).all()
    return [
        InfluenceResponse(
            id=inf.id,
            type=inf.type,
            source_url=inf.source_url,
            title=inf.title,
            text=inf.text,
            core_tags=inf.core_tags or [],
            core_insights=inf.core_insights or [],
            created_at=inf.created_at
        )
        for inf in influences
    ]

# Search endpoint
@app.post("/search", response_model=List[SearchResult])
async def search_entries(search_request: SearchRequest):
    """Search for similar journal entries and influences using FAISS"""
    try:
        results = faiss_index.search(
            search_request.query, 
            search_request.k, 
            search_request.entry_type
        )
        
        return [
            SearchResult(
                id=entry_id,
                similarity_score=score,
                entry_type=metadata["type"],
                text_preview=metadata["text_preview"]
            )
            for entry_id, score, metadata in results
        ]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

# FAISS index statistics endpoint
@app.get("/search/stats")
async def get_search_stats():
    """Get FAISS index statistics"""
    return faiss_index.get_stats()

# Journal image upload endpoint
@app.post("/upload-images")
async def upload_images(
    files: List[UploadFile] = File(...),
    prompt_file: Optional[str] = Form(None)
):
    """Upload and process 1-100 journal images through the ingest pipeline"""
    import uuid
    import aiofiles
    from ingest_journal_images import ingest_journal_images
    
    # Validate file count
    if len(files) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 files allowed")
    
    # Validate file types
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    for file in files:
        if not file.content_type or file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}")
    
    # Determine prompt configuration file
    prompt_config_path = prompt_file if prompt_file else "prompt_config.json"
    
    # Create uploads directory if it doesn't exist
    uploads_dir = "uploads"
    os.makedirs(uploads_dir, exist_ok=True)
    
    saved_files = []
    
    try:
        # Save uploaded files
        for file in files:
            # Generate unique filename
            file_extension = os.path.splitext(file.filename or "image.jpg")[1]
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = os.path.join(uploads_dir, unique_filename)
            
            # Save file asynchronously
            async with aiofiles.open(file_path, 'wb') as f:
                content = await file.read()
                await f.write(content)
            
            saved_files.append(file_path)
        
        # Process images through ingest pipeline with prompt configuration
        summary = ingest_journal_images(saved_files, prompt_config_path)
        
        # Format response
        processed_entries = []
        for entry in summary.get("processed", []):
            processed_entries.append({
                "entry_id": entry["entry_id"],
                "date": entry["date"]
            })
        
        return {
            "processed": processed_entries,
            "skipped_duplicates": [os.path.basename(f) for f in saved_files 
                                 if os.path.basename(f) in summary.get("skipped_duplicates", [])],
            "errors": summary.get("errors", []),
            "prompt_config_used": prompt_config_path
        }
        
    except Exception as e:
        # Clean up saved files on error
        for file_path in saved_files:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except:
                pass
        
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Example file upload endpoint"""
    if file.content_type and not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    # Process the uploaded file here
    contents = await file.read()
    
    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(contents)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)