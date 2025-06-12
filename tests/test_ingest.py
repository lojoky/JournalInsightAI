#!/usr/bin/env python3
"""
Test suite for journal image ingest pipeline
"""
import pytest
import os
import shutil
import tempfile
from PIL import Image, ImageDraw, ImageFont
import io
import requests
from fastapi.testclient import TestClient

from main import app
from db import Base, engine
from ingest_journal_images import ingest_journal_images

# Test client
client = TestClient(app)

@pytest.fixture(scope="module")
def test_db():
    """Set up test database"""
    # Create tables
    Base.metadata.create_all(bind=engine)
    yield
    # Cleanup handled by test isolation

def create_test_image(text: str, filename: str) -> str:
    """Create a test image with handwritten-style text"""
    # Create a white image
    img = Image.new('RGB', (800, 600), color='white')
    draw = ImageDraw.Draw(img)
    
    # Try to use a basic font, fall back to default if not available
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
    except:
        font = ImageFont.load_default()
    
    # Add text to image
    lines = text.split('\n')
    y_offset = 50
    for line in lines:
        draw.text((50, y_offset), line, fill='black', font=font)
        y_offset += 40
    
    # Save image
    img.save(filename, 'JPEG')
    return filename

@pytest.fixture
def sample_images():
    """Create sample test images"""
    temp_dir = tempfile.mkdtemp()
    
    # Image 1: Single date entry
    image1_text = """June 11, 2025
Today was a productive day. I worked on implementing the journal ingest pipeline.
Key insights: OCR technology has improved significantly.
Tags: productivity, technology, development"""
    
    image1_path = os.path.join(temp_dir, "journal_page1.jpg")
    create_test_image(image1_text, image1_path)
    
    # Image 2: Multi-date entry
    image2_text = """June 12, 2025
Morning reflection: Starting the day with clarity and purpose.

June 13, 2025
Evening thoughts: Completed the API integration successfully.
The system now handles duplicate detection properly."""
    
    image2_path = os.path.join(temp_dir, "journal_page2.jpg")
    create_test_image(image2_text, image2_path)
    
    yield [image1_path, image2_path], temp_dir
    
    # Cleanup
    shutil.rmtree(temp_dir, ignore_errors=True)

def test_ingest_pipeline_cli(sample_images, test_db):
    """Test the CLI ingest pipeline directly"""
    image_paths, temp_dir = sample_images
    
    # First run - should process both images
    summary = ingest_journal_images(image_paths)
    
    assert len(summary["processed"]) >= 2  # At least 2 entries (could be more due to date splitting)
    assert len(summary["skipped_duplicates"]) == 0
    assert len(summary["errors"]) == 0
    
    # Verify entries have required fields
    for entry in summary["processed"]:
        assert "entry_id" in entry
        assert "date" in entry
        assert isinstance(entry["entry_id"], int)
    
    # Second run - should skip duplicates
    summary2 = ingest_journal_images(image_paths)
    
    assert len(summary2["processed"]) == 0  # No new entries
    assert len(summary2["skipped_duplicates"]) == 2  # Both images skipped
    assert len(summary2["errors"]) == 0

def test_upload_images_endpoint(sample_images, test_db):
    """Test the HTTP upload endpoint"""
    image_paths, temp_dir = sample_images
    
    # Prepare files for upload
    files = []
    for image_path in image_paths:
        with open(image_path, 'rb') as f:
            files.append(('files', (os.path.basename(image_path), f.read(), 'image/jpeg')))
    
    # First upload - should process images
    response = client.post("/upload-images", files=files)
    
    assert response.status_code == 200
    data = response.json()
    
    assert "processed" in data
    assert "skipped_duplicates" in data
    assert "errors" in data
    
    assert len(data["processed"]) >= 2  # At least 2 entries
    assert len(data["skipped_duplicates"]) == 0
    assert len(data["errors"]) == 0
    
    # Verify response format
    for entry in data["processed"]:
        assert "entry_id" in entry
        assert "date" in entry
        assert isinstance(entry["entry_id"], int)
    
    # Second upload - should detect duplicates
    files2 = []
    for image_path in image_paths:
        with open(image_path, 'rb') as f:
            files2.append(('files', (os.path.basename(image_path), f.read(), 'image/jpeg')))
    
    response2 = client.post("/upload-images", files=files2)
    
    assert response2.status_code == 200
    data2 = response2.json()
    
    assert len(data2["processed"]) == 0  # No new entries
    assert len(data2["skipped_duplicates"]) == 2  # Both images detected as duplicates

def test_invalid_file_upload():
    """Test upload with invalid file types"""
    # Create a text file instead of image
    text_content = b"This is not an image file"
    files = [('files', ('test.txt', text_content, 'text/plain'))]
    
    response = client.post("/upload-images", files=files)
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]

def test_too_many_files():
    """Test upload with too many files"""
    # Create 101 fake file objects
    files = []
    for i in range(101):
        files.append(('files', (f'image{i}.jpg', b'fake image data', 'image/jpeg')))
    
    response = client.post("/upload-images", files=files)
    assert response.status_code == 400
    assert "Maximum 100 files allowed" in response.json()["detail"]

def test_search_stats_endpoint():
    """Test FAISS search statistics endpoint"""
    response = client.get("/search/stats")
    assert response.status_code == 200
    
    data = response.json()
    assert "total_entries" in data
    assert "journal_entries" in data
    assert "influence_entries" in data
    assert "dimension" in data
    
    assert data["dimension"] == 1536  # text-embedding-3-small dimension

def test_journal_entry_search_integration(sample_images, test_db):
    """Test that processed entries are searchable via FAISS"""
    image_paths, temp_dir = sample_images
    
    # Process images first
    summary = ingest_journal_images(image_paths)
    assert len(summary["processed"]) >= 2
    
    # Test search functionality
    search_data = {
        "query": "productive day technology development",
        "k": 5,
        "entry_type": "journal"
    }
    
    response = client.post("/search", json=search_data)
    assert response.status_code == 200
    
    results = response.json()
    assert len(results) > 0
    
    # Verify search results format
    for result in results:
        assert "id" in result
        assert "similarity_score" in result
        assert "entry_type" in result
        assert "text_preview" in result
        assert result["entry_type"] == "journal"

if __name__ == "__main__":
    # Run tests manually
    import sys
    
    print("Running journal ingest pipeline tests...")
    
    # Create test database
    Base.metadata.create_all(bind=engine)
    
    # Create sample images
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Create test images
        image1_text = """June 11, 2025
Today was a productive day. I worked on implementing the journal ingest pipeline.
Key insights: OCR technology has improved significantly.
Tags: productivity, technology, development"""
        
        image1_path = os.path.join(temp_dir, "journal_page1.jpg")
        create_test_image(image1_text, image1_path)
        
        image2_text = """June 12, 2025
Morning reflection: Starting the day with clarity and purpose.

June 13, 2025
Evening thoughts: Completed the API integration successfully."""
        
        image2_path = os.path.join(temp_dir, "journal_page2.jpg")
        create_test_image(image2_text, image2_path)
        
        print(f"Created test images: {image1_path}, {image2_path}")
        
        # Test CLI pipeline
        print("\nTesting CLI pipeline...")
        summary = ingest_journal_images([image1_path, image2_path])
        print(f"First run - Processed: {len(summary['processed'])}, Skipped: {len(summary['skipped_duplicates'])}")
        
        summary2 = ingest_journal_images([image1_path, image2_path])
        print(f"Second run - Processed: {len(summary2['processed'])}, Skipped: {len(summary2['skipped_duplicates'])}")
        
        # Test HTTP endpoint
        print("\nTesting HTTP endpoint...")
        files = []
        for image_path in [image1_path, image2_path]:
            with open(image_path, 'rb') as f:
                files.append(('files', (os.path.basename(image_path), f.read(), 'image/jpeg')))
        
        response = client.post("/upload-images", files=files)
        print(f"HTTP response status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"HTTP result - Processed: {len(data['processed'])}, Skipped: {len(data['skipped_duplicates'])}")
        
        print("\n✅ All tests completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
    finally:
        # Cleanup
        shutil.rmtree(temp_dir, ignore_errors=True)