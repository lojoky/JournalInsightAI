#!/usr/bin/env python3
"""
Simple verification script for FastAPI project setup
"""
import sys
import importlib.util

def check_imports():
    """Check if all required packages can be imported"""
    required_packages = [
        'fastapi',
        'uvicorn', 
        'openai',
        'aiofiles',
        'PIL',  # Pillow
        'imagehash',
        'dateparser',
        'pydantic',
        'sqlalchemy',
        'faiss',
        'dotenv'
    ]
    
    print("Checking package imports...")
    missing_packages = []
    
    for package in required_packages:
        try:
            if package == 'PIL':
                import PIL
            elif package == 'dotenv':
                import dotenv
            else:
                __import__(package)
            print(f"✓ {package}")
        except ImportError:
            print(f"✗ {package}")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\nMissing packages: {', '.join(missing_packages)}")
        return False
    else:
        print("\nAll packages imported successfully!")
        return True

def check_files():
    """Check if all required files exist"""
    import os
    
    required_files = [
        'main.py',
        'db.py', 
        '.env',
        'README.md'
    ]
    
    print("\nChecking project files...")
    missing_files = []
    
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✓ {file_path}")
        else:
            print(f"✗ {file_path}")
            missing_files.append(file_path)
    
    if missing_files:
        print(f"\nMissing files: {', '.join(missing_files)}")
        return False
    else:
        print("\nAll project files exist!")
        return True

def check_database_connection():
    """Test database connection"""
    try:
        from db import engine
        with engine.connect() as conn:
            print("✓ Database connection successful")
        return True
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return False

if __name__ == "__main__":
    print("FastAPI Project Setup Verification")
    print("=" * 40)
    
    checks_passed = 0
    total_checks = 3
    
    if check_imports():
        checks_passed += 1
    
    if check_files():
        checks_passed += 1
        
    print("\nChecking database connection...")
    if check_database_connection():
        checks_passed += 1
    
    print(f"\nVerification Results: {checks_passed}/{total_checks} checks passed")
    
    if checks_passed == total_checks:
        print("\n🎉 FastAPI project setup is complete and ready to use!")
        print("\nTo start the server, run:")
        print("uvicorn main:app --host 0.0.0.0 --port 3000 --reload")
    else:
        print("\n⚠️  Some issues were found. Please check the output above.")
        
    sys.exit(0 if checks_passed == total_checks else 1)