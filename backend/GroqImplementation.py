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


def generate_chat_response(chunks: list[dict], question: str, use_thinking: bool = False) -> dict:
    """
    Given a list of retrieved chunk dicts (each with 'content', 'page', 'source')
    and a user question, returns { answer, references }.
    """
    model = "llama-3.3-70b-versatile"

    # Build context from retrieved chunks, preserving page metadata
    context_parts = []
    for chunk in chunks:
        context_parts.append(
            f"[Page {chunk['page']} · {chunk.get('source', 'document')}]\n{chunk['content']}"
        )
    context = "\n\n---\n\n".join(context_parts)

    thinking_instruction = (
        "\n\nFirst, analyze the provided context meticulously. "
        "Think step-by-step about how the context relates to the question. "
        "Formulate your reasoning before providing the final answer in the 'answer' field."
        if use_thinking else ""
    )

    system_prompt = (
        "You are Doc-Chat, an intelligent AI assistant. "
        "Answer the user's question strictly based on the provided context excerpts. "
        "If the answer cannot be found in the context, say so clearly. "
        f"{thinking_instruction}\n"
        "You MUST respond with valid JSON only, following this exact schema:\n"
        '{"answer": "<your answer in markdown>", "references": [{"page": <page_number>, "quote": "<exact short excerpt from that page, max 200 chars>"}]}\n'
        "Include 1-3 references that best support your answer. "
        "The quote MUST be an exact substring from the context. "
        "Do not include any text outside the JSON object."
    )

    user_prompt = f"CONTEXT:\n---\n{context}\n---\n\nQUESTION: {question}"

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.1,
        max_tokens=1536,
    )

    raw = response.choices[0].message.content.strip()

    import re
    
    def clean_json_string(s: str) -> str:
        # 1. Remove markdown formatting if present
        s = s.strip()
        if s.startswith("```"):
            s = re.sub(r'^```[a-z]*\n?', '', s)
            s = re.sub(r'\n?```$', '', s)
        
        # 2. Extract the actual { ... } or [ ... ] block
        match = re.search(r'(\{.*\}|\[.*\])', s, re.DOTALL)
        if not match:
            return s
        s = match.group(0)
        
        # 3. Fix unescaped newlines inside strings that break json.loads
        # This regex looks for newlines that are NOT preceded by a backslash
        # but are inside what looks like a JSON string value.
        # A simpler approach is to use a more permissive parser, but we'll try cleaning first.
        # This replaces literal newlines with escaped '\n'
        s = re.sub(r'(?<=[:\s])"(.*?)"(?=[,\s}])', 
                   lambda m: m.group(0).replace('\n', '\\n'), 
                   s, flags=re.DOTALL)
        return s

    try:
        cleaned = clean_json_string(raw)
        result = json.loads(cleaned)
        
        # If the model nested the response, unpack it correctly
        answer_text = result.get("answer", "")
        final_references = result.get("references", [])
        
        return {
            "answer": answer_text if isinstance(answer_text, str) else json.dumps(answer_text),
            "references": final_references if isinstance(final_references, list) else []
        }
    except Exception as e:
        print(f"JSON parsing error: {e}")
        # Final fallback: if it looks like a JSON but parsing failed, 
        # try to extract the answer field via regex
        ans_match = re.search(r'"answer":\s*"(.*?)"(?=,\s*"references"|})', cleaned, re.DOTALL)
        if ans_match:
            return {"answer": ans_match.group(1).replace('\\n', '\n'), "references": []}
            
        return {"answer": raw, "references": []}
