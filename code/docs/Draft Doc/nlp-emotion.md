# NLP Emotion Detection — Model & Pipeline

> Cập nhật 2026-07-12 — đồng bộ với bản cài đặt hiện tại (trạng thái implement đã ghi rõ).

> **Project:** Focus Mode App  
> **Model:** `bhadresh-savani/distilbert-base-uncased-emotion` (quantized ONNX INT8), đóng gói THẲNG trong Lambda — không qua Bedrock, không qua Lambda Layer  
> **Labels model gốc (6 lớp):** `sadness, joy, love, anger, fear, surprise` — map thủ công/xấp xỉ sang 5 nhãn app  
> **Labels app (5 categories):** `focused`, `stressed`, `exhausted`, `relaxed`, `unmotivated`  
> **Runtime:** AWS Lambda (Python 3.12) with ONNX Runtime + `tokenizers` (KHÔNG dùng `transformers`/`torch` lúc chạy thật)  
> **Input:** `{ "text": "..." }` (journal text, max 1000 chars, truncate không reject)  
> **Output:** `{ "label": "...", "confidence": 0.xx }` — **stateless**, Lambda KHÔNG ghi DB, frontend tự lưu cùng session  

> **Status (2026-07-12):** **ĐÃ DEPLOY & LIVE.** `aws/lambdas/emotion-detector/` có đủ
> `lambda_function.py` (handler thật) + `prepare_model.py` (export model, chạy 1 lần local) +
> `test_local.py` + `DEPLOY-cmd.md` (runbook AWS đầy đủ). Route `POST /emotion` đã deploy trên HTTP
> API `ffepnb6gei`, test qua `curl` với token thật trả 200 + CloudWatch không có lỗi. Frontend
> (`web/composables/useEmotionDetector.ts`) tự gọi `POST {API}/emotion` kèm
> `Authorization: Bearer <access_token>` khi có `emotionApiUrl`/`apiGatewayUrl`; chỉ rơi về
> **fallback regex client-side** nếu thiếu biến env đó (ví dụ môi trường local chưa set).
>
> **⚠️ Về độ chính xác của mapping 6→5 nhãn:** không tồn tại model public fine-tune sẵn cho đúng 5
> nhãn năng suất của app này — bảng `MAP_TO_APP_LABEL` trong `lambda_function.py` là **xấp xỉ thủ
> công** (`joy→focused`, `love→relaxed`, `surprise→focused`, `anger→stressed`, `fear→stressed`,
> `sadness→exhausted`), cộng thêm heuristic confidence-thấp→`unmotivated`. Chi tiết xem
> `aws/lambdas/emotion-detector/README.md`.

---

## 1. Model Selection Rationale

| Criterion | Choice | Reason |
|---|---|---|
| **Architecture** | DistilBERT | 40% smaller than BERT-base, 60% faster inference, ~97% of accuracy |
| **Format** | ONNX (quantized INT8) | Smaller deployment package (~80-90 MB vs ~260 MB PyTorch); faster cold start on Lambda |
| **Labels** | 6 nhãn gốc model → map xấp xỉ sang 5 nhãn app | Model gốc không có sẵn 5 nhãn năng suất đúng như app cần — xem §2 và cảnh báo đầu file |
| **Fallback khi chưa deploy** | Regex client-side (`useEmotionDetector.ts`) | KHÔNG phải AI — chỉ tạm dùng tới khi Lambda được deploy |

## 2. Emotion Labels

| Label | Description | Trigger Example |
|---|---|---|
| `focused` | Deep concentration, flow state | "I was completely in the zone today, got so much done." |
| `stressed` | Overwhelmed, pressured | "Too many deadlines, feeling the pressure." |
| `exhausted` | Mentally drained, burnt out | "I can't think anymore, completely drained." |
| `relaxed` | Calm, at ease | "It was a peaceful session, no rush." |
| `unmotivated` | Lacking drive, procrastinating | "Couldn't get myself to start anything today." |

## 3. AWS Lambda Deployment Package

> Đây không còn là spec — đây là mô tả code THẬT trong `aws/lambdas/emotion-detector/`. Đọc code gốc
> nếu cần chi tiết, phần dưới chỉ tóm tắt cho dễ tra cứu.

### 3.1 Directory Structure (thật)

```
aws/lambdas/emotion-detector/
├── lambda_function.py          # Handler thật — deploy vào Lambda
├── prepare_model.py            # Chạy 1 LẦN ở máy local để export model (KHÔNG deploy)
├── test_local.py               # Test nhanh trên máy, không cần AWS
├── requirements.txt            # Deps RUNTIME (đóng gói vào Lambda)
├── prepare-requirements.txt    # Deps để CHUẨN BỊ model (KHÔNG đóng gói vào Lambda)
├── README.md
├── DEPLOY-cmd.md                # Runbook deploy đầy đủ (Windows cmd)
└── model/                       # Sinh ra bởi prepare_model.py, KHÔNG commit git
    ├── model_quantized.onnx     # ~80-90 MB, INT8 quantized
    ├── tokenizer.json
    └── config.json
```

### 3.2 Lambda Function (`lambda_function.py`) — tóm tắt thật

- Xác thực token Supabase **in-Lambda** (cùng pattern `agent-bff`/`ambient-audio-manager`): lấy
  `Authorization: Bearer <token>`, gọi `GET {SUPABASE_URL}/rest/v1/users?id=eq.{sub}` để PostgREST
  verify chữ ký ES256 + RLS. KHÔNG dùng JWT authorizer của API Gateway (không hỗ trợ ES256).
- Load model + tokenizer **1 lần** lúc cold start (`_load_model()`, cache module-level), dùng
  `onnxruntime.InferenceSession(providers=['CPUExecutionProvider'])` + `tokenizers.Tokenizer.from_file()`
  — KHÔNG dùng `transformers.AutoTokenizer` lúc runtime (chỉ dùng lúc `prepare_model.py`).
- `_classify(text)`: tokenize (max 256 token, truncation+padding) → ONNX inference → softmax →
  argmax → map nhãn gốc (6 lớp) sang nhãn app (5 lớp) qua `MAP_TO_APP_LABEL`; confidence dưới
  `THRESHOLD_UNMOTIVATED` (mặc định 0.35) → gán `unmotivated`.
- `handler(event, context)`: passthrough OPTIONS (CORS) → verify user → parse `{ "text": "..." }`
  từ body (giới hạn 1000 ký tự, **truncate không reject**) → trả `{ "label": "...", "confidence": 0.xx }`.
  **KHÔNG ghi Supabase** — stateless theo thiết kế; frontend tự lưu `emotion_label`/`emotion_confidence`
  cùng lúc lưu session.

Code đầy đủ: `aws/lambdas/emotion-detector/lambda_function.py`.

### 3.3 `requirements.txt` (runtime thật, nhẹ — không có transformers/torch/psycopg2)

```
onnxruntime>=1.18,<2
numpy>=1.26,<3
tokenizers>=0.19,<1
```

## 4. Model Conversion Pipeline (One-Time, chạy bởi `prepare_model.py`)

Deps riêng cho bước này nằm ở `prepare-requirements.txt` (`torch`, `transformers[sentencepiece]`,
`optimum[onnxruntime]`, `onnx`, `onnxruntime` — nặng, ~1-2GB, **không đóng gói vào Lambda**).

```bash
# Bước 0: tạo venv riêng, cài prepare-requirements.txt
pip install -r prepare-requirements.txt

# Bước 1: export ONNX + quantize INT8 (làm trong prepare_model.py)
python prepare_model.py
# -> dùng optimum.onnxruntime.ORTModelForSequenceClassification.from_pretrained(MODEL_ID, export=True)
# -> quantize bằng onnxruntime.quantization.quantize_dynamic()
# -> lưu tokenizer.json qua AutoTokenizer.from_pretrained(MODEL_ID).save_pretrained(OUT_DIR)
# -> in ra id2label thật của model để đối chiếu MODEL_LABELS trong lambda_function.py
```

Chi tiết đầy đủ (gồm cả bước đóng gói zip qua S3 vì >50MB, deploy Lambda, nối API Gateway) xem
`aws/lambdas/emotion-detector/DEPLOY-cmd.md`.

## 5. Cold Start

| Technique | Detail |
|---|---|
| **Lambda Layer** | KHÔNG dùng — deps đóng gói thẳng vào function zip (giống `agent-action-handler`) |
| **Provisioned Concurrency** | Không dùng (Free Tier); cold start ước tính vài giây do model load |
| **Lazy Loading** | Model + tokenizer load 1 lần trong `_load_model()`, cache module-level — tái dùng ở warm invocation |
| **Memory** | 512 MB |
| **Timeout** | 15 giây |

## 6. Testing

`test_local.py` chạy 5 câu test (1 câu/nhãn) thẳng qua `_classify()`, không cần deploy AWS — dùng
trước khi zip/upload Lambda. Test cases tham khảo:

- **Happy path:** "I was completely focused" → nhãn app hợp lý (qua mapping 6→5, xem cảnh báo đầu file)
- **Max length:** text >1000 ký tự bị truncate còn 1000 (không reject)
- **Non-English:** model gốc train tiếng Anh; journal tiếng Việt sẽ kém chính xác hơn (ngoài phạm vi hiện tại)
- **Sau khi deploy thật:** `curl` theo `DEPLOY-cmd.md` Bước 7 để test qua API Gateway thật.
