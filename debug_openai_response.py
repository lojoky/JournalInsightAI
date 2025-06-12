#!/usr/bin/env python3
"""
Debug script to see exactly what OpenAI is returning
"""

import json
import os
from openai import OpenAI

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def test_openai_with_new_prompt():
    """Test OpenAI with the new prompt format"""
    
    # Load the updated default prompt config
    try:
        with open("prompt_config.json", 'r') as f:
            prompt_config = json.load(f)
        print(f"Loaded config keys: {list(prompt_config.keys())}")
    except Exception as e:
        print(f"Error loading config: {e}")
        return
    
    sample_text = """
    Today was challenging but rewarding. I struggled with time management again - spent too much time on emails and not enough on the important project. However, I did manage to complete my morning meditation practice and felt more centered throughout the day.
    """
    
    # Format the user prompt
    user_prompt = prompt_config["user_prompt_template"].format(transcript=sample_text)
    
    print("=== SYSTEM PROMPT ===")
    print(prompt_config["system_prompt"])
    print("\n=== USER PROMPT ===")
    print(user_prompt)
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": prompt_config["system_prompt"]
                },
                {
                    "role": "user", 
                    "content": user_prompt
                }
            ],
            response_format={"type": "json_object"},
            max_tokens=500
        )
        
        content = response.choices[0].message.content
        print("\n=== RAW OPENAI RESPONSE ===")
        print(repr(content))
        print("\n=== FORMATTED RESPONSE ===")
        print(content)
        
        # Try to parse as JSON
        try:
            parsed = json.loads(content)
            print("\n=== PARSED JSON ===")
            print(json.dumps(parsed, indent=2))
            
            print("\n=== STRUCTURE ANALYSIS ===")
            print(f"Keys: {list(parsed.keys())}")
            
            if "themes" in parsed:
                print(f"✓ Has themes: {len(parsed['themes'])} items")
                for i, theme in enumerate(parsed['themes']):
                    print(f"  Theme {i+1}: {theme}")
            else:
                print("✗ Missing 'themes' key")
                
            if "thoughtful_questions" in parsed:
                print(f"✓ Has thoughtful_questions: {len(parsed['thoughtful_questions'])} items")
                for i, q in enumerate(parsed['thoughtful_questions']):
                    print(f"  Q{i+1}: {q}")
            else:
                print("✗ Missing 'thoughtful_questions' key")
                
        except json.JSONDecodeError as e:
            print(f"\n✗ JSON PARSE ERROR: {e}")
            
    except Exception as e:
        print(f"\n✗ OPENAI API ERROR: {e}")

if __name__ == "__main__":
    test_openai_with_new_prompt()