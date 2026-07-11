# Emotion Detector — Lambda Function

> ✅ **DEPLOYED & LIVE (2026-07-12)** — deploy theo **[`DEPLOY-cmd.md`](DEPLOY-cmd.md)**,
> đã test qua `curl` với token thật (200 + `{"label":...,"confidence":...}`) và xác nhận
> CloudWatch không lỗi. Route `POST /emotion` trên HTTP API `ffepnb6gei`. Frontend
> (`web/composables/useEmotionDetector.ts`) tự động dùng route thật khi
> `NUXT_PUBLIC_API_GATEWAY_URL` đã set (không còn rơi về fallback keyword-regex).

**Purpose:** Phân loại cảm xúc từ journal text sau phiên Focus, dùng model
**DistilBERT (ONNX INT8 quantized) đóng gói THẲNG trong Lambda** — không gọi Bedrock hay
bất kỳ API AI ngoài nào lúc runtime.

## Model

| Property | Value |
|----------|-------|
| Model gốc | [`bhadresh-savani/distilbert-base-uncased-emotion`](https://huggingface.co/bhadresh-savani/distilbert-base-uncased-emotion) (public, apache-2.0, ~26k lượt tải, 92.7% accuracy trên dataset gốc) |
| Format | ONNX, quantize INT8 (dynamic quantization) |
| Kích thước | ~80-90 MB (tùy bản export) |
| Input | Journal text (≤1000 ký tự) |
| Output | `{ label: "focused", confidence: 0.89 }` |

### ⚠️ Độ chính xác — đọc trước khi tin kết quả

Model gốc phân loại theo **6 nhãn chuẩn** của dataset public `emotion`: `sadness, joy,
love, anger, fear, surprise`. App này cần **5 nhãn riêng cho bối cảnh làm việc**:
`focused, stressed, exhausted, relaxed, unmotivated`. **Không tồn tại model public nào
được fine-tune sẵn cho đúng 5 nhãn này** — `lambda_function.py` dùng 1 bảng ánh xạ
**thủ công, xấp xỉ** (`MAP_TO_APP_LABEL`) để quy đổi 6→5 nhãn, cộng thêm 1 heuristic
(confidence thấp → `unmotivated`, vì không có nhãn gốc nào khớp tốt với "thiếu động
lực"). Đây là đánh đổi hợp lý cho quy mô demo/bootcamp — **không nên coi là phân loại
cảm xúc "chính xác cao"**; muốn chính xác hơn thì cần fine-tune model riêng trên dữ
liệu journal thật có gán nhãn theo đúng 5 lớp này (ngoài phạm vi hiện tại).

## Kiến trúc

- **`lambda_function.py`** — Lambda handler thật: xác thực token Supabase in-Lambda
  (cùng pattern `agent-bff`/`ambient-audio-manager`, KHÔNG dùng JWT authorizer vì token
  ES256), load model ONNX + tokenizer 1 lần lúc cold start, suy luận bằng
  `onnxruntime` + `tokenizers` (KHÔNG cần `transformers`/`torch` lúc chạy thật).
- **`prepare_model.py`** — script chạy **1 lần ở máy local** để tải model từ
  HuggingFace Hub, export ONNX, quantize INT8, lưu vào `model/` (file model **không**
  commit vào git — bạn tự chạy để tạo ra).
- **`test_local.py`** — test nhanh model trên máy, không cần deploy AWS.
- **`requirements.txt`** — deps RUNTIME, đóng gói vào Lambda (`onnxruntime`, `numpy`,
  `tokenizers` — nhẹ).
- **`prepare-requirements.txt`** — deps để CHUẨN BỊ model (`torch`, `transformers`,
  `optimum` — nặng, ~1-2GB, KHÔNG đóng gói vào Lambda).

## Deploy

Xem **[`DEPLOY-cmd.md`](DEPLOY-cmd.md)** — gồm cả bước chuẩn bị model (Bước 0-2), đóng
gói + deploy Lambda (Bước 3-5), và nối API Gateway + frontend (Bước 6-7). Gói deploy
>50MB nên phải qua S3, khác với các Lambda nhỏ hơn trong repo này — đọc kỹ cảnh báo đầu
file trước khi chạy.

## Environment Variables

| Key | Bắt buộc | Ghi chú |
|-----|-----|--------|
| `SUPABASE_URL` | ✅ | để verify token qua PostgREST |
| `SUPABASE_ANON_KEY` | ✅ | apikey cho PostgREST |
| `ALLOWED_ORIGINS` | tùy chọn | CSV domain cho CORS (mặc định `*`) |
| `MODEL_DIR` | tùy chọn | mặc định cùng thư mục với `lambda_function.py` |
| `THRESHOLD_UNMOTIVATED` | tùy chọn | mặc định `0.35` — ngưỡng confidence để coi là "unmotivated" |

## Lambda Config

| Setting | Value |
|---------|-------|
| Runtime | Python 3.12 |
| Memory | 512 MB |
| Timeout | 15 giây |
| Role | `focus-ai-lambda-role` (đã có sẵn, chỉ cần `logs:*` — Lambda này không gọi AWS API nào khác) |
| Layer | Không dùng — deps đóng gói thẳng vào function zip (giống `agent-action-handler`) |
