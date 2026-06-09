#!/bin/bash
FUNCTION_NAME=${1:-agent-bff}
pip install -r requirements.txt -t package/
cp lambda_function.py package/
cd package && zip -r ../function.zip . && cd ..

aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file fileb://function.zip \
  --region "${AWS_REGION:-ap-southeast-1}"

echo "Deployed $FUNCTION_NAME"
