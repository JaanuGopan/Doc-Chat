# Project Setup Guide

Follow these steps to run this project.

---

## 1. Create the `.env` file

In the root folder of the project, create a new file called:

```bash


.env
```

Inside this file, add your Hugging Face token like this:

```bash

HF_TOKEN=your_token_here
GEMMA_API_KEY=your_google_ai_studio_token_here
```

(Replace `your_token_here` with your actual Hugging Face token.)

---

## 2. Create a Python environment

Open your terminal (Command Prompt, PowerShell, or Terminal on Mac/Linux) and run:

```bash
python -m venv myenv
```

This creates a new environment named myenv.

3. Activate the environment

```bash
On Windows:

myenv\Scripts\activate


On Mac/Linux:

source myenv/bin/activate
```

4. Install the requirements

Once the environment is activated, install the required packages by running:

```bash
pip install -r requirements.txt
```

5. Run the FastAPI app

Start the FastAPI app with this command:

```bash
uvicorn main:app --reload
```

6. Open Swagger UI

After the app starts, open your web browser and go to:

```bash
http://127.0.0.1:8000/docs
```

This will open Swagger UI, where you can try out the API and test it by clicking Execute.
