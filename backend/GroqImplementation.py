import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# Initialize the OpenAI client pointing to Groq's API
client = OpenAI(
    api_key=os.environ.get("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)

def generate_chat_response(pages: list[dict], question: str) -> dict:
    """
    Given a list of page dicts (each with 'page_number' and 'text') and a user
    question, returns a structured dict: { answer, references }.
    references = [{ page, quote }]
    """
    model = "llama-3.3-70b-versatile"

    # Build structured document string so Groq knows page numbers
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

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.1,
        max_tokens=1536,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if the model wraps in ```json ... ```
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]

    try:
        result = json.loads(raw)
        return {
            "answer": result.get("answer", ""),
            "references": result.get("references", [])
        }
    except json.JSONDecodeError:
        # Fallback: return the raw text as answer with no references
        return {"answer": raw, "references": []}
