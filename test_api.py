#!/usr/bin/env python3
"""
Test script to verify FastAPI application with SQLAlchemy models, embeddings, and FAISS
"""
import asyncio
from sqlalchemy.orm import Session
from db import engine, Base, get_db, JournalEntry, Influence
from embedding import embed, embedding_to_base64, base64_to_embedding
from simple_faiss import faiss_index
import json

async def test_complete_system():
    """Test the complete system functionality"""
    print("Testing FastAPI Journal System")
    print("=" * 40)
    
    # Create database tables
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created")
    
    # Get database session
    db = next(get_db())
    
    try:
        # Test 1: Create a journal entry
        print("\n1. Testing Journal Entry Creation")
        journal_text = "Today I learned about vector embeddings and similarity search. It's fascinating how AI can understand semantic relationships between different pieces of text."
        
        # Generate embedding
        embedding = embed(journal_text)
        embedding_b64 = embedding_to_base64(embedding)
        print(f"   ✓ Generated embedding with shape: {embedding.shape}")
        
        # Create database entry
        journal_entry = JournalEntry(
            text=journal_text,
            tags=["learning", "AI", "embeddings"],
            core_insights=["Vector embeddings capture semantic meaning", "AI enables similarity search"],
            image_paths=[],
            embedding=embedding_b64
        )
        
        db.add(journal_entry)
        db.commit()
        db.refresh(journal_entry)
        print(f"   ✓ Created journal entry with ID: {journal_entry.id}")
        
        # Add to FAISS index
        faiss_index.add_entry(journal_text, journal_entry.id, "journal")
        print("   ✓ Added to FAISS index")
        
        # Test 2: Create an influence
        print("\n2. Testing Influence Creation")
        influence_text = "Machine learning algorithms are transforming how we process and understand natural language. Deep learning models can now capture complex semantic relationships."
        
        influence_embedding = embed(influence_text)
        influence_b64 = embedding_to_base64(influence_embedding)
        
        influence = Influence(
            type="article",
            source_url="https://example.com/ml-article",
            title="The Power of Machine Learning in NLP",
            text=influence_text,
            core_tags=["machine learning", "NLP", "deep learning"],
            core_insights=["ML transforms language processing", "Deep learning captures semantic relationships"],
            embedding=influence_b64
        )
        
        db.add(influence)
        db.commit()
        db.refresh(influence)
        print(f"   ✓ Created influence with ID: {influence.id}")
        
        # Add to FAISS index
        faiss_index.add_entry(influence_text, influence.id, "influence")
        print("   ✓ Added to FAISS index")
        
        # Test 3: Search functionality
        print("\n3. Testing FAISS Search")
        search_query = "AI and machine learning concepts"
        results = faiss_index.search(search_query, k=5)
        
        print(f"   Search query: '{search_query}'")
        print(f"   ✓ Found {len(results)} similar entries")
        
        for i, (entry_id, score, metadata) in enumerate(results, 1):
            print(f"   {i}. ID: {entry_id}, Type: {metadata['type']}, Score: {score:.3f}")
            print(f"      Preview: {metadata['text_preview'][:100]}...")
        
        # Test 4: Type-specific search
        print("\n4. Testing Type-Specific Search")
        journal_results = faiss_index.search(search_query, k=3, entry_type="journal")
        influence_results = faiss_index.search(search_query, k=3, entry_type="influence")
        
        print(f"   ✓ Journal entries found: {len(journal_results)}")
        print(f"   ✓ Influence entries found: {len(influence_results)}")
        
        # Test 5: Database retrieval
        print("\n5. Testing Database Retrieval")
        all_journals = db.query(JournalEntry).all()
        all_influences = db.query(Influence).all()
        
        print(f"   ✓ Total journal entries in DB: {len(all_journals)}")
        print(f"   ✓ Total influences in DB: {len(all_influences)}")
        
        # Test 6: Embedding restoration
        print("\n6. Testing Embedding Restoration")
        stored_embedding = base64_to_embedding(journal_entry.embedding)
        original_embedding = embed(journal_entry.text)
        
        # Check similarity
        similarity = embed.cosine_similarity if hasattr(embed, 'cosine_similarity') else lambda a, b: float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
        import numpy as np
        similarity_score = float(np.dot(stored_embedding, original_embedding) / (np.linalg.norm(stored_embedding) * np.linalg.norm(original_embedding)))
        print(f"   ✓ Embedding restoration similarity: {similarity_score:.3f}")
        
        # Test 7: FAISS index statistics
        print("\n7. FAISS Index Statistics")
        stats = faiss_index.get_stats()
        print(f"   ✓ Total entries: {stats['total_entries']}")
        print(f"   ✓ Journal entries: {stats['journal_entries']}")
        print(f"   ✓ Influence entries: {stats['influence_entries']}")
        print(f"   ✓ Vector dimension: {stats['dimension']}")
        
        print("\n" + "=" * 40)
        print("✅ All tests completed successfully!")
        print(f"✅ System ready with {stats['total_entries']} indexed entries")
        
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_complete_system())