"""
Document ingestion pipeline:
  file bytes → extract pages → clean text → chunk (with overlap) → embed → store in Supabase
"""
import io
import re

import PyPDF2

from embeddings import embed_texts
from vector_store import upsert_chunks

# ── Tunable constants ──────────────────────────────────────────────────────────
CHUNK_SIZE = 400   # words per chunk
OVERLAP    = 50    # words of overlap between consecutive chunks


# ── Text extraction ────────────────────────────────────────────────────────────

def extract_pages_from_pdf(file_bytes: bytes) -> list[dict]:
    """Return [{page_number, text}, …] for all non-empty pages."""
    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            pages.append({"page_number": i + 1, "text": text})
    return pages


def extract_pages_from_text(raw_text: str) -> list[dict]:
    """Treat a plain-text string as a single page."""
    return [{"page_number": 1, "text": raw_text}] if raw_text.strip() else []


# ── Text cleaning ──────────────────────────────────────────────────────────────

def clean_text(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)          # collapse horizontal whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)        # max 2 consecutive newlines
    text = re.sub(r"[^\x20-\x7E\n]", " ", text)  # remove non-printable chars
    return text.strip()


# ── Chunking ───────────────────────────────────────────────────────────────────

def _chunk_page(
    text: str,
    page_number: int,
    source: str,
    global_chunk_index: int,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = OVERLAP,
) -> list[dict]:
    """Split a single page's text into overlapping word-based chunks."""
    words = text.split()
    if not words:
        return []

    step    = max(1, chunk_size - overlap)
    chunks  = []
    start   = 0

    while start < len(words):
        end        = min(start + chunk_size, len(words))
        chunk_text = " ".join(words[start:end])
        chunks.append(
            {
                "content":     chunk_text,
                "page":        page_number,
                "source":      source,
                "chunk_index": global_chunk_index + len(chunks),
            }
        )
        if end == len(words):
            break
        start += step

    return chunks


# ── Main pipeline ──────────────────────────────────────────────────────────────

def ingest_document(
    document_id: str,
    filename: str,
    file_bytes=None,   # bytes | None
    raw_text=None,     # str | None
) -> int:
    """
    Full ingestion pipeline.
    Provide either `file_bytes` (PDF) or `raw_text` (plain text).
    Returns the number of chunks stored.
    """
    if file_bytes:
        pages = extract_pages_from_pdf(file_bytes)
    elif raw_text:
        pages = extract_pages_from_text(raw_text)
    else:
        return 0

    all_chunks: list[dict] = []
    for page in pages:
        cleaned = clean_text(page["text"])
        page_chunks = _chunk_page(
            cleaned,
            page["page_number"],
            filename,
            global_chunk_index=len(all_chunks),
        )
        all_chunks.extend(page_chunks)

    if not all_chunks:
        return 0

    # Batch-embed all chunks in one call (efficient)
    texts      = [c["content"] for c in all_chunks]
    embeddings = embed_texts(texts)

    for chunk, emb in zip(all_chunks, embeddings):
        chunk["embedding"] = emb

    upsert_chunks(document_id, all_chunks)
    print(f"[ingestion] {filename} → {len(all_chunks)} chunks stored (doc_id={document_id})")
    return len(all_chunks)
