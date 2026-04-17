FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . /app
ENV MODEL_DIR=/model
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]