"""
emotion-detector -- API Gateway (HTTP API) -> Lambda -> ONNX DistilBERT inference.

Phan loai cam xuc tu journal text sau phien Focus, dung model DistilBERT (ONNX INT8
quantized) DONG GOI THANG trong Lambda -- khong goi Bedrock/model AI ngoai nao. Lambda
nay KHONG ghi DB truc tiep: chi tra {label, confidence}, frontend tu luu vao
focus_sessions luc saveSession() (dung pattern voi useEmotionDetector.ts hien tai).

AUTH (in-Lambda, giong agent-bff/ambient-audio-manager): access_token Supabase ky
ES256 -> API Gateway JWT authorizer (chi ho tro RS256) KHONG dung duoc. Tu xac thuc:
Bearer token -> decode sub -> GET {SUPABASE_URL}/rest/v1/users?id=eq.{sub} kem token
do -- PostgREST tu verify chu ky (moi thuat toan) + RLS. Khong hop le -> 401.

MODEL: bhadresh-savani/distilbert-base-uncased-emotion, export ONNX + quantize INT8
bang optimum-cli (xem prepare_model.py + DEPLOY-cmd.md, chay 1 LAN o may local, KHONG
chay trong Lambda). Model NATIVE tra 6 nhan (sadness/joy/love/anger/fear/surprise) tu
dataset public "emotion" -- app can 5 nhan rieng cho boi canh productivity
(focused/stressed/exhausted/relaxed/unmotivated). KHONG co model duoc fine-tune san cho
đung 5 nhan nay, nen MAP_TO_APP_LABEL ben duoi la anh xa THU CONG, xap xi -- khong phai
ket qua "chinh xac tuyet doi". Xem README.md muc "Do chinh xac" truoc khi tin ket qua.

Input:  { "text": "<journal text, <=1000 ky tu>" }
Output: { "label": "focused", "confidence": 0.83 }

Env: SUPABASE_URL, SUPABASE_ANON_KEY, MODEL_DIR (mac dinh: cung thu muc voi file nay),
     ALLOWED_ORIGINS (CSV domain, optional -- mac dinh '*'),
     THRESHOLD_UNMOTIVATED (0-1, mac dinh 0.35 -- xem ham _classify).
"""

import base64
import json
import os
import urllib.error
import urllib.request
import uuid

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get('ALLOWED_ORIGINS', '').split(',') if o.strip()]
MODEL_DIR = os.environ.get('MODEL_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model'))
MAX_INPUT = 1000
MAX_TOKENS = 256  # du cho journal <=1000 ky tu; giam so voi 512 de inference nhanh hon

# Nhan GOC cua model, dung THU TU id2label trong config.json cua model that
# (bhadresh-savani/distilbert-base-uncased-emotion) -- KIEM TRA LAI thu tu nay khop
# voi config.json thuc te sau khi export (xem prepare_model.py in ra de doi chieu).
MODEL_LABELS = ['sadness', 'joy', 'love', 'anger', 'fear', 'surprise']

# Anh xa THU CONG 6 nhan goc -> 5 nhan app dang dung. XAP XI, khong hoan hao (khong co
# model fine-tune rieng cho taxonomy nay) -- xem README.md muc "Do chinh xac".
MAP_TO_APP_LABEL = {
    'joy': 'focused',
    'love': 'relaxed',
    'surprise': 'focused',
    'anger': 'stressed',
    'fear': 'stressed',
    'sadness': 'exhausted',
}
# Khong nhan goc nao khop tot voi "unmotivated" (thieu dong luc/tri hoan) -- heuristic:
# van ban "phang", khong the hien cam xuc ro (confidence thap voi ca 6 nhan) thi coi la
# unmotivated. Nguong chinh qua env THRESHOLD_UNMOTIVATED neu thay chua hop.
THRESHOLD_UNMOTIVATED = float(os.environ.get('THRESHOLD_UNMOTIVATED', '0.35'))

_session = None
_tokenizer = None


class AuthError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status = status
        self.msg = msg


def _load_model():
    """Tai model + tokenizer 1 lan luc cold start, tai su dung o warm invocation."""
    global _session, _tokenizer
    if _session is None:
        model_path = os.path.join(MODEL_DIR, 'model_quantized.onnx')
        _session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    if _tokenizer is None:
        _tokenizer = Tokenizer.from_file(os.path.join(MODEL_DIR, 'tokenizer.json'))
        _tokenizer.enable_truncation(max_length=MAX_TOKENS)
        _tokenizer.enable_padding(length=MAX_TOKENS)
    return _session, _tokenizer


def _classify(text):
    session, tokenizer = _load_model()
    enc = tokenizer.encode(text)
    input_ids = np.array([enc.ids], dtype=np.int64)
    attention_mask = np.array([enc.attention_mask], dtype=np.int64)

    outputs = session.run(None, {'input_ids': input_ids, 'attention_mask': attention_mask})
    logits = outputs[0][0]
    probs = np.exp(logits - np.max(logits))
    probs = probs / probs.sum()
    idx = int(np.argmax(probs))
    model_label = MODEL_LABELS[idx]
    confidence = float(probs[idx])

    app_label = 'unmotivated' if confidence < THRESHOLD_UNMOTIVATED else MAP_TO_APP_LABEL.get(model_label, 'focused')
    return app_label, round(confidence, 4)


def _header(event, name):
    for k, v in (event.get('headers') or {}).items():
        if k.lower() == name:
            return v or ''
    return ''


def _cors(event):
    origin = _header(event, 'origin')
    if ALLOWED_ORIGINS:
        allow = origin if origin in ALLOWED_ORIGINS else ALLOWED_ORIGINS[0]
    else:
        allow = origin or '*'
    return {
        'Access-Control-Allow-Origin': allow,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Vary': 'Origin',
    }


def _resp(status, body, event):
    return {'statusCode': status, 'headers': {'Content-Type': 'application/json', **_cors(event)}, 'body': json.dumps(body)}


def _method(event):
    return event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method', '')


def _sub(token):
    try:
        seg = token.split('.')[1]
        seg += '=' * (-len(seg) % 4)
        return json.loads(base64.urlsafe_b64decode(seg.encode())).get('sub')
    except Exception:
        return None


def _verify_user(event):
    """Cung pattern voi agent-bff/ambient-audio-manager: de Supabase validate token
    (moi thuat toan ky, kha ES256) thay vi tu verify chu ky trong Lambda."""
    if not (SUPABASE_URL and SUPABASE_ANON_KEY):
        raise AuthError(500, 'Auth backend chua cau hinh (SUPABASE_URL/ANON_KEY).')
    auth = _header(event, 'authorization')
    if not auth.lower().startswith('bearer '):
        raise AuthError(401, 'Thieu Authorization: Bearer token.')
    token = auth[7:].strip()
    sub = _sub(token)
    try:
        uuid.UUID(str(sub))
    except (ValueError, TypeError):
        raise AuthError(401, 'Token khong hop le (sub sai).')
    url = f'{SUPABASE_URL}/rest/v1/users?id=eq.{sub}&select=id'
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {token}', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            rows = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise AuthError(401, 'Token khong hop le hoac da het han.')
        raise AuthError(403, f'Xac thuc that bai (HTTP {e.code}).')
    except Exception as e:  # noqa: BLE001
        raise AuthError(403, f'Xac thuc that bai: {e}')
    if not rows:
        raise AuthError(401, 'Token khong gan voi tai khoan hop le.')
    return sub


def handler(event, context):
    if _method(event) == 'OPTIONS':
        return _resp(200, {'ok': True}, event)
    try:
        _verify_user(event)  # fail-closed neu token sai; khong can user_id vi khong ghi DB

        body = json.loads(event.get('body') or '{}')
        text = (body.get('text') or '').strip()
        if not text:
            return _resp(400, {'message': 'text la bat buoc.'}, event)
        if len(text) > MAX_INPUT:
            text = text[:MAX_INPUT]

        label, confidence = _classify(text)
        return _resp(200, {'label': label, 'confidence': confidence}, event)

    except AuthError as e:
        print(f'AUTH DENY {e.status}: {e.msg}')
        return _resp(e.status, {'message': e.msg}, event)
    except Exception as e:  # noqa: BLE001 -- khong ro ri chi tiet ra client
        print(f'ERROR emotion-detector: {e}')
        return _resp(500, {'message': 'Loi noi bo, thu lai sau.'}, event)
