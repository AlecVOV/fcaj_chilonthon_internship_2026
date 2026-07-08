#!/bin/bash
# Đóng gói + deploy agent-action-handler.
# QUAN TRỌNG: supabase-py có dep nhị phân (pydantic-core) -> phải lấy wheel LINUX,
# không dùng wheel của máy dev (Windows/Mac) nếu không Lambda sẽ ImportError cold start.
set -e
FUNCTION_NAME=${1:-agent-action-handler}
rm -rf package function.zip

pip install \
  --platform manylinux2014_x86_64 \
  --implementation cp --python-version 3.12 \
  --only-binary=:all: --upgrade \
  --target package -r requirements.txt

cp lambda_function.py package/
( cd package && zip -qr ../function.zip . )

aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file fileb://function.zip \
  --region "${AWS_REGION:-ap-southeast-1}"

echo "Deployed $FUNCTION_NAME"
