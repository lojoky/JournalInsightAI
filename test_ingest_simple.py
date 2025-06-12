#!/usr/bin/env python3
"""
Simple test for journal image ingest pipeline
"""
import os
import tempfile
import shutil
from PIL import Image, ImageDraw, ImageFont

from db import Base, engine
from ingest_journal_images import ingest_journal_images

def create_test_image(text: str, filename: str) -> str:
    """Create a test image with text"""
    # Create a white image
    img = Image.new('RGB', (800, 600), color='white')
    draw = ImageDraw.Draw(img)
    
    # Use default font
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

def main():
    print("Testing Journal Image Ingest Pipeline")
    print("=" * 50)
    
    # Create test database
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created")
    
    # Create temporary directory
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
        
        print(f"✓ Created test images in {temp_dir}")
        
        # Test first run - should process images
        print("\nTesting first ingest run...")
        summary1 = ingest_journal_images([image1_path, image2_path])
        
        print(f"✓ Processed entries: {len(summary1['processed'])}")
        print(f"✓ Skipped duplicates: {len(summary1['skipped_duplicates'])}")
        print(f"✓ Errors: {len(summary1['errors'])}")
        
        if summary1['errors']:
            print("Errors encountered:")
            for error in summary1['errors']:
                print(f"  - {error}")
        
        # Test second run - should detect duplicates
        print("\nTesting duplicate detection...")
        summary2 = ingest_journal_images([image1_path, image2_path])
        
        print(f"✓ Processed entries: {len(summary2['processed'])}")
        print(f"✓ Skipped duplicates: {len(summary2['skipped_duplicates'])}")
        print(f"✓ Errors: {len(summary2['errors'])}")
        
        # Verify results
        assert len(summary1['processed']) >= 2, "Should process at least 2 entries"
        assert len(summary2['skipped_duplicates']) >= 1, "Should detect duplicates"
        
        print("\n" + "=" * 50)
        print("✅ All tests passed successfully!")
        print("✅ Journal image ingest pipeline is working correctly")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        # Cleanup
        shutil.rmtree(temp_dir, ignore_errors=True)
        print(f"✓ Cleaned up temporary files")
    
    return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)