import os

from dotenv import load_dotenv
from huggingface_hub import InferenceClient

load_dotenv()


client = InferenceClient(token=os.environ["HF_TOKEN"])

completion = client.chat.completions.create(
    model="meta-llama/Meta-Llama-3-8B-Instruct",  # Or use other variants like Meta-Llama-3-70B
    messages=[
        {
            "role": "user",
            "content": "Hello, what's the capital of France?"
        }
    ],
    max_tokens=100,  # Adjust as needed
    temperature=0.7
)

print(completion.choices[0].message.content)