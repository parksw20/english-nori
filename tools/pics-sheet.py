# -*- coding: utf-8 -*-
"""
낱말 사진 모아보기 — words_pic의 사진을 한 장의 표(contact sheet)로 붙여 낱말과 함께 보여준다.

왜 필요한가: 사진 258장이 맞게 받아졌는지는 통계로 못 잡는다(duck에 도날드덕 쇼윈도가 들어와도
파일은 멀쩡하다). 사람이 **한눈에** 훑어야 한다 → 낱말·한글 뜻을 달아 8열 격자로 붙인다.

사용: python tools/pics-sheet.py  → src/data/words_pic/_sheet-1.jpg, _sheet-2.jpg …
"""
import io, json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
PIC = ROOT / 'src' / 'data' / 'words_pic'
COLS, CELL, LABEL, PER_SHEET = 8, 160, 34, 64

credits = json.loads((PIC / 'credits.json').read_text(encoding='utf-8'))
slugs = sorted(credits.keys())
try:
    font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 16)
except OSError:
    font = ImageFont.load_default()

for n, start in enumerate(range(0, len(slugs), PER_SHEET), 1):
    chunk = slugs[start:start + PER_SHEET]
    rows = (len(chunk) + COLS - 1) // COLS
    sheet = Image.new('RGB', (COLS * CELL, rows * (CELL + LABEL)), 'white')
    draw = ImageDraw.Draw(sheet)
    for i, slug in enumerate(chunk):
        x, y = (i % COLS) * CELL, (i // COLS) * (CELL + LABEL)
        p = PIC / f'{slug}.jpg'
        if p.exists():
            sheet.paste(Image.open(p).resize((CELL, CELL)), (x, y))
        c = credits[slug]
        draw.text((x + 4, y + CELL + 2), f"{c['en']} {c['ko']}", fill='black', font=font)
        draw.text((x + 4, y + CELL + 18), c.get('how', ''), fill='gray', font=font)
    out = PIC / f'_sheet-{n}.jpg'
    sheet.save(out, 'JPEG', quality=80)
    print(out.name, len(chunk), '장')
