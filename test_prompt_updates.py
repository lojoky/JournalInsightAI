#!/usr/bin/env python3
"""
Test script to verify second-person tone and thoughtful questions in prompt configurations
"""

import json
import asyncio
from pathlib import Path
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.abspath('.'))

from ingest_journal_images import analyze_journal_block

def load_prompt_config(config_path: str) -> dict:
    """Load prompt configuration from JSON file"""
    with open(config_path, 'r') as f:
        return json.load(f)

async def test_prompt_configuration(config_path: str, config_name: str):
    """Test a specific prompt configuration"""
    print(f"\n=== Testing {config_name} ===")
    
    # Load the configuration
    try:
        prompt_config = load_prompt_config(config_path)
        print(f"✓ Loaded {config_name} configuration")
    except Exception as e:
        print(f"✗ Failed to load {config_name}: {e}")
        return
    
    # Test with sample journal text
    sample_text = """
    Today was challenging but rewarding. I struggled with time management again - spent too much time on emails and not enough on the important project. However, I did manage to complete my morning meditation practice and felt more centered throughout the day. I'm noticing a pattern where I feel more creative and focused when I start with mindfulness. Need to protect this time better and maybe set boundaries around checking messages.
    """
    
    try:
        # Test the analysis
        result = analyze_journal_block(sample_text, prompt_config)
        
        print(f"✓ Analysis completed successfully")
        
        # Verify structure
        if 'themes' in result and 'thoughtful_questions' in result:
            print(f"✓ Correct JSON structure (themes + thoughtful_questions)")
            
            # Check themes for second-person tone
            themes = result.get('themes', [])
            for i, theme in enumerate(themes):
                observation = theme.get('observation', '')
                if observation.startswith('You'):
                    print(f"✓ Theme {i+1}: Second-person tone detected")
                else:
                    print(f"✗ Theme {i+1}: Missing second-person tone: '{observation[:30]}...'")
            
            # Check thoughtful questions
            questions = result.get('thoughtful_questions', [])
            print(f"✓ Generated {len(questions)} thoughtful questions")
            for i, question in enumerate(questions):
                print(f"  {i+1}. {question}")
            
            # Check for confidence scores (should be absent)
            if 'confidence' not in str(result).lower():
                print(f"✓ No confidence scores found")
            else:
                print(f"✗ Confidence scores detected (should be removed)")
                
        else:
            print(f"✗ Incorrect JSON structure: {list(result.keys())}")
            
    except Exception as e:
        print(f"✗ Analysis failed: {e}")

async def main():
    """Test all prompt configurations"""
    print("Testing updated prompt configurations for second-person tone and thoughtful questions")
    print("=" * 80)
    
    # Test default configuration
    await test_prompt_configuration("prompt_config.json", "Default")
    
    # Test preset configurations
    presets = [
        ("prompt_library/therapist.json", "Therapist"),
        ("prompt_library/coach.json", "Coach"), 
        ("prompt_library/stoic.json", "Stoic"),
        ("prompt_library/productivity.json", "Productivity")
    ]
    
    for config_path, config_name in presets:
        if Path(config_path).exists():
            await test_prompt_configuration(config_path, config_name)
        else:
            print(f"\n=== {config_name} ===")
            print(f"✗ Configuration file not found: {config_path}")
    
    print("\n" + "=" * 80)
    print("Testing complete!")

if __name__ == "__main__":
    asyncio.run(main())