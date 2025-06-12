"""
OpenAI Embeddings helper for text similarity search
"""
import openai
import numpy as np
import base64
from typing import List, Optional
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def embed(text: str, model: str = "text-embedding-3-small") -> np.ndarray:
    """
    Generate embeddings for text using OpenAI's embedding models.
    
    Args:
        text: Input text to embed
        model: OpenAI embedding model to use (default: text-embedding-3-small)
    
    Returns:
        numpy array of embeddings
    """
    try:
        # Clean and prepare text
        cleaned_text = text.strip().replace("\n", " ")
        
        # Get embeddings from OpenAI
        response = client.embeddings.create(
            model=model,
            input=cleaned_text
        )
        
        # Extract embedding vector
        embedding = np.array(response.data[0].embedding, dtype=np.float32)
        return embedding
        
    except Exception as e:
        print(f"Error generating embedding: {e}")
        raise

def embedding_to_base64(embedding: np.ndarray) -> str:
    """Convert numpy embedding array to base64 string for database storage"""
    return base64.b64encode(embedding.tobytes()).decode('utf-8')

def base64_to_embedding(b64_string: str) -> np.ndarray:
    """Convert base64 string back to numpy embedding array"""
    bytes_data = base64.b64decode(b64_string.encode('utf-8'))
    return np.frombuffer(bytes_data, dtype=np.float32)

def embed_texts(texts: List[str], model: str = "text-embedding-3-small") -> List[np.ndarray]:
    """
    Generate embeddings for multiple texts efficiently.
    
    Args:
        texts: List of input texts to embed
        model: OpenAI embedding model to use
    
    Returns:
        List of numpy arrays containing embeddings
    """
    try:
        # Clean texts
        cleaned_texts = [text.strip().replace("\n", " ") for text in texts]
        
        # Get embeddings from OpenAI (batch processing)
        response = client.embeddings.create(
            model=model,
            input=cleaned_texts
        )
        
        # Extract embedding vectors
        embeddings = []
        for data in response.data:
            embedding = np.array(data.embedding, dtype=np.float32)
            embeddings.append(embedding)
            
        return embeddings
        
    except Exception as e:
        print(f"Error generating batch embeddings: {e}")
        raise

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Calculate cosine similarity between two embedding vectors"""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))