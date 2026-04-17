import json
import requests

LM_STUDIO_BASE_URL = "http://127.0.0.1:1234"
DEFAULT_LOCAL_MODEL = "qwen/qwen3.5-2b"


def get_available_models() -> list[dict]:
    """Fetch available models from LM Studio."""
    try:
        resp = requests.get(f"{LM_STUDIO_BASE_URL}/api/v1/models", timeout=5)
        resp.raise_for_status()
        data = resp.json()
        # LM Studio returns { "data": [ { "id": "...", ... } ] }
        return data.get("data", [])
    except Exception:
        return []


def generate_chat_response(pages: list[dict], question: str, model: str = DEFAULT_LOCAL_MODEL) -> dict:
    """
    Given a list of page dicts (each with 'page_number' and 'text') and a user
    question, returns a structured dict: { answer, references }.
    references = [{ page, quote }]
    Uses LM Studio's /api/v1/chat endpoint.
    """

    # Build structured document string so the model knows page numbers
    doc_string = ""
    for p in pages:
        doc_string += f"[Page {p['page_number']}]\n{p['text']}\n\n"

    system_prompt = (
        "You are Doc-Chat, an intelligent AI assistant. "
        "Answer the user's question strictly based on the provided document. "
        "If the answer cannot be found, say so. "
        "You MUST respond with valid JSON only, following this exact schema:\n"
        '{"answer": "<your answer in markdown>", "references": [{"page": <page_number>, "quote": "<exact short excerpt from that page, max 200 chars>"}]}\n'
        "Include 1-3 references that best support your answer. "
        "The quote MUST be an exact substring from the document text. "
        "Do not include any text outside the JSON object."
    )

    user_prompt = f"DOCUMENT:\n---\n{doc_string}---\n\nQUESTION: {question}"

    # Use the OpenAI-compatible endpoint — LM Studio fully supports it
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 1536,
        "stream": False,
    }

    try:
        resp = requests.post(
            f"{LM_STUDIO_BASE_URL}/v1/chat/completions",
            json=payload,
            timeout=120,
        )
        if not resp.ok:
            # Surface the real error body from LM Studio
            raise Exception(f"LM Studio returned {resp.status_code}: {resp.text}")
        data = resp.json()

        # Standard OpenAI-compatible response shape
        raw = data["choices"][0]["message"]["content"].strip()

    except requests.exceptions.ConnectionError:
        return {
            "answer": "❌ Could not connect to LM Studio. Make sure it is running at `http://127.0.0.1:1234`.",
            "references": [],
        }
    except Exception as e:
        return {"answer": f"❌ Local model error: {e}", "references": []}

    # Strip markdown code fences if the model wraps in ```json … ```
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]

    try:
        result = json.loads(raw)
        return {
            "answer": result.get("answer", ""),
            "references": result.get("references", []),
        }
    except json.JSONDecodeError:
        # Fallback: return the raw text as answer with no references
        return {"answer": raw, "references": []}
