"""
prepare_model.py -- CHAY 1 LAN o may local (KHONG chay trong Lambda, KHONG nam trong
goi deploy). Tai model DistilBERT emotion tu HuggingFace Hub, export sang ONNX, quantize
INT8, luu ra thu muc model/ de dong goi cung lambda_function.py.

Dung: pip install -r prepare-requirements.txt (tam thoi, xem DEPLOY-cmd.md Buoc 1)
      python prepare_model.py

Output (trong ./model/):
  model_quantized.onnx   -- model INT8 da quantize (~80-90 MB, con tuy)
  tokenizer.json          -- fast tokenizer (dung truc tiep boi `tokenizers`, KHONG can
                              cai transformers/torch luc runtime trong Lambda)
  config.json              -- id2label that cua model (doi chieu voi MODEL_LABELS trong
                               lambda_function.py -- IN RA de ban tu kiem tra)

Model: bhadresh-savani/distilbert-base-uncased-emotion (public, apache-2.0, ~26k
downloads, 92.7% accuracy tren dataset "emotion" goc -- 6 nhan: sadness/joy/love/
anger/fear/surprise). Day la model NEU RO trong RFP goc cua du an.
"""

import json
import os
import shutil

from optimum.onnxruntime import ORTModelForSequenceClassification
from transformers import AutoTokenizer
from onnxruntime.quantization import quantize_dynamic, QuantType

MODEL_ID = "bhadresh-savani/distilbert-base-uncased-emotion"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model")
TMP_DIR = os.path.join(OUT_DIR, "_tmp_export")


def main():
    os.makedirs(TMP_DIR, exist_ok=True)

    print(f"[1/4] Downloading + exporting '{MODEL_ID}' to ONNX")
    ort_model = ORTModelForSequenceClassification.from_pretrained(MODEL_ID, export=True)
    ort_model.save_pretrained(TMP_DIR)

    print("[2/4] Quantizing to INT8 (dynamic quantization, no calibration data needed)")
    fp32_path = os.path.join(TMP_DIR, "model.onnx")
    quantized_path = os.path.join(OUT_DIR, "model_quantized.onnx")
    quantize_dynamic(
        model_input=fp32_path,
        model_output=quantized_path,
        weight_type=QuantType.QInt8,
    )

    print("[3/4] Saving fast tokenizer (tokenizer.json)")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    if not tokenizer.is_fast:
        raise RuntimeError("Tokenizer khong phai 'fast' tokenizer -- can tokenizer.json de dung voi thu vien `tokenizers` doc lap trong Lambda.")
    tokenizer.save_pretrained(OUT_DIR)  # ghi tokenizer.json + cac file phu (khong can het luc deploy)

    print("[4/4] Reading model's real id2label mapping")
    with open(os.path.join(TMP_DIR, "config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    id2label = cfg.get("id2label", {})
    ordered_labels = [id2label[str(i)] for i in range(len(id2label))]
    with open(os.path.join(OUT_DIR, "config.json"), "w", encoding="utf-8") as f:
        json.dump({"id2label": id2label}, f, ensure_ascii=False, indent=2)

    shutil.rmtree(TMP_DIR, ignore_errors=True)

    fp32_size = None  # da bi xoa cung TMP_DIR, chi con ban quantized
    q_size = os.path.getsize(quantized_path) / 1e6
    tok_size = os.path.getsize(os.path.join(OUT_DIR, "tokenizer.json")) / 1e6

    print()
    print("=" * 70)
    print(f"model_quantized.onnx : {q_size:.1f} MB  -> {quantized_path}")
    print(f"tokenizer.json       : {tok_size:.1f} MB")
    print()
    print(f"Model's REAL id2label order: {ordered_labels}")
    print("So sanh voi MODEL_LABELS trong lambda_function.py -- neu thu tu KHAC thi")
    print("phai sua lambda_function.py cho khop (quan trong: sai thu tu = sai het nhan).")
    print("=" * 70)


if __name__ == "__main__":
    main()
