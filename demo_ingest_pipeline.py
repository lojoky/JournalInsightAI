#!/usr/bin/env python3
"""
Complete demonstration of the journal image ingest pipeline
Shows all features: OCR, date parsing, duplicate detection, FAISS indexing
"""
import os
import tempfile
import shutil
from PIL import Image, ImageDraw, ImageFont
import requests

# Create test images with realistic journal content
def create_journal_images():
    temp_dir = tempfile.mkdtemp()
    print(f"Creating test images in: {temp_dir}")
    
    # Image 1: Single date entry
    img1 = Image.new('RGB', (800, 600), color='white')
    draw1 = ImageDraw.Draw(img1)
    font = ImageFont.load_default()
    
    text1 = """June 11, 2025

Today I implemented the FastAPI journal system with vector embeddings.
The OCR pipeline can now process handwritten pages automatically.

Key insights:
- OpenAI Vision API provides excellent text recognition
- FAISS enables semantic similarity search across entries
- Duplicate detection prevents reprocessing the same content

Tags: AI, development, machine learning, productivity"""
    
    lines1 = text1.split('\n')
    y = 50
    for line in lines1:
        draw1.text((50, y), line, fill='black', font=font)
        y += 30
    
    img1_path = os.path.join(temp_dir, "journal_page1.jpg")
    img1.save(img1_path, 'JPEG')
    
    # Image 2: Multi-date entry
    img2 = Image.new('RGB', (800, 600), color='white')
    draw2 = ImageDraw.Draw(img2)
    
    text2 = """June 12, 2025
Morning thoughts: The system is coming together nicely.
Vector search allows finding related entries across dates.

June 13, 2025
Evening reflection: Successfully tested the complete pipeline.
Both CLI and HTTP endpoints work as expected.
Duplicate detection handles image and text hashes properly."""
    
    lines2 = text2.split('\n')
    y = 50
    for line in lines2:
        draw2.text((50, y), line, fill='black', font=font)
        y += 30
    
    img2_path = os.path.join(temp_dir, "journal_page2.jpg")
    img2.save(img2_path, 'JPEG')
    
    return [img1_path, img2_path], temp_dir

def test_cli_pipeline():
    """Test the CLI ingest pipeline"""
    print("\n" + "="*60)
    print("TESTING CLI PIPELINE")
    print("="*60)
    
    from ingest_journal_images import ingest_journal_images
    
    image_paths, temp_dir = create_journal_images()
    
    try:
        # First run - should process both images
        print("First ingest run (should process images):")
        summary1 = ingest_journal_images(image_paths)
        
        print(f"✓ Processed entries: {len(summary1['processed'])}")
        print(f"✓ Skipped duplicates: {len(summary1['skipped_duplicates'])}")
        print(f"✓ Errors: {len(summary1['errors'])}")
        
        for entry in summary1['processed']:
            print(f"  - Entry {entry['entry_id']}: {entry['date']} ({len(entry.get('tags', []))} tags)")
        
        # Second run - should detect duplicates
        print("\nSecond ingest run (should detect duplicates):")
        summary2 = ingest_journal_images(image_paths)
        
        print(f"✓ Processed entries: {len(summary2['processed'])}")
        print(f"✓ Skipped duplicates: {len(summary2['skipped_duplicates'])}")
        print(f"✓ Errors: {len(summary2['errors'])}")
        
        if summary2['skipped_duplicates']:
            print(f"  Duplicates detected: {', '.join(summary2['skipped_duplicates'])}")
        
        return True
        
    except Exception as e:
        print(f"❌ CLI test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def test_http_endpoint():
    """Test the HTTP upload endpoint"""
    print("\n" + "="*60)
    print("TESTING HTTP ENDPOINT")
    print("="*60)
    
    image_paths, temp_dir = create_journal_images()
    
    try:
        # Prepare multipart form data
        files = []
        for image_path in image_paths:
            with open(image_path, 'rb') as f:
                files.append(('files', (os.path.basename(image_path), f.read(), 'image/jpeg')))
        
        # Test upload endpoint
        print("Uploading images via HTTP...")
        response = requests.post('http://localhost:3000/upload-images', files=files)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ HTTP Status: {response.status_code}")
            print(f"✓ Processed entries: {len(data.get('processed', []))}")
            print(f"✓ Skipped duplicates: {len(data.get('skipped_duplicates', []))}")
            print(f"✓ Errors: {len(data.get('errors', []))}")
            
            for entry in data.get('processed', []):
                print(f"  - Entry {entry['entry_id']}: {entry.get('date', 'No date')}")
            
            return True
        else:
            print(f"❌ HTTP request failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ HTTP test failed: {e}")
        return False
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def test_search_functionality():
    """Test FAISS search functionality"""
    print("\n" + "="*60)
    print("TESTING SEARCH FUNCTIONALITY")
    print("="*60)
    
    try:
        # Test search endpoint
        search_data = {
            "query": "AI development machine learning pipeline",
            "k": 5,
            "entry_type": "journal"
        }
        
        response = requests.post('http://localhost:3000/search', json=search_data)
        
        if response.status_code == 200:
            results = response.json()
            print(f"✓ Search found {len(results)} results")
            
            for i, result in enumerate(results[:3], 1):
                print(f"  {i}. Entry ID {result['id']} (similarity: {result['similarity_score']:.3f})")
                print(f"     Preview: {result['text_preview'][:100]}...")
            
            # Test search stats
            stats_response = requests.get('http://localhost:3000/search/stats')
            if stats_response.status_code == 200:
                stats = stats_response.json()
                print(f"✓ FAISS Index Stats:")
                print(f"  - Total entries: {stats.get('total_entries', 0)}")
                print(f"  - Journal entries: {stats.get('journal_entries', 0)}")
                print(f"  - Vector dimension: {stats.get('dimension', 0)}")
            
            return True
        else:
            print(f"❌ Search request failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Search test failed: {e}")
        return False

def main():
    """Run complete demonstration"""
    print("JOURNAL IMAGE INGEST PIPELINE DEMONSTRATION")
    print("="*80)
    print("Features:")
    print("✓ OCR with OpenAI Vision API (fallback to Tesseract)")
    print("✓ Date parsing and multi-date splitting")
    print("✓ Duplicate detection (image hash + text hash)")
    print("✓ AI-powered tag and insight extraction")
    print("✓ FAISS vector similarity search")
    print("✓ CLI and HTTP interfaces")
    print("="*80)
    
    # Ensure database is set up
    from db import Base, engine
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables initialized")
    
    # Run tests
    tests_passed = 0
    total_tests = 3
    
    if test_cli_pipeline():
        tests_passed += 1
    
    if test_http_endpoint():
        tests_passed += 1
    
    if test_search_functionality():
        tests_passed += 1
    
    # Final summary
    print("\n" + "="*80)
    print("DEMONSTRATION COMPLETE")
    print("="*80)
    print(f"Tests passed: {tests_passed}/{total_tests}")
    
    if tests_passed == total_tests:
        print("🎉 ALL FEATURES WORKING CORRECTLY!")
        print("\nThe journal image ingest pipeline is ready for production use.")
        print("\nTo use:")
        print("• CLI: python ingest_journal_images.py image1.jpg image2.jpg")
        print("• HTTP: POST /upload-images with multipart form data")
        print("• Search: POST /search with query parameters")
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
    
    return tests_passed == total_tests

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)