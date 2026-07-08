#!/bin/bash
# Cập nhật code cho Lambda ambient-audio-manager (đã tạo sẵn function + env vars).
# Dùng: AWS_REGION=ap-southeast-1 ./deploy.sh [function-name]
FUNCTION_NAME=${1:-ambient-audio-manager}

# boto3 có sẵn trong runtime → không cần cài gì; chỉ zip source.
rm -f function.zip
zip -j function.zip lambda_function.py

aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file fileb://function.zip \
  --region "${AWS_REGION:-ap-southeast-1}"

echo "Deployed $FUNCTION_NAME"
