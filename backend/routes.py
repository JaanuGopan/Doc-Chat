import traceback
import requests as http_requests
from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

from embeddings import embed_query
from ingestion import ingest_document
from vector_store import similarity_search, delete_document, _get_conn
from GroqImplementation import generate_chat_response as groq_generate
from LocalModelImplementation import (
    generate_chat_response as local_generate,
    get_available_models,
    LM_STUDIO_BASE_URL,
)

router = APIRouter()


# ── Ingestion ──────────────────────────────────────────────────────────────────

@router.post("/ingest/")
async def ingest(
    user_id: str = Form(...),
    document_id: str = Form(...),
    file: UploadFile = File(None),
    text_content: str = Form(""),
    filename: str = Form("document"),
):
    """
    Ingest a document into Supabase vector store.
    """
    try:
        if file and file.filename:
            file_bytes = await file.read()
            chunk_count = ingest_document(
                document_id=document_id,
                filename=file.filename,
                file_bytes=file_bytes,
            )
        elif text_content.strip():
            chunk_count = ingest_document(
                document_id=document_id,
                filename=filename,
                raw_text=text_content,
            )
        else:
            return JSONResponse({"error": "No content provided."}, status_code=400)

        return {"chunk_count": chunk_count, "document_id": document_id}

    except Exception as e:
        print("Error in /ingest/:", traceback.format_exc())
        return JSONResponse({"error": str(e)}, status_code=500)


@router.delete("/document/{document_id}")
async def remove_document(document_id: str):
    """
    Remove all vector chunks and the document record.
    """
    try:
        delete_document(document_id)
        return {"message": "Document data cleared successfully."}
    except Exception as e:
        print(f"Error deleting document {document_id}:", traceback.format_exc())
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/documents/{user_id}")
async def list_documents(user_id: str):
    """
    List all documents belonging to a user.
    """
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, filename, file_hash, storage_path, chunk_count, created_at FROM documents WHERE user_id = %s ORDER BY created_at DESC",
                (user_id,)
            )
            rows = cur.fetchall()
            docs = [
                {
                    "id": str(row[0]),
                    "filename": row[1],
                    "file_hash": row[2],
                    "storage_path": row[3],
                    "chunk_count": row[4],
                    "created_at": row[5].isoformat()
                }
                for row in rows
            ]
            return {"documents": docs}
    except Exception as e:
        print(f"Error listing documents for user {user_id}:", traceback.format_exc())
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        conn.close()


# ── Chat ───────────────────────────────────────────────────────────────────────

@router.post("/chat/")
async def doc_chat(
    document_id: str = Form(...),
    question: str = Form(...),
    model_provider: str = Form("groq"),        # "groq" | "local"
    local_model: str = Form("qwen/qwen3.5-2b"),
    top_k: int = Form(5),
    use_thinking: bool = Form(False),
):
    """
    Perform RAG: embed the question → similarity search → call LLM with top-k chunks.
    """
    try:
        # 1. Embed the query
        query_vec = embed_query(question)

        # 2. Retrieve top-k chunks from Supabase
        chunks = similarity_search(document_id, query_vec, top_k=top_k)

        if not chunks:
            return {
                "answer": "I couldn't find any relevant content in the indexed document. "
                          "Please make sure the document was uploaded and indexed successfully.",
                "references": [],
            }

        # 3. Generate answer
        if model_provider == "local":
            result = local_generate(chunks, question, model=local_model, use_thinking=use_thinking)
        else:
            result = groq_generate(chunks, question, use_thinking=use_thinking)

        return result  # { answer, references }

    except Exception as e:
        print("Error in /chat/:", traceback.format_exc())
        return JSONResponse({"error": str(e)}, status_code=500)


# ── Local model helpers ────────────────────────────────────────────────────────

@router.get("/local-models/")
async def list_local_models():
    """Return models currently available in LM Studio."""
    models = get_available_models()
    return {"models": models}


@router.get("/local-status/")
async def local_status():
    """Check whether LM Studio is reachable."""
    try:
        resp = http_requests.get(f"{LM_STUDIO_BASE_URL}/v1/models", timeout=3)
        return {"online": resp.status_code == 200}
    except Exception:
        return {"online": False}
