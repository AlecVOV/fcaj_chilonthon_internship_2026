# Lambda Layers

> ⚠️ **Đã quyết định KHÔNG dùng layer nào (2026-07-13)** — 2 spec bên dưới (`onnx-transformers`,
> `sentence-transformers`) là **kế hoạch ban đầu, chưa từng tạo layer thật, và giờ không cần nữa**:
> - `emotion-detector`: DistilBERT ONNX + `onnxruntime`/`tokenizers` được đóng gói **thẳng vào
>   function zip** (không qua layer) — xem `aws/lambdas/emotion-detector/DEPLOY-cmd.md`. Không dùng
>   `transformers` lúc runtime (chỉ `tokenizers` nhẹ hơn nhiều).
> - `admin-vectorizer` / `rag-recommender`: **không đóng gói ML nào cả** — gọi thẳng Bedrock API
>   (Cohere Embed Multilingual v3) qua `boto3` (đã có sẵn trong Lambda runtime). Không cần
>   `sentence-transformers`, không cần layer.
>
> Giữ file này lại làm tài liệu lịch sử (lý do đã cân nhắc layer rồi bỏ), không phải hướng dẫn
> triển khai — đừng tạo layer theo runbook dưới đây trừ khi thật sự đổi lại kiến trúc.

Lambda Layers are reusable Python packages attached to Lambda functions.
They reduce deployment package size and speed up cold starts.

## Layers (KHÔNG dùng — giữ làm lịch sử thiết kế)

### `onnx-transformers` — không tạo, `emotion-detector` bundle deps trực tiếp thay vào
**Kế hoạch ban đầu:** `emotion-detector`
**Contents:** `onnxruntime` + `transformers` (tokenizer only, no PyTorch)
**Size:** ~120 MB

```bash
mkdir -p python
pip install onnxruntime transformers -t python/
zip -r onnx-transformers-layer.zip python/
aws lambda publish-layer-version \
  --layer-name onnx-transformers \
  --zip-file fileb://onnx-transformers-layer.zip \
  --compatible-runtimes python3.12 \
  --region ap-southeast-1
```

### `sentence-transformers` — không tạo, `admin-vectorizer` gọi Bedrock API thay vào
**Kế hoạch ban đầu:** `admin-vectorizer`
**Contents:** `sentence-transformers` + dependencies
**Size:** ~200 MB

```bash
mkdir -p python
pip install sentence-transformers -t python/
zip -r sentence-transformers-layer.zip python/
aws lambda publish-layer-version \
  --layer-name sentence-transformers \
  --zip-file fileb://sentence-transformers-layer.zip \
  --compatible-runtimes python3.12 \
  --region ap-southeast-1
```

## Note

Lambda Layers have a 250 MB unzipped limit. Đây chính xác là lý do project đổi hướng: thay vì
vật lộn với giới hạn 250MB cho `sentence-transformers` (~200MB) hoặc `onnx-transformers`
(~120MB) cộng thêm model weights, chọn (a) bundle deps nhẹ trực tiếp vào zip khi có thể
(`emotion-detector`: `onnxruntime`+`tokenizers` ~204MB uncompressed, an toàn dưới 250MB, không
cần layer) hoặc (b) gọi hẳn ra ngoài qua Bedrock API khi model không cần custom-host
(`admin-vectorizer`/`rag-recommender`) — cả 2 cách đều tránh được layer hoàn toàn.
