"""
test_local.py -- chay ONNX model + tokenizer da chuan bi (thu muc model/) NGAY TREN MAY,
khong can deploy len AWS. Dung de bat loi tokenizer/model/label truoc khi ton cong deploy.

Dung: pip install -r requirements.txt (requirements RUNTIME, khong phai prepare-requirements.txt)
      python test_local.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lambda_function as lf  # noqa: E402

CASES = [
    ("I was completely focused and got so much done today.", "focused (ky vong)"),
    ("Too many deadlines, I feel so stressed and overwhelmed.", "stressed (ky vong)"),
    ("I can't think anymore, I'm completely drained and exhausted.", "exhausted (ky vong)"),
    ("It was a calm, peaceful session, no rush at all.", "relaxed (ky vong)"),
    ("I don't know, I just couldn't get myself to start anything.", "unmotivated (ky vong, kho doan)"),
]

if __name__ == "__main__":
    print(f"Model dir: {lf.MODEL_DIR}")
    print(f"MODEL_LABELS (thu tu gia dinh trong lambda_function.py): {lf.MODEL_LABELS}")
    print("-> Doi chieu voi 'Model's REAL id2label order' ma prepare_model.py da in ra.")
    print()
    for text, expectation in CASES:
        label, confidence = lf._classify(text)
        print(f"[{expectation:28s}] -> label={label:12s} confidence={confidence}")
        print(f"    text: {text!r}")
