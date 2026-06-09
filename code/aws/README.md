# AWS — Serverless Backend + AI Infrastructure

This folder contains all AWS resources for the Focus Mode App:
Lambda functions, API Gateway config, Bedrock Agent setup, and IAM policies.

## What's Inside

| Path | Purpose |
|------|---------|
| `lambdas/` | 6 Python 3.12 Lambda functions (see below) |
| `layers/` | Lambda Layers for ONNX Runtime + Sentence Transformers |
| `api-gateway/` | OpenAPI spec for API Gateway routes + JWT authorizer |
| `bedrock/` | OpenAPI schema for Bedrock Agent Action Group |
| `iam/` | Lambda execution role + resource-based policies |

## Lambda Functions

| # | Function | Trigger | Memory | Timeout | AI Model |
|---|----------|---------|--------|---------|----------|
| 0 | `agent-bff` | API Gateway `POST /agent/chat` | 256 MB | 30s | Bedrock invoke |
| 1 | `agent-action-handler` | Bedrock Agent (via Action Group) | 256 MB | 10s | — |
| 2 | `emotion-detector` | API Gateway `POST /emotion/detect` | 512 MB | 15s | distilbert ONNX |
| 3 | `report-generator` | API Gateway `POST /report` + EventBridge | 1024 MB | 60s | — |
| 4 | `rag-recommender` | API Gateway `POST /rag/recommend` | 512 MB | 10s | pgvector |
| 5 | `admin-vectorizer` | API Gateway `POST /admin/vectorize` | 512 MB | 15s | MiniLM-L6-v2 |

## Quick Start

1. Read `iam/README.md` → create IAM role
2. Read `layers/README.md` → create Lambda Layers
3. Deploy each Lambda (see each sub-folder's `README.md`)
4. Read `api-gateway/README.md` → set up routes
5. Read `bedrock/README.md` → create Bedrock Agent
6. Update `web/.env` with API Gateway URL

## Post-Deploy Check

- [ ] Test each Lambda via AWS Console "Test" button
- [ ] Test API Gateway endpoint: `curl -X POST https://xxxx.execute-api.region.amazonaws.com/prod/emotion/detect`
- [ ] Test Bedrock Agent via Bedrock Console test panel
- [ ] Verify CloudWatch logs for all functions
