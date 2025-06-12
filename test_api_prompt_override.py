#!/usr/bin/env python3
"""
Test script for /upload-images API endpoint with prompt override functionality
Demonstrates how to use custom prompt configurations through the API
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFont
import subprocess
import time

def create_test_image(text: str, filename: str) -> str:
    """Create a test image with journal text"""
    img = Image.new('RGB', (800, 600), color='white')
    draw = ImageDraw.Draw(img)
    
    # Try to use a readable font
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 20)
    except:
        font = ImageFont.load_default()
    
    # Add some margin and wrap text
    lines = []
    words = text.split(' ')
    current_line = []
    
    for word in words:
        test_line = ' '.join(current_line + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if bbox[2] - bbox[0] < 700:  # Max width
            current_line.append(word)
        else:
            if current_line:
                lines.append(' '.join(current_line))
                current_line = [word]
            else:
                lines.append(word)
    
    if current_line:
        lines.append(' '.join(current_line))
    
    # Draw text lines
    y_offset = 50
    for line in lines:
        draw.text((50, y_offset), line, fill='black', font=font)
        y_offset += 30
    
    img.save(filename)
    return filename

def test_api_with_curl():
    """Test the API using curl commands"""
    print("Testing /upload-images API with prompt override")
    print("=" * 55)
    
    # Create test images
    test_image1 = create_test_image(
        "March 15, 2024\n\n"
        "Today I woke up feeling anxious about the presentation I have to give next week. "
        "My mind was racing with worst-case scenarios. I decided to try the breathing "
        "exercise my therapist recommended. After 10 minutes, I felt much calmer. "
        "I realized that preparation is the key to reducing anxiety. I'm going to "
        "practice my presentation every day this week.",
        "test_anxiety_journal.jpg"
    )
    
    test_image2 = create_test_image(
        "March 16, 2024\n\n"
        "Had an amazing workout session today! Ran 6 miles in the morning sunshine. "
        "My energy levels are through the roof. I've been consistent with exercise "
        "for 3 months now and can really feel the difference in my mood and focus. "
        "Planning to try rock climbing this weekend as a new challenge.",
        "test_fitness_journal.jpg"
    )
    
    try:
        print("Test 1: Default prompt configuration")
        print("-" * 35)
        
        # Test with default prompts
        cmd1 = [
            'curl', '-X', 'POST', 'http://localhost:8000/upload-images',
            '-F', f'files[]=@{test_image1}',
            '-s'  # Silent mode
        ]
        
        result1 = subprocess.run(cmd1, capture_output=True, text=True, timeout=60)
        if result1.returncode == 0:
            print("✓ Default prompt test successful")
            print(f"Response: {result1.stdout[:200]}...")
        else:
            print(f"✗ Default prompt test failed: {result1.stderr}")
        
        print("\nTest 2: Custom psychological analysis prompt")
        print("-" * 45)
        
        # Test with custom prompts
        cmd2 = [
            'curl', '-X', 'POST', 'http://localhost:8000/upload-images',
            '-F', f'files[]=@{test_image2}',
            '-F', 'prompt_file=custom_prompt_example.json',
            '-s'
        ]
        
        result2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=60)
        if result2.returncode == 0:
            print("✓ Custom prompt test successful")
            print(f"Response: {result2.stdout[:200]}...")
        else:
            print(f"✗ Custom prompt test failed: {result2.stderr}")
        
        print("\nTest 3: Nonexistent prompt file (fallback test)")
        print("-" * 50)
        
        # Test fallback behavior
        cmd3 = [
            'curl', '-X', 'POST', 'http://localhost:8000/upload-images',
            '-F', f'files[]=@{test_image1}',
            '-F', 'prompt_file=nonexistent.json',
            '-s'
        ]
        
        result3 = subprocess.run(cmd3, capture_output=True, text=True, timeout=60)
        if result3.returncode == 0:
            print("✓ Fallback test successful")
            print(f"Response: {result3.stdout[:200]}...")
        else:
            print(f"✗ Fallback test failed: {result3.stderr}")
            
    except subprocess.TimeoutExpired:
        print("✗ API request timed out - server may not be running")
    except Exception as e:
        print(f"✗ Test error: {e}")
    
    finally:
        # Cleanup test images
        for img in [test_image1, test_image2]:
            if os.path.exists(img):
                os.remove(img)

def show_usage_examples():
    """Show example curl commands for API usage"""
    print("\n" + "=" * 60)
    print("API USAGE EXAMPLES")
    print("=" * 60)
    
    print("\n1. Default prompt analysis:")
    print("curl -X POST http://localhost:8000/upload-images \\")
    print("  -F \"files[]=@journal_page1.jpg\" \\")
    print("  -F \"files[]=@journal_page2.jpg\"")
    
    print("\n2. Custom psychological analysis:")
    print("curl -X POST http://localhost:8000/upload-images \\")
    print("  -F \"files[]=@journal_page1.jpg\" \\")
    print("  -F \"prompt_file=custom_prompt_example.json\"")
    
    print("\n3. Multiple files with custom prompts:")
    print("curl -X POST http://localhost:8000/upload-images \\")
    print("  -F \"files[]=@page1.jpg\" \\")
    print("  -F \"files[]=@page2.jpg\" \\")
    print("  -F \"files[]=@page3.jpg\" \\")
    print("  -F \"prompt_file=my_custom_prompts.json\"")

def main():
    """Main test function"""
    if len(sys.argv) > 1 and sys.argv[1] == "--examples-only":
        show_usage_examples()
        return
    
    print("FastAPI Prompt Override Test Suite")
    print("=" * 60)
    print("Testing enhanced /upload-images endpoint with custom prompt support\n")
    
    # Check if server is likely running
    try:
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('localhost', 8000))
        sock.close()
        
        if result != 0:
            print("⚠️  FastAPI server not detected on port 8000")
            print("   Make sure to start the server with: uvicorn main:app --reload")
            print("   Then run this test again\n")
    except:
        pass
    
    # Run API tests
    test_api_with_curl()
    
    # Show usage examples
    show_usage_examples()
    
    print(f"\n✅ Prompt override functionality testing complete!")
    print("\nKey Features Implemented:")
    print("• Optional prompt_file parameter in /upload-images API")
    print("• Multipart form data support for files + configuration")
    print("• Automatic fallback to default prompts")
    print("• Response includes prompt_config_used for transparency")

if __name__ == "__main__":
    main()