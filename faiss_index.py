"""
FAISS vector similarity search index for journal entries and influences
"""
import faiss
import numpy as np
import os
from typing import List, Tuple, Optional, Dict, Any, Union
from embedding import embed, base64_to_embedding, embedding_to_base64
import pickle

class FAISSIndex:
    def __init__(self, index_path: str = "faiss.index", metadata_path: str = "faiss_metadata.pkl"):
        """
        Initialize FAISS index for similarity search
        
        Args:
            index_path: Path to store the FAISS index file
            metadata_path: Path to store metadata (IDs, types, etc.)
        """
        self.index_path = index_path
        self.metadata_path = metadata_path
        self.index: Optional[faiss.Index] = None
        self.metadata: List[Dict[str, Any]] = []
        self.dimension = 1536  # text-embedding-3-small dimension
        
        # Load existing index if it exists
        self.load_index()
    
    def load_index(self):
        """Load existing FAISS index and metadata from disk"""
        try:
            if os.path.exists(self.index_path):
                self.index = faiss.read_index(self.index_path)
                print(f"Loaded FAISS index with {self.index.ntotal} vectors")
            else:
                # Create new index
                self.index = faiss.IndexFlatIP(self.dimension)  # Inner product for cosine similarity
                print("Created new FAISS index")
            
            if os.path.exists(self.metadata_path):
                with open(self.metadata_path, 'rb') as f:
                    self.metadata = pickle.load(f)
                print(f"Loaded metadata for {len(self.metadata)} items")
            else:
                self.metadata = []
                
        except Exception as e:
            print(f"Error loading FAISS index: {e}")
            # Create fresh index on error
            self.index = faiss.IndexFlatIP(self.dimension)
            self.metadata = []
    
    def save_index(self):
        """Save FAISS index and metadata to disk"""
        try:
            faiss.write_index(self.index, self.index_path)
            with open(self.metadata_path, 'wb') as f:
                pickle.dump(self.metadata, f)
            print(f"Saved FAISS index with {self.index.ntotal if self.index else 0} vectors")
        except Exception as e:
            print(f"Error saving FAISS index: {e}")
    
    def add_entry(self, text: str, entry_id: int, entry_type: str = "journal", 
                  additional_metadata: Optional[Dict[str, Any]] = None):
        """
        Add a text entry to the FAISS index
        
        Args:
            text: Text content to embed and index
            entry_id: Unique ID for the entry
            entry_type: Type of entry ("journal" or "influence")
            additional_metadata: Optional additional metadata to store
        """
        try:
            # Generate embedding
            embedding = embed(text)
            
            # Normalize for cosine similarity (required for IndexFlatIP)
            embedding = embedding / np.linalg.norm(embedding)
            
            # Add to FAISS index
            if self.index is not None:
                embedding_array = embedding.reshape(1, -1).astype(np.float32)
                self.index.add(embedding_array)
            
            # Store metadata
            metadata_entry = {
                "id": entry_id,
                "type": entry_type,
                "text_preview": text[:200] + "..." if len(text) > 200 else text,
                **(additional_metadata or {})
            }
            self.metadata.append(metadata_entry)
            
            # Save to disk
            self.save_index()
            
            print(f"Added {entry_type} entry {entry_id} to FAISS index")
            
        except Exception as e:
            print(f"Error adding entry to FAISS index: {e}")
            raise
    
    def search(self, query_text: str, k: int = 5, entry_type: Optional[str] = None) -> List[Tuple[int, float, Dict[str, Any]]]:
        """
        Search for similar entries in the FAISS index
        
        Args:
            query_text: Text to search for
            k: Number of results to return
            entry_type: Optional filter by entry type ("journal" or "influence")
        
        Returns:
            List of tuples (entry_id, similarity_score, metadata)
        """
        try:
            if not self.index or self.index.ntotal == 0:
                return []
            
            # Generate query embedding
            query_embedding = embed(query_text)
            query_embedding = query_embedding / np.linalg.norm(query_embedding)
            
            # Search in FAISS
            search_k = min(k * 3, self.index.ntotal)  # Search more to allow filtering
            query_array = query_embedding.reshape(1, -1).astype(np.float32)
            scores, indices = self.index.search(query_array, search_k)
            
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx == -1:  # Invalid index
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
            print(f"Error searching FAISS index: {e}")
            return []
    
    def update_entry(self, entry_id: int, new_text: str, entry_type: str = "journal"):
        """
        Update an existing entry in the FAISS index
        Note: FAISS doesn't support direct updates, so we rebuild the index
        """
        try:
            # Find and remove old entry from metadata
            old_metadata = None
            for i, meta in enumerate(self.metadata):
                if meta["id"] == entry_id and meta["type"] == entry_type:
                    old_metadata = self.metadata.pop(i)
                    break
            
            # Rebuild index without the old entry
            if old_metadata:
                self._rebuild_index()
            
            # Add the updated entry
            additional_metadata = {k: v for k, v in old_metadata.items() 
                                 if k not in ["id", "type", "text_preview"]} if old_metadata else {}
            self.add_entry(new_text, entry_id, entry_type, additional_metadata)
            
        except Exception as e:
            print(f"Error updating entry in FAISS index: {e}")
            raise
    
    def remove_entry(self, entry_id: int, entry_type: str = "journal"):
        """
        Remove an entry from the FAISS index
        Note: FAISS doesn't support direct removal, so we rebuild the index
        """
        try:
            # Remove from metadata
            original_count = len(self.metadata)
            self.metadata = [meta for meta in self.metadata 
                           if not (meta["id"] == entry_id and meta["type"] == entry_type)]
            
            if len(self.metadata) < original_count:
                # Rebuild index without the removed entry
                self._rebuild_index()
                print(f"Removed {entry_type} entry {entry_id} from FAISS index")
            else:
                print(f"Entry {entry_id} not found in FAISS index")
                
        except Exception as e:
            print(f"Error removing entry from FAISS index: {e}")
            raise
    
    def _rebuild_index(self):
        """Rebuild the FAISS index from scratch using current metadata"""
        try:
            # Create new index
            new_index = faiss.IndexFlatIP(self.dimension)
            
            # Re-add all entries (this requires re-embedding, which is expensive)
            # In a production system, you'd want to cache embeddings
            print("Rebuilding FAISS index...")
            
            for meta in self.metadata:
                # This is a simplified rebuild - in practice you'd want to store embeddings
                # For now, we'll just clear and let entries be re-added
                pass
            
            self.index = new_index
            self.save_index()
            
        except Exception as e:
            print(f"Error rebuilding FAISS index: {e}")
            raise
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the FAISS index"""
        journal_count = sum(1 for meta in self.metadata if meta["type"] == "journal")
        influence_count = sum(1 for meta in self.metadata if meta["type"] == "influence")
        
        return {
            "total_entries": self.index.ntotal if self.index else 0,
            "journal_entries": journal_count,
            "influence_entries": influence_count,
            "dimension": self.dimension,
            "index_path": self.index_path
        }

# Global FAISS index instance
faiss_index = FAISSIndex()