# app/core/embeddings.py
import os
import faiss
import numpy as np
from pathlib import Path
from app.core.config import get_settings


def get_embeddings():
    """Get configured embeddings instance (OpenAI for speed)."""
    from langchain_openai import OpenAIEmbeddings
    settings = get_settings()

    # Use OpenAI embeddings for faster processing
    embeddings = OpenAIEmbeddings(
        openai_api_key=settings.openai_api_key,
        model="text-embedding-3-small"
    )

    return embeddings


def create_vector_store(texts: list[str], metadatas: list[dict], output_dir: str):
    """
    Create FAISS vector store from texts.

    Args:
        texts: List of text chunks
        metadatas: List of metadata dicts (one per text)
        output_dir: Directory to save index
    """
    import pickle

    embeddings = get_embeddings()

    # Generate embeddings
    print(f"Generating embeddings for {len(texts)} chunks...")
    vectors = embeddings.embed_documents(texts)
    vectors_array = np.array(vectors, dtype=np.float32)

    # Create FAISS index
    dimension = vectors_array.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(vectors_array)

    # Save index
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    faiss.write_index(index, str(output_path / "index.faiss"))

    # Save metadata
    with open(output_path / "metadata.pkl", "wb") as f:
        pickle.dump({"texts": texts, "metadatas": metadatas}, f)

    print(f"Vector store saved to {output_dir}")


def load_vector_store(store_dir: str) -> tuple:
    """
    Load FAISS vector store and metadata.

    Returns:
        Tuple of (index, texts, metadatas)
    """
    import pickle

    store_path = Path(store_dir)

    index = faiss.read_index(str(store_path / "index.faiss"))

    with open(store_path / "metadata.pkl", "rb") as f:
        data = pickle.load(f)

    return index, data["texts"], data["metadatas"]