"""
Supabase / pgvector wrapper.
Uses the DIRECT_URL (raw PostgreSQL) to avoid pgbouncer incompatibilities
with pgvector type registration.
"""
import os
import psycopg2
from pgvector.psycopg2 import register_vector
from dotenv import load_dotenv

load_dotenv()

# Use direct connection (not pgbouncer) for proper pgvector support
_DSN = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")


def _get_conn():
    conn = psycopg2.connect(_DSN)
    try:
        register_vector(conn)
    except psycopg2.ProgrammingError as e:
        conn.close()
        raise RuntimeError(
            "pgvector extension not found in Supabase. "
            "Run this SQL in your Supabase SQL Editor first:\n"
            "  create extension if not exists vector;\n"
            f"Original error: {e}"
        ) from e
    return conn


# ──────────────────────────────────────────────
# Write
# ──────────────────────────────────────────────

def upsert_chunks(document_id: str, chunks: list[dict]) -> None:
    """
    Delete any existing chunks for this document then insert the new batch.
    Each chunk dict must have: content, embedding, page, source, chunk_index.
    """
    conn = _get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM document_chunks WHERE document_id = %s",
                    (document_id,),
                )
                cur.executemany(
                    """
                    INSERT INTO document_chunks
                      (document_id, source, page, chunk_index, content, embedding)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    [
                        (
                            document_id,
                            chunk["source"],
                            chunk["page"],
                            chunk["chunk_index"],
                            chunk["content"],
                            chunk["embedding"],
                        )
                        for chunk in chunks
                      ],
                )
                
                # Update chunk count in documents table
                cur.execute(
                    "UPDATE documents SET chunk_count = %s WHERE id = %s",
                    (len(chunks), document_id)
                )
    finally:
        conn.close()


# ──────────────────────────────────────────────
# Read
# ──────────────────────────────────────────────

def similarity_search(
    document_id: str,
    query_embedding: list[float],
    top_k: int = 5,
) -> list[dict]:
    """
    Return the top-k most similar chunks for this document using cosine distance.
    """
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT content, page, source,
                       1 - (embedding <=> %s::vector) AS similarity
                FROM   document_chunks
                WHERE  document_id = %s
                ORDER BY embedding <=> %s::vector
                LIMIT  %s
                """,
                (query_embedding, document_id, query_embedding, top_k),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        {
            "content": row[0],
            "page": row[1],
            "source": row[2],
            "similarity": float(row[3]),
        }
        for row in rows
    ]


# ──────────────────────────────────────────────
# Cleanup
# ──────────────────────────────────────────────

def delete_document(document_id: str) -> None:
    """Remove a document and all its chunks."""
    conn = _get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                # Due to CASCADE, deleting from documents table will remove chunks too
                cur.execute(
                    "DELETE FROM documents WHERE id = %s",
                    (document_id,),
                )
    finally:
        conn.close()
