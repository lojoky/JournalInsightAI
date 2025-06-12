#!/usr/bin/env python3
"""
Test script for preset query parameter functionality in /upload-images API
Demonstrates specialized analysis approaches through preset configurations
"""

import os
import sys
import subprocess
import json
from PIL import Image, ImageDraw, ImageFont

def create_test_journal_image(text: str, filename: str) -> str:
    """Create a realistic journal page image with text"""
    img = Image.new('RGB', (800, 600), color='white')
    draw = ImageDraw.Draw(img)
    
    # Try to use a readable font
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
        title_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
    except:
        font = ImageFont.load_default()
        title_font = ImageFont.load_default()
    
    # Add date header
    draw.text((50, 30), "Journal Entry - March 20, 2024", fill='black', font=title_font)
    
    # Process text into lines
    lines = []
    words = text.split(' ')
    current_line = []
    
    for word in words:
        test_line = ' '.join(current_line + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if bbox[2] - bbox[0] < 700:
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
    y_offset = 80
    for line in lines:
        draw.text((50, y_offset), line, fill='black', font=font)
        y_offset += 25
    
    img.save(filename)
    return filename

def test_preset_with_curl(preset: str, image_path: str, description: str):
    """Test a specific preset using curl"""
    print(f"\nTesting preset: {preset}")
    print(f"Analysis focus: {description}")
    print("-" * 40)
    
    cmd = [
        'curl', '-X', 'POST', f'http://localhost:8000/upload-images?preset={preset}',
        '-F', f'files[]=@{image_path}',
        '-s'
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            try:
                response = json.loads(result.stdout)
                print(f"✓ Preset '{preset}' test successful")
                print(f"  Prompt used: {response.get('prompt_config_used', 'N/A')}")
                print(f"  Processed entries: {len(response.get('processed', []))}")
                print(f"  Errors: {len(response.get('errors', []))}")
                return True
            except json.JSONDecodeError:
                print(f"✗ Invalid JSON response: {result.stdout[:100]}...")
                return False
        else:
            print(f"✗ HTTP error: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        print(f"✗ Request timeout for preset '{preset}'")
        return False
    except Exception as e:
        print(f"✗ Error testing preset '{preset}': {e}")
        return False

def test_error_handling():
    """Test error handling for nonexistent presets"""
    print("\nTesting error handling for invalid preset")
    print("-" * 45)
    
    # Create a simple test image
    test_image = create_test_journal_image("Test error handling", "test_error.jpg")
    
    cmd = [
        'curl', '-X', 'POST', 'http://localhost:8000/upload-images?preset=nonexistent',
        '-F', f'files[]=@{test_image}',
        '-s'
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            response = json.loads(result.stdout)
            if "not found" in response.get("detail", "").lower():
                print("✓ Error handling working correctly")
                print(f"  Error message: {response.get('detail', 'N/A')}")
                return True
        print("✗ Error handling not working as expected")
        return False
    except Exception as e:
        print(f"✗ Error testing error handling: {e}")
        return False
    finally:
        if os.path.exists(test_image):
            os.remove(test_image)

def test_priority_order():
    """Test priority order: preset > prompt_file > default"""
    print("\nTesting priority order")
    print("-" * 25)
    
    test_image = create_test_journal_image("Testing priority order", "test_priority.jpg")
    
    # Test preset takes priority over prompt_file
    cmd = [
        'curl', '-X', 'POST', 'http://localhost:8000/upload-images?preset=therapist',
        '-F', f'files[]=@{test_image}',
        '-F', 'prompt_file=custom_prompt_example.json',
        '-s'
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            response = json.loads(result.stdout)
            prompt_used = response.get('prompt_config_used', '')
            if 'preset:therapist' in prompt_used:
                print("✓ Priority order working correctly")
                print(f"  Preset took priority: {prompt_used}")
                return True
        print("✗ Priority order not working correctly")
        return False
    except Exception as e:
        print(f"✗ Error testing priority order: {e}")
        return False
    finally:
        if os.path.exists(test_image):
            os.remove(test_image)

def main():
    """Main test function"""
    print("Preset Query Parameter Test Suite")
    print("=" * 60)
    print("Testing enhanced /upload-images endpoint with preset support\n")
    
    # Test different journal scenarios with appropriate presets
    test_scenarios = [
        {
            "preset": "therapist",
            "description": "Therapeutic analysis focusing on mental health patterns",
            "text": "Today I woke up feeling anxious about my presentation tomorrow. My heart was racing and I couldn't focus. I tried the breathing exercise my therapist recommended - inhaling for 4 counts, holding for 4, exhaling for 6. After 10 minutes, I felt much calmer. I realized that my anxiety often stems from catastrophic thinking. I'm learning to recognize these patterns and use coping strategies."
        },
        {
            "preset": "coach",
            "description": "Performance coaching focusing on goals and achievements",
            "text": "Completed my 5K run this morning in 24:30 - a new personal best! I've been following my training plan consistently for 8 weeks now. The key has been gradually increasing distance while maintaining good form. Next goal is to break 24 minutes. I'm also seeing improvements in my energy levels throughout the day. Consistency is definitely paying off."
        },
        {
            "preset": "stoic",
            "description": "Philosophical analysis focusing on wisdom and virtue",
            "text": "Had a difficult conversation with my colleague today about project responsibilities. Initially felt frustrated and wanted to react defensively. Instead, I paused and remembered Marcus Aurelius' teaching about controlling only what is within our power. I focused on expressing my perspective clearly and listening to understand rather than to be right. The conversation became more productive when I approached it with this mindset."
        },
        {
            "preset": "productivity",
            "description": "Efficiency analysis focusing on time management and systems",
            "text": "Implemented the Pomodoro technique today for deep work sessions. Completed 6 focused 25-minute blocks with 5-minute breaks. Accomplished more in 3 hours than I usually do in a full day. Key insight: removing phone from workspace eliminates most distractions. Planning to use this method for all analytical tasks going forward. Time-blocking in calendar also helped maintain structure."
        }
    ]
    
    # Check server availability
    try:
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('localhost', 8000))
        sock.close()
        
        if result != 0:
            print("⚠️  FastAPI server not detected on port 8000")
            print("   Start server with: uvicorn main:app --reload")
            print("   Then run this test again\n")
            return
    except:
        pass
    
    success_count = 0
    total_tests = len(test_scenarios) + 2  # scenarios + error handling + priority test
    
    # Test each preset scenario
    for scenario in test_scenarios:
        image_path = create_test_journal_image(scenario["text"], f"test_{scenario['preset']}.jpg")
        try:
            if test_preset_with_curl(scenario["preset"], image_path, scenario["description"]):
                success_count += 1
        finally:
            if os.path.exists(image_path):
                os.remove(image_path)
    
    # Test error handling
    if test_error_handling():
        success_count += 1
    
    # Test priority order
    if test_priority_order():
        success_count += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST RESULTS")
    print("=" * 60)
    print(f"Successful tests: {success_count}/{total_tests}")
    
    if success_count == total_tests:
        print("✅ All preset functionality tests passed!")
    else:
        print(f"⚠️  {total_tests - success_count} tests failed")
    
    print("\nPreset Usage Examples:")
    print("# Therapeutic analysis")
    print('curl -X POST "http://localhost:8000/upload-images?preset=therapist" -F "files[]=@journal.jpg"')
    
    print("\n# Life coaching analysis")
    print('curl -X POST "http://localhost:8000/upload-images?preset=coach" -F "files[]=@journal.jpg"')
    
    print("\n# Stoic philosophy analysis")
    print('curl -X POST "http://localhost:8000/upload-images?preset=stoic" -F "files[]=@journal.jpg"')
    
    print("\n# Productivity analysis")
    print('curl -X POST "http://localhost:8000/upload-images?preset=productivity" -F "files[]=@journal.jpg"')

if __name__ == "__main__":
    main()