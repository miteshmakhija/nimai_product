# app/services/retriever.py

def rfq_to_text(rfq: dict) -> str:
    items = "\n".join([
        f"{i['item_name']} | qty: {i['quantity']}"
        for i in rfq.get("line_items", [])
    ])

    return f"""
Customer: {rfq.get('customer_name')}
Industry: {rfq.get('industry')}
Items:
{items}
Technical: {rfq.get('technical_requirements')}
"""

def retrieve_similar_structured(rfq: dict, k=3):
    import os
    from app.core.config import get_settings
    settings = get_settings()
    store_dir = getattr(settings, "vector_store_dir", None) or os.path.join(
        getattr(settings, "uploads_dir", "data/uploads"), "..", "vector_store"
    )
    store_dir = os.path.abspath(store_dir)

    if not os.path.exists(store_dir):
        return []  # No vector store yet — skip retrieval gracefully

    try:
        from app.core.embeddings import load_vector_store
        store = load_vector_store(store_dir)
        query = rfq_to_text(rfq)
        docs = store.similarity_search(query, k=k)
        return [d.page_content for d in docs]
    except Exception:
        return []  # Retrieval is optional; don't fail the whole pipeline


import numpy as np


def retrieve_similar_quotes(
    rfq_data: dict,
    index,
    texts: list,
    metadatas: list,
    embeddings,
    top_k: int = 5
) -> list[dict]:
    """
    Retrieve similar quotes from vector store.

    Args:
        rfq_data: Structured RFQ data
        index: FAISS index
        texts: List of text chunks
        metadatas: List of metadata dicts
        embeddings: Embeddings instance
        top_k: Number of results to return

    Returns:
        List of dicts with 'content' and metadata
    """
    # Build query from RFQ data
    query_parts = []
    for key, value in rfq_data.items():
        if value:
            if isinstance(value, list):
                query_parts.append(" ".join(str(v) for v in value))
            else:
                query_parts.append(str(value))

    query_text = " ".join(query_parts)

    if not query_text:
        return []

    # Generate query embedding
    query_vector = embeddings.embed_query(query_text)
    query_array = np.array([query_vector], dtype=np.float32)

    # Search
    distances, indices = index.search(query_array, top_k)

    # Build results with metadata
    results = []
    for i, idx in enumerate(indices[0]):
        if idx < len(texts):
            results.append({
                "content": texts[idx],
                "distance": float(distances[0][i]),
                **metadatas[idx]
            })

    return results