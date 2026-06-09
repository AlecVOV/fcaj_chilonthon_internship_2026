# Lambda Layers

Lambda Layers are reusable Python packages attached to Lambda functions.
They reduce deployment package size and speed up cold starts.

## Layers

### `onnx-transformers`
**Used by:** `emotion-detector`
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

### `sentence-transformers`
**Used by:** `admin-vectorizer`
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

Lambda Layers have a 250 MB unzipped limit. If the sentence-transformers
layer exceeds this, split it into two layers or use a smaller model.
