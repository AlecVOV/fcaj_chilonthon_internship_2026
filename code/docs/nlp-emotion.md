# NLP Emotion Detection — Model & Pipeline

> **Project:** Focus Mode App  
> **Model:** `distilbert-base-uncased-emotion` (quantized ONNX)  
> **Labels:** 5 categories — `focused`, `stressed`, `exhausted`, `relaxed`, `unmotivated`  
> **Runtime:** AWS Lambda (Python 3.12) with ONNX Runtime  
> **Input:** Journal text (max 1000 chars)  
> **Output:** Emotion label + confidence score  

---

## 1. Model Selection Rationale

| Criterion | Choice | Reason |
|---|---|---|
| **Architecture** | DistilBERT | 40% smaller than BERT-base, 60% faster inference, ~97% of accuracy |
| **Format** | ONNX (quantized INT8) | Smaller deployment package (~82 MB vs ~260 MB PyTorch); faster cold start on Lambda |
| **Labels** | 5 custom emotions | Aligned with productivity context: focused, stressed, exhausted, relaxed, unmotivated |
| **Fallback** | Hugging Face Inference API | Used if ONNX model fails to load (free tier: 30k chars/month) |

## 2. Emotion Labels

| Label | Description | Trigger Example |
|---|---|---|
| `focused` | Deep concentration, flow state | "I was completely in the zone today, got so much done." |
| `stressed` | Overwhelmed, pressured | "Too many deadlines, feeling the pressure." |
| `exhausted` | Mentally drained, burnt out | "I can't think anymore, completely drained." |
| `relaxed` | Calm, at ease | "It was a peaceful session, no rush." |
| `unmotivated` | Lacking drive, procrastinating | "Couldn't get myself to start anything today." |

## 3. AWS Lambda Deployment Package

### 3.1 Directory Structure

```
focus-emotion-lambda/
├── lambda_function.py          # Entry point
├── requirements.txt
├── model/
│   ├── config.json             # Tokenizer config
│   ├── vocab.txt               # DistilBERT vocabulary
│   └── model_quantized.onnx    # Quantized ONNX model (~82 MB)
└── layer/
    └── python/
        ├── onnxruntime/        # ONNX Runtime for Lambda
        └── transformers/       # HuggingFace tokenizers only
```

### 3.2 Lambda Function (`lambda_function.py`)

```python
import json
import os
import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer
import psycopg2
from supabase import create_client

# --- INIT (runs once per cold start) ---
MODEL_PATH = os.environ.get("MODEL_PATH", "/opt/model/model_quantized.onnx")
TOKENIZER_PATH = os.environ.get("TOKENIZER_PATH", "/opt/model")

# Emotion labels in model output order
EMOTION_LABELS = ["focused", "stressed", "exhausted", "relaxed", "unmotivated"]

# Load ONNX model
session = ort.InferenceSession(MODEL_PATH)
tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_PATH)

# Supabase client (service_role for DB writes)
supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"]
)

def detect_emotion(journal_text: str) -> dict:
    """Run ONNX inference and return label + confidence."""
    # Tokenize
    inputs = tokenizer(
        journal_text,
        max_length=512,
        truncation=True,
        padding="max_length",
        return_tensors="np"
    )

    # ONNX inference
    ort_inputs = {
        "input_ids": inputs["input_ids"],
        "attention_mask": inputs["attention_mask"]
    }
    logits = session.run(None, ort_inputs)[0]

    # Softmax → probabilities
    probs = np.exp(logits) / np.sum(np.exp(logits), axis=1, keepdims=True)
    pred_idx = int(np.argmax(probs, axis=1)[0])
    confidence = float(np.max(probs, axis=1)[0])

    return {
        "emotion_label": EMOTION_LABELS[pred_idx],
        "confidence": round(confidence, 4)
    }

def lambda_handler(event, context):
    """API Gateway entry point."""
    try:
        body = json.loads(event.get("body", "{}"))
        journal_text = body.get("journal_text", "").strip()
        session_id = body.get("session_id")

        if not journal_text:
            return {"statusCode": 400, "body": json.dumps({
                "error": "BadRequest",
                "message": "journal_text is required"
            })}

        if len(journal_text) > 1000:
            journal_text = journal_text[:1000]  # Truncate

        # Detect emotion
        result = detect_emotion(journal_text)

        # Update focus_sessions row in Supabase
        if session_id:
            supabase.table("focus_sessions").update({
                "emotion_label": result["emotion_label"],
                "emotion_confidence": result["confidence"],
                "updated_at": "now()"
            }).eq("id", session_id).execute()

        return {
            "statusCode": 200,
            "body": json.dumps({
                "session_id": session_id,
                "emotion_label": result["emotion_label"],
                "confidence": result["confidence"]
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": "InternalError",
                "message": str(e)
            })
        }
```

### 3.3 `requirements.txt`

```
onnxruntime==1.18.0
transformers==4.41.0
numpy==1.26.4
supabase==2.5.1
psycopg2-binary==2.9.9
```

## 4. Model Conversion Pipeline (One-Time)

Convert the HuggingFace PyTorch model to quantized ONNX on a local machine:

```bash
# Install optimum for ONNX export
pip install optimum[exporters] onnx onnxruntime

# Export to ONNX with INT8 quantization
optimum-cli export onnx \
  --model distilbert-base-uncased-emotion \
  --task text-classification \
  --opset 14 \
  ./model/

# Quantize (reduces ~260 MB → ~82 MB)
python -m onnxruntime.transformers.optimizer \
  --input model/model.onnx \
  --output model/model_quantized.onnx \
  --quantization_mode IntegerOps
```

## 5. Cold Start Optimization

| Technique | Detail |
|---|---|
| **Lambda Layer** | ONNX runtime + tokenizer in a Lambda Layer (~45 MB zipped) |
| **Provisioned Concurrency** | Not used (Free Tier constraint); expect 1-3s cold start |
| **Lazy Loading** | Model loaded in global scope (outside handler) — reused across warm invocations |
| **Memory** | 512 MB (sufficient for DistilBERT-ONNX; ~300 MB peak usage) |
| **Timeout** | 15 seconds (enough for cold start + inference) |

## 6. Fallback to HuggingFace Inference API

If ONNX model fails (e.g., corrupted layer), fall back to HF Inference API:

```python
import requests

HF_API_URL = "https://api-inference.huggingface.co/models/distilbert-base-uncased-emotion"
HF_HEADERS = {"Authorization": f"Bearer {os.environ['HF_API_TOKEN']}"}

def detect_emotion_fallback(text: str) -> dict:
    resp = requests.post(HF_API_URL, headers=HF_HEADERS, json={"inputs": text})
    result = resp.json()[0][0]  # Top result
    return {
        "emotion_label": result["label"],
        "confidence": round(result["score"], 4)
    }
```

## 7. Testing

See `testing-plan.md`. Test cases:

- **Happy path:** "I was completely focused" → `focused` (confidence > 0.7)
- **Empty input:** → 400 error
- **Max length:** 1000+ chars truncated to 1000
- **Mixed emotion:** "Focused at first but exhausted by the end" → picks dominant
- **Non-English:** Model works on English; Vietnamese journal text would need a different model
