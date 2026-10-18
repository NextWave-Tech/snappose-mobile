"""Builds the SnapPose intro Lottie from the logo's own layers (split_logo.py), embedded as PNGs.

512x512, 60 fps, 2 s, transparent. Order: tile, the big circle (lens) pops in, the top and bottom
halves of the "S" slide into their slots, the small dot blinks once. A designer's After Effects
export can replace the output file as is.
"""
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image

layers_dir, out_path = Path(sys.argv[1]), Path(sys.argv[2])
END = 120


def static(value):
    return {"a": 0, "k": value}


def keys(*frames):
    out = []
    for i, (t, value) in enumerate(frames):
        key = {"t": t, "s": value if isinstance(value, list) else [value]}
        if i < len(frames) - 1:
            n = len(key["s"])
            key["o"] = {"x": [0.3] * n, "y": [0] * n}
            key["i"] = {"x": [0.2] * n, "y": [1] * n}
        out.append(key)
    return {"a": 1, "k": out}


assets, placed = [], {}
for index, name in enumerate(["bg", "top", "bottom", "lens", "dot"]):
    img = Image.open(layers_dir / f"{name}.png").convert("RGBA")
    left, top, right, bottom = img.getbbox()
    crop = img.crop((left, top, right, bottom))
    buf = io.BytesIO()
    crop.save(buf, "PNG", optimize=True)
    assets.append({
        "id": f"img_{name}", "w": crop.width, "h": crop.height, "u": "", "e": 1,
        "p": "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(),
    })
    placed[name] = {"cx": (left + right) / 2, "cy": (top + bottom) / 2, "w": crop.width, "h": crop.height}
    print(f"{name}: {crop.width}x{crop.height}, {len(buf.getvalue()) // 1024} KB")


def image_layer(ind, name, position=None, opacity=None, scale=None, anchor=None):
    p = placed[name]
    return {
        "ddd": 0, "ind": ind, "ty": 2, "nm": name, "refId": f"img_{name}", "sr": 1,
        "ks": {
            "o": opacity or static(100),
            "r": static(0),
            "p": position or static([p["cx"], p["cy"], 0]),
            "a": static(anchor or [p["w"] / 2, p["h"] / 2, 0]),
            "s": scale or static([100, 100, 100]),
        },
        "ao": 0, "ip": 0, "op": END, "st": 0, "bm": 0,
    }


top, bottom = placed["top"], placed["bottom"]
layers = [
    # Lottie draws the first layer on top.
    image_layer(1, "dot",
                opacity=keys((0, 0), (72, 0), (78, 100), (86, 15), (94, 100)),
                scale=keys((72, [100, 100, 100]), (80, [190, 190, 100]), (94, [100, 100, 100]))),
    image_layer(2, "lens",
                opacity=keys((8, 0), (14, 100)),
                scale=keys((8, [0, 0, 100]), (22, [112, 112, 100]), (30, [100, 100, 100]))),
    image_layer(3, "top",
                position=keys((30, [top["cx"], top["cy"] - 64, 0]), (58, [top["cx"], top["cy"], 0])),
                opacity=keys((30, 0), (42, 100))),
    image_layer(4, "bottom",
                position=keys((36, [bottom["cx"], bottom["cy"] + 64, 0]), (64, [bottom["cx"], bottom["cy"], 0])),
                opacity=keys((36, 0), (48, 100))),
    image_layer(5, "bg",
                opacity=keys((0, 0), (12, 100)),
                scale=keys((0, [92, 92, 100]), (16, [100, 100, 100]))),
]

animation = {"v": "5.7.4", "fr": 60, "ip": 0, "op": END, "w": 512, "h": 512, "nm": "SnapPose intro",
             "ddd": 0, "assets": assets, "layers": layers}
out_path.write_text(json.dumps(animation, separators=(",", ":")), encoding="utf-8")
print(f"wrote {out_path} ({out_path.stat().st_size // 1024} KB)")
