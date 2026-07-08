#!/bin/bash
# Deploy agent-bff. Chỉ dùng stdlib + boto3 (đã có sẵn trong runtime) -> chỉ cần zip .py.
set -e
FUNCTION_NAME=${1:-agent-bff}
rm -f function.zip
zip -qj function.zip lambda_function.py

aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file fileb://function.zip \
  --region "${AWS_REGION:-ap-southeast-1}"

echo "Deployed $FUNCTION_NAME"
