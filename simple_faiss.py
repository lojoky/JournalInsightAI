"""
Simplified FAISS vector similarity search for journal entries and influences
"""
import faiss
import numpy as np
import os
from typing import List, Tuple, Optional, Dict, Any
from embedding import embed
import pickle

class SimpleFAISSIndex:
    def __init__(self, index_path: str = "faiss.index", metadata_path: str = "faiss_metadata.pkl"):
        self.index_path = index_path
        self.metadata_path = metadata_path
        self.dimension = 1536  # text-embedding-3-small dimension
        self.index = faiss.IndexFlatIP(self.dimension)
        self.metadata = []
        
        # Load existing data if available
        self.load_index()
    
    def load_index(self):
        """Load existing FAISS index and metadata"""
        try:
            if os.path.exists(self.index_path) and os.path.exists(self.metadata_path):
                self.index = faiss.read_index(self.index_path)
                with open(self.metadata_path, 'rb') as f:
                    self.metadata = pickle.load(f)
                print(f"Loaded FAISS index with {self.index.ntotal} vectors")
            else:
                print("Created new FAISS index")
        except Exception as e:
            print(f"Error loading index: {e}")
            self.index = faiss.IndexFlatIP(self.dimension)
            self.metadata = []
    
    def save_index(self):
        """Save FAISS index and metadata"""
        try:
            faiss.write_index(self.index, self.index_path)
            with open(self.metadata_path, 'wb') as f:
                pickle.dump(self.metadata, f)
        except Exception as e:
            print(f"Error saving index: {e}")
    
    def add_entry(self, text: str, entry_id: int, entry_type: str = "journal"):
        """Add text entry to FAISS index"""
        try:
            # Generate and normalize embedding
            embedding = embed(text)
            embedding = embedding / np.linalg.norm(embedding)
            
            # Add to index
            self.index.add(embedding.reshape(1, -1))
            
            # Store metadata
            self.metadata.append({
                "id": entry_id,
                "type": entry_type,
                "text_preview": text[:200] + "..." if len(text) > 200 else text
            })
            
            self.save_index()
            print(f"Added {entry_type} entry {entry_id} to index")
            
        except Exception as e:
            print(f"Error adding entry: {e}")
            raise
    
    def search(self, query_text: str, k: int = 5, entry_type: Optional[str] = None) -> List[Tuple[int, float, Dict[str, Any]]]:
        """Search for similar entries"""
        try:
            if self.index.ntotal == 0:
                return []
            
            # Generate query embedding
            query_embedding = embed(query_text)
            query_embedding = query_embedding / np.linalg.norm(query_embedding)
            
            # Search
            search_k = min(k * 2, self.index.ntotal)
            scores, indices = self.index.search(query_embedding.reshape(1, -1), search_k)
            
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx == -1 or idx >= len(self.metadata):
                    continue
                    
                metadata = self.metadata[idx]
                
                # Filter by type if specified
                if entry_type and metadata["type"] != entry_type:
                    continue
                
                results.append((metadata["id"], float(score), metadata))
                
                if len(results) >= k:
                    break
            
            return results
            
        except Exception as e:
            print(f"Error searching: {e}")
            return []
    
    def get_stats(self) -> Dict[str, Any]:
        """Get index statistics"""
        journal_count = sum(1 for meta in self.metadata if meta["type"] == "journal")
        influence_count = sum(1 for meta in self.metadata if meta["type"] == "influence")
        
        return {
            "total_entries": self.index.ntotal,
            "journal_entries": journal_count,
            "influence_entries": influence_count,
            "dimension": self.dimension
        }

# Global instance
faiss_index = SimpleFAISSIndex()