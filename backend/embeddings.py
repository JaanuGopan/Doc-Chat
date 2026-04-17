"""
Embedding singleton using sentence-transformers all-MiniLM-L6-v2 (384-dim).
Loaded once at startup; reused for all ingestion and query embedding calls.
"""
from typing import Optional
from sentence_transformers import SentenceTransformer

_model: Optional[SentenceTransformer] = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print("[embeddings] Loading all-MiniLM-L6-v2…")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        print("[embeddings] Model ready.")
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of strings. Returns list of 384-dim float vectors."""
    model = _get_model()
    return model.encode(texts, show_progress_bar=False, convert_to_numpy=True).tolist()


def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    return embed_texts([text])[0]
