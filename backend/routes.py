import io
import traceback
import PyPDF2
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
import requests

from GroqImplementation import generate_chat_response as groq_generate
from LocalModelImplementation import (
    generate_chat_response as local_generate,
    get_available_models,
    LM_STUDIO_BASE_URL,
)

router = APIRouter()


@router.post("/chat/")
async def doc_chat(
    file: UploadFile = File(None),
    text_content: str = Form(""),
    question: str = Form(...),
    model_provider: str = Form("groq"),       # "groq" | "local"
    local_model: str = Form("qwen/qwen3.5-2b"),
):
    try:
        pages = []

        if file and file.filename:
            file_bytes = await file.read()
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            for i, page in enumerate(pdf_reader.pages):
                text = page.extract_text() or ""
                if text.strip():
                    pages.append({"page_number": i + 1, "text": text})
        elif text_content:
            # Treat plain text as a single-page document
            pages = [{"page_number": 1, "text": text_content}]

        if not pages:
            return JSONResponse(
                {"error": "No readable text found in PDF or provided text"},
                status_code=400,
            )

        if model_provider == "local":
            result = local_generate(pages, question, model=local_model)
        else:
            result = groq_generate(pages, question)

        return result  # { answer, references }

    except Exception as e:
        print("Error in /chat/:", traceback.format_exc())
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/local-models/")
async def list_local_models():
    """Return models currently available in LM Studio."""
    models = get_available_models()
    return {"models": models}


@router.get("/local-status/")
async def local_status():
    """Check whether LM Studio is reachable."""
    try:
        resp = requests.get(f"{LM_STUDIO_BASE_URL}/v1/models", timeout=3)
        return {"online": resp.status_code == 200}
    except Exception:
        return {"online": False}
