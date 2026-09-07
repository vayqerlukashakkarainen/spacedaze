"""Assemble previews without changing the individual PixelLab sprite files."""
import html
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).parent
buildings = json.loads((root / "manifest.json").read_text())
font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 13)
small = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 11)
title = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 23)
sheet = Image.new("RGB", (1440, 680), "#080d13")
draw = ImageDraw.Draw(sheet)
draw.text((24, 20), "SPACEDAZE / HUB EXPANSION", font=title, fill="#eef4f4")
draw.text((24, 54), "10 PIXELLAB CONCEPTS   /   NATIVE PIXEL SIZES   /   LEVELS 1-8", font=small, fill="#6db8cb")
cards = []
for index, building in enumerate(buildings):
    path = root / "sprites-v2" / (building["id"] + ".png")
    sprite = Image.open(path).convert("RGBA")
    assert sprite.size == (building["width"], building["height"]), path
    pixels = list(sprite.get_flattened_data())
    assert {pixel[3] for pixel in pixels} <= {0, 255}, path
    colors = {pixel[:3] for pixel in pixels if pixel[3]}
    assert colors <= {(0, 0, 0), (255, 255, 255)}, (path, colors)
    x = 16 + index % 5 * 284
    y = 88 + index // 5 * 288
    draw.rectangle((x, y, x + 272, y + 274), fill="#0c141d", outline="#223340")
    draw.text((x + 12, y + 12), f"{index + 1:02d} / {building['name'].upper()}", font=font, fill="#eef4f4")
    draw.text((x + 12, y + 36), f"LEVEL {building['level']}    {sprite.width} x {sprite.height} PX", font=small, fill="#6db8cb")
    sheet.paste(sprite, (x + (272 - sprite.width) // 2, y + 63 + (202 - sprite.height) // 2), sprite)
    name = html.escape(building["name"])
    composed = Image.open(root / "composed" / f"{building['id']}.png")
    foundation = building["foundation"]["sprite"]
    cards.append(f'<article data-level="{building["level"]}"><header><b>{index+1:02d} / {name}</b><span>LEVEL {building["level"]} · {foundation.upper()}</span></header><div class="art"><img src="composed/{building["id"]}.png" width="{composed.width}" height="{composed.height}" data-building="sprites-v2/{building["id"]}.png" data-building-width="{sprite.width}" data-building-height="{sprite.height}" data-composed="composed/{building["id"]}.png" data-composed-width="{composed.width}" data-composed-height="{composed.height}" alt="{name}"></div><div class="links"><a href="sprites-v2/{building["id"]}.png" download>Building PNG</a><a href="../../../{building["foundation"]["source"]}" download>Ground PNG</a></div></article>')
sheet.save(root / "contact-sheet.png")
page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SpaceDaze hub buildings</title><style>
*{box-sizing:border-box}body{margin:0;background:#080d13;color:#eef4f4;font:14px monospace;padding:32px}h1{font-size:26px;margin:0 0 12px}p{color:#98aab8;max-width:780px;line-height:1.6}nav,.links{display:flex;gap:24px;flex-wrap:wrap;margin:24px 0}select{background:#14212d;color:white;border:1px solid #39576a;padding:8px;font:inherit}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}article{background:#0c141d;border:1px solid #223340;padding:16px;overflow:auto}header{display:grid;gap:8px}header span{color:#6db8cb;font-size:12px}.art{min-height:300px;display:flex;align-items:center;justify-content:center;padding:16px}img{image-rendering:pixelated;object-fit:contain;max-width:none}a{color:#6db8cb}article[hidden]{display:none}
</style><h1>SPACEDAZE / FLOATING HUB SETTLEMENT</h1><p>Each bright building remains a separate sprite over a reusable, dimly tinted flat ground slab. Mix the six sizes across the hub without redrawing a structure.</p><nav><label>View <select id="view"><option value="composed">Building on ground</option><option value="building">Building only</option></select></label><label>Preview scale <select id="scale"><option value="1">1× native</option><option value="2">2× pixels</option><option value="3">3× pixels</option></select></label><label>Hub progression <select id="level"><option value="8">Level 8 — all buildings</option>'''
page += ''.join(f'<option value="{level}">Level {level}</option>' for level in range(1, 8))
page += '</select></label><a href="README.md">Design notes</a><a href="ruins-contact-sheet.png">Ruins and replacements</a><a href="ground-pieces-contact-sheet.png">Ground pieces</a><a href="foundations-contact-sheet.png">Combined sheet</a><a href="contact-sheet.png">Building sheet</a></nav><main class="grid">' + ''.join(cards) + '''</main><script>
const refreshImages=()=>{const view=document.querySelector('#view').value;const scale=Number(document.querySelector('#scale').value);document.querySelectorAll('img').forEach(img=>{img.src=img.dataset[view];img.style.width=Number(img.dataset[view+'Width'])*scale+'px';img.style.height=Number(img.dataset[view+'Height'])*scale+'px'})}
document.querySelector('#view').onchange=refreshImages
document.querySelector('#scale').onchange=refreshImages
document.querySelector('#level').onchange=e=>document.querySelectorAll('article').forEach(card=>card.hidden=Number(card.dataset.level)>Number(e.target.value))
</script></html>'''
(root / "index.html").write_text(page)
print(f"Verified {len(buildings)} native monochrome sprites; generated contact sheet and gallery")
