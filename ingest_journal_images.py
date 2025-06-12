#!/usr/bin/env python3
"""
Journal image ingest pipeline
Processes handwritten journal page images into structured JournalEntry rows with FAISS indexing
"""
import sys
import os
import hashlib
import json
import argparse
from typing import List, Dict, Tuple, Optional
from datetime import datetime
import imagehash
from PIL import Image
import dateparser
import openai
import pytesseract
from sqlalchemy.orm import Session

from db import get_db, JournalEntry
from embedding import embed, embedding_to_base64
from simple_faiss import faiss_index

# Initialize OpenAI client
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def load_prompt_config(config_path: str = "prompt_config.json") -> Dict[str, str]:
    """Load prompt configuration from JSON file"""
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # Validate required keys
        required_keys = ["system_prompt", "user_prompt_template"]
        for key in required_keys:
            if key not in config:
                raise ValueError(f"Missing required key '{key}' in prompt config")
        
        return config
    except FileNotFoundError:
        print(f"Warning: Prompt config file '{config_path}' not found. Using default prompts.")
        return {
            "system_prompt": "You are a JSON generator. Analyze journal text and return structured data. Keep tags concise (≤5) and insights brief (≤3 sentences each).",
            "user_prompt_template": "Transcript: {transcript}\n\nReturn {{ \"tags\": [...≤5], \"core_insights\": [...≤3 sentences] }}"
        }
    except Exception as e:
        print(f"Error loading prompt config '{config_path}': {e}")
        return {
            "system_prompt": "You are a JSON generator. Analyze journal text and return structured data. Keep tags concise (≤5) and insights brief (≤3 sentences each).",
            "user_prompt_template": "Transcript: {transcript}\n\nReturn {{ \"tags\": [...≤5], \"core_insights\": [...≤3 sentences] }}"
        }

def compute_image_hash(image_path: str) -> str:
    """Compute perceptual hash of image using imagehash.phash"""
    try:
        with Image.open(image_path) as img:
            phash = imagehash.phash(img)
            return str(phash)
    except Exception as e:
        print(f"Error computing image hash for {image_path}: {e}")
        raise

def compute_text_hash(text: str) -> str:
    """Compute SHA256 hash of normalized text"""
    normalized_text = text.strip().lower().replace('\n', ' ').replace('\r', '')
    return hashlib.sha256(normalized_text.encode('utf-8')).hexdigest()

def ocr_with_openai(image_path: str) -> Tuple[str, float]:
    """Extract text from image using OpenAI Vision API"""
    try:
        with open(image_path, 'rb') as image_file:
            import base64
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an OCR system. Extract all text from the image exactly as written, preserving line breaks and formatting. Return only the extracted text."
                },
                {
                    "role": "user", 
                    "content": [
                        {
                            "type": "text",
                            "text": "Please extract all text from this handwritten journal page:"
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=1000,
            timeout=30
        )
        
        text = response.choices[0].message.content
        if text:
            text = text.strip()
        else:
            text = ""
        confidence = 0.9  # OpenAI Vision typically has high confidence
        return text, confidence
        
    except Exception as e:
        print(f"OpenAI Vision OCR failed for {image_path}: {e}")
        # Fallback to pytesseract
        return ocr_with_tesseract(image_path)

def ocr_with_tesseract(image_path: str) -> Tuple[str, float]:
    """Fallback OCR using pytesseract"""
    try:
        with Image.open(image_path) as img:
            # Convert to RGB if needed
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Extract text
            text = pytesseract.image_to_string(img, config='--psm 6')
            
            # Get confidence data
            data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
            confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            
            return text.strip(), avg_confidence / 100.0
            
    except Exception as e:
        print(f"Tesseract OCR failed for {image_path}: {e}")
        return "", 0.0

def extract_dates_and_split(text: str) -> List[Tuple[Optional[datetime], str]]:
    """Extract dates from text and split into date-based blocks"""
    try:
        # Find all dates in the text using dateparser.search.search_dates
        import dateparser.search
        found_dates = dateparser.search.search_dates(text, languages=["en"])
        
        if not found_dates or len(found_dates) <= 1:
            # Single or no date found, return entire text
            date = found_dates[0][1] if found_dates else None
            return [(date, text)]
        
        # Multiple dates found - split text
        date_positions = []
        for date_str, date_obj in found_dates:
            pos = text.find(date_str)
            if pos != -1:
                date_positions.append((pos, date_obj, date_str))
        
        # Sort by position in text
        date_positions.sort(key=lambda x: x[0])
        
        # Split text into blocks
        blocks = []
        for i, (pos, date_obj, date_str) in enumerate(date_positions):
            start_pos = pos
            end_pos = date_positions[i + 1][0] if i + 1 < len(date_positions) else len(text)
            
            block_text = text[start_pos:end_pos].strip()
            if block_text:
                blocks.append((date_obj, block_text))
        
        return blocks if blocks else [(None, text)]
        
    except Exception as e:
        print(f"Error extracting dates: {e}")
        return [(None, text)]

def analyze_journal_block(text: str, prompt_config: Dict[str, str]) -> Dict:
    """Analyze journal text block to extract tags and insights using OpenAI"""
    try:
        # Format the user prompt with the transcript
        user_prompt = prompt_config["user_prompt_template"].format(transcript=text)
        
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
        if content:
            result = json.loads(content)
        else:
            result = {"tags": [], "core_insights": []}
        
        # Validate and clean results
        tags = result.get("tags", [])[:5]  # Limit to 5 tags
        insights = result.get("core_insights", [])[:3]  # Limit to 3 insights
        
        return {
            "tags": [str(tag) for tag in tags],
            "core_insights": [str(insight) for insight in insights]
        }
        
    except Exception as e:
        print(f"Error analyzing journal block: {e}")
        return {"tags": [], "core_insights": []}

def check_duplicate_image(image_hash: str, db: Session) -> Optional[JournalEntry]:
    """Check if image hash already exists in database"""
    return db.query(JournalEntry).filter(JournalEntry.image_hash == image_hash).first()

def check_duplicate_text(text_hash: str, db: Session) -> Optional[JournalEntry]:
    """Check if text hash already exists in database"""
    return db.query(JournalEntry).filter(JournalEntry.transcript_hash == text_hash).first()

def process_journal_image(image_path: str, db: Session, prompt_config: Dict[str, str]) -> Dict:
    """Process a single journal image through the complete pipeline"""
    print(f"Processing {image_path}...")
    
    # Step 1: Compute image hash and check for duplicates
    try:
        image_hash = compute_image_hash(image_path)
    except Exception as e:
        return {"error": f"Failed to compute image hash: {e}"}
    
    existing_image = check_duplicate_image(image_hash, db)
    if existing_image:
        print(f"  Skipping duplicate image (matches entry {existing_image.id})")
        return {"skipped": "duplicate_image", "existing_id": existing_image.id}
    
    # Step 2: OCR
    print("  Performing OCR...")
    raw_text, confidence = ocr_with_openai(image_path)
    
    if not raw_text.strip():
        return {"error": "No text extracted from image"}
    
    print(f"  Extracted text ({confidence:.2f} confidence): {raw_text[:100]}...")
    
    # Step 3: Date splitting
    print("  Analyzing dates and splitting text...")
    date_blocks = extract_dates_and_split(raw_text)
    print(f"  Found {len(date_blocks)} date-based blocks")
    
    processed_entries = []
    
    # Step 4: Process each block
    for i, (date_obj, block_text) in enumerate(date_blocks):
        print(f"  Processing block {i+1}/{len(date_blocks)}...")
        
        # Check for text duplicates
        text_hash = compute_text_hash(block_text)
        existing_text = check_duplicate_text(text_hash, db)
        if existing_text:
            print(f"    Skipping duplicate text (matches entry {existing_text.id})")
            continue
        
        # Analyze journal content
        analysis = analyze_journal_block(block_text, prompt_config)
        
        # Generate embedding
        embedding = embed(block_text)
        embedding_b64 = embedding_to_base64(embedding)
        
        # Create journal entry
        journal_entry = JournalEntry(
            date=date_obj,
            text=block_text,
            tags=analysis["tags"],
            core_insights=analysis["core_insights"],
            image_paths=[image_path],
            image_hash=image_hash if i == 0 else None,  # Only first block gets image hash
            transcript_hash=text_hash,
            embedding=embedding_b64
        )
        
        db.add(journal_entry)
        db.commit()
        db.refresh(journal_entry)
        
        # Add to FAISS index
        faiss_index.add_entry(block_text, journal_entry.id, "journal")
        
        processed_entries.append({
            "entry_id": journal_entry.id,
            "date": date_obj.strftime("%Y-%m-%d") if date_obj else None,
            "tags": analysis["tags"],
            "insights_count": len(analysis["core_insights"])
        })
        
        print(f"    Created entry {journal_entry.id}")
    
    return {"processed": processed_entries}

def ingest_journal_images(image_paths: List[str], prompt_config_path: str = "prompt_config.json") -> Dict:
    """Main pipeline function to process multiple journal images"""
    db = next(get_db())
    
    # Load prompt configuration
    prompt_config = load_prompt_config(prompt_config_path)
    print(f"Using prompt config: {prompt_config_path}")
    
    summary = {
        "processed": [],
        "skipped_duplicates": [],
        "errors": []
    }
    
    try:
        for image_path in image_paths:
            if not os.path.exists(image_path):
                summary["errors"].append(f"File not found: {image_path}")
                continue
            
            result = process_journal_image(image_path, db, prompt_config)
            
            if "error" in result:
                summary["errors"].append(f"{image_path}: {result['error']}")
            elif "skipped" in result:
                summary["skipped_duplicates"].append(os.path.basename(image_path))
            elif "processed" in result:
                summary["processed"].extend(result["processed"])
        
        return summary
        
    finally:
        db.close()

def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(description="Process journal images with OCR and AI analysis")
    parser.add_argument("images", nargs="+", help="Image files to process")
    parser.add_argument("--prompt", default="prompt_config.json", 
                       help="Custom prompt configuration file (default: prompt_config.json)")
    
    args = parser.parse_args()
    
    print(f"Starting journal image ingest pipeline for {len(args.images)} images...")
    
    summary = ingest_journal_images(args.images, args.prompt)
    
    # Print summary
    print("\n" + "="*50)
    print("INGEST SUMMARY")
    print("="*50)
    print(f"Processed: {len(summary['processed'])} entries")
    print(f"Skipped duplicates: {len(summary['skipped_duplicates'])}")
    print(f"Errors: {len(summary['errors'])}")
    
    if summary["processed"]:
        print("\nProcessed entries:")
        for entry in summary["processed"]:
            print(f"  - Entry {entry['entry_id']}: {entry['date']} ({len(entry['tags'])} tags)")
    
    if summary["skipped_duplicates"]:
        print(f"\nSkipped duplicates: {', '.join(summary['skipped_duplicates'])}")
    
    if summary["errors"]:
        print("\nErrors:")
        for error in summary["errors"]:
            print(f"  - {error}")

if __name__ == "__main__":
    main()