# Emotion Detector — Lambda Function

> ⚪ **README only, chưa code.** Frontend hiện tại (`web/composables/useEmotionDetector.ts`)
> dùng **fallback keyword-regex thuần client** (đoán "stress"/"tired"/"relax"/... trong text)
> khi `NUXT_PUBLIC_EMOTION_API_URL` rỗng — **KHÔNG phải AI**, không liên quan Bedrock/Haiku.
> Bedrock Agent (Haiku 4.5) hiện chỉ dùng cho Task Assistant, không dùng cho emotion detection.
> Kế hoạch ONNX Lambda dưới đây vẫn giữ nguyên, chưa triển khai.

**Purpose:** Analyze post-focus journal text using distilbert-base-uncased-emotion
(ONNX quantized). Returns one of 5 emotion labels with confidence score.

## Model

| Property | Value |
|----------|-------|
| Architecture | DistilBERT (ONNX INT8 quantized) |
| Size | ~82 MB |
| Labels | focused, stressed, exhausted, relaxed, unmotivated |
| Input | Journal text (max 1000 chars) |
| Output | `{ emotion_label: "focused", confidence: 0.89 }` |

## Deploy

This function requires the `onnx-transformers` Lambda Layer (see `../../layers/README.md`).

```bash
chmod +x deploy.sh
./deploy.sh focus-emotion-detector
```

## Environment Variables

| Key | Value |
|-----|-------|
| `MODEL_PATH` | `/opt/model/model_quantized.onnx` |
| `TOKENIZER_PATH` | `/opt/model` |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` |

## Lambda Config

| Setting | Value |
|---------|-------|
| Runtime | Python 3.12 |
| Memory | 512 MB |
| Timeout | 15 seconds |
| Layer | `onnx-transformers` |
