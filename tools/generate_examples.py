#!/usr/bin/env python3
"""Regenerate the bundled example codes from the original game sources.
Requires: pip install qrcode[pil]
Run from the repo root: python tools/generate_examples.py
"""
import base64
from pathlib import Path
import zlib
import qrcode
from qrcode.constants import ERROR_CORRECT_L
from qrcode.util import QRData, MODE_ALPHA_NUM

ROOT = Path(__file__).resolve().parents[1]
ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$*+-./:'

def pack43(data):
    out = str(len(data) % 2)
    for p in range(0, len(data), 2):
        val = (data[p] << 8) | (data[p + 1] if p + 1 < len(data) else 0)
        out += ALPHABET[val % 43] + ALPHABET[val // 43 % 43] + ALPHABET[val // 1849]
    return out

def main():
    source = ROOT / 'examples' / 'ironpass-micro-v3.html'
    html = source.read_bytes()
    codec = zlib.compressobj(9, zlib.DEFLATED, -15)
    packed = codec.compress(html) + codec.flush()
    payload = 'IP3:' + pack43(packed)
    assert len(payload) <= 4296, f'QR too large: {len(payload)}'
    (ROOT/'assets'/'ironpass-micro-v3.txt').write_text(payload,encoding='utf8')
    # Force alphanumeric mode, otherwise QR capacity may be needlessly reduced.
    qr = qrcode.QRCode(version=40,error_correction=ERROR_CORRECT_L,box_size=7,border=4)
    qr.add_data(QRData(payload,mode=MODE_ALPHA_NUM))
    qr.make(fit=False)
    qr.make_image(fill_color='black',back_color='white').save(ROOT/'assets'/'ironpass-micro-v3-qr.png')
    print(f'Ironpass: {len(html)} bytes HTML | {len(packed)} compressed | {len(payload)} QR chars | QR {qr.modules_count}x{qr.modules_count}')
if __name__ == '__main__': main()
