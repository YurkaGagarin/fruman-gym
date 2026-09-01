"""Сборка index.html из данных программы, глоссария и шаблона.

Запуск:  python3 build.py
Тесты:   node tests/basic.js && node tests/edge.js && node tests/progress.js && node tests/audio.js
"""
import json, re, ast, os

DAYS = ast.literal_eval(re.search(r"^DAYS = (\[.*?^\])", open("data/program.py", encoding="utf-8").read(), re.S | re.M).group(1))

exec(open("data/terms.py", encoding="utf-8").read())          # даёт TERMS
WORD = "[A-Za-z\\u0400-\\u04FF0-9]"

def _img(v):
    if not v: return None, None
    if v.startswith("ref:"): return None, v[4:]
    return "assets/gym/" + v + ".jpg", None

GLOSS = []
for k, t, d, img, pats in TERMS:
    photo, ref = _img(img)
    GLOSS.append({"k": k, "t": t, "d": d, "img": photo, "r": ref,
                  "p": [p.replace("\\w", WORD) for p in pats]})

IMG_KEYS = sorted({f[:-6] for f in os.listdir("assets/exercises") if f.endswith(".jpg")})

html = (open("template.html", encoding="utf-8").read()
        .replace("__IMGKEYS__", json.dumps(IMG_KEYS))
        .replace("__DAYS__", json.dumps(DAYS, ensure_ascii=False))
        .replace("__GLOSS__", json.dumps(GLOSS, ensure_ascii=False)))
open("index.html", "w", encoding="utf-8").write(html)
print("index.html собран:", len(html) // 1024, "КБ")
