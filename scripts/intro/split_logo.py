"""Splits the SnapPose logo PNG into layers for the intro animation: background tile, top and
bottom halves of the "S", the lens (big circle) and the small dot.

The pieces are separated by color (the tile is blue, the S and lens are pink/white) and by
connected regions; the tile under the pieces is rebuilt from a smooth fit of its visible blue.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

src, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)

rgba = np.asarray(Image.open(src).convert("RGBA")).astype(np.float64)
H, W = rgba.shape[:2]
R, G, B, A = (rgba[..., i] for i in range(4))
inside = A > 0
blue = (B - R > 8) & inside
fg = inside & ~blue

# --- regions ---------------------------------------------------------------------------------
labels, count = ndimage.label(fg)
sizes = ndimage.sum(fg, labels, range(1, count + 1))
centers = ndimage.center_of_mass(fg, labels, range(1, count + 1))
regions = sorted(
    [{"id": i + 1, "size": int(sizes[i]), "cy": centers[i][0], "cx": centers[i][1]} for i in range(count)],
    key=lambda r: -r["size"],
)
regions = [r for r in regions if r["size"] >= 6]
for r in regions[:8]:
    print(f"region {r['id']}: {r['size']} px at ({r['cx']:.0f}, {r['cy']:.0f})")

pieces = sorted(regions[:2], key=lambda r: r["cy"])  # the two biggest: halves of the S
top_mask = labels == pieces[0]["id"]
bottom_mask = labels == pieces[1]["id"]

yy, xx = np.mgrid[0:H, 0:W]
rest = fg & ~top_mask & ~bottom_mask
lens_center = ndimage.center_of_mass(rest & ((xx - 253) ** 2 + (yy - 269) ** 2 < 62**2))
lcy, lcx = lens_center
lens_dist = np.hypot(xx - lcx, yy - lcy)
lens_radius = float(np.max(lens_dist[rest & (lens_dist < 62)])) + 1.5
lens_mask = lens_dist <= lens_radius
# The dot: the one sizeable region left outside the lens (stray pixels are ignored).
dot_region = next(
    r for r in regions[2:] if np.hypot(r["cx"] - lcx, r["cy"] - lcy) > lens_radius and r["size"] > 50
)
dot_mask = labels == dot_region["id"]
dot_cy, dot_cx = ndimage.center_of_mass(dot_mask)
dot_radius = float(np.max(np.hypot(xx - dot_cx, yy - dot_cy)[dot_mask])) + 2
print(f"lens at ({lcx:.1f}, {lcy:.1f}) r={lens_radius:.1f}; dot at ({dot_cx:.1f}, {dot_cy:.1f}) r={dot_radius:.1f}")

# --- background tile, rebuilt under the pieces -----------------------------------------------
clean_bg = blue & ~ndimage.binary_dilation(fg, iterations=12)
ys, xs = np.nonzero(clean_bg)
u, v = xs / W - 0.5, ys / H - 0.5
basis = lambda u, v: np.stack([np.ones_like(u), u, v, u * u, v * v, u * v, u**3, v**3, u * u * v, u * v * v], -1)
coef = [np.linalg.lstsq(basis(u, v), rgba[ys, xs, c], rcond=None)[0] for c in range(3)]
U, V = xx / W - 0.5, yy / H - 0.5
fitted = np.stack([basis(U, V) @ coef[c] for c in range(3)], -1)
# Keep the real pixels where the tile is visible, the fit where something covered it.
# The pieces cast a soft shadow on the tile, so the fit takes over a wide band around them and
# blends into the real pixels, leaving no outline of the S on the empty tile.
covered = ndimage.binary_dilation(fg, iterations=12)
weight = np.clip(ndimage.gaussian_filter(covered.astype(np.float64), 4), 0, 1)[..., None]
bg_rgb = weight * fitted + (1 - weight) * rgba[..., :3]
bg = np.dstack([np.clip(bg_rgb, 0, 255), A])


def soft(mask, grow=2, blur=0.9):
    """Mask grown a little (to keep anti-aliased edges) and feathered."""
    grown = ndimage.binary_dilation(mask, iterations=grow) if grow else mask
    return np.clip(ndimage.gaussian_filter(grown.astype(np.float64), blur), 0, 1)


def layer(alpha_mask):
    out = rgba.copy()
    out[..., 3] = A * alpha_mask
    return out


lens_soft = np.clip((lens_radius + 1 - lens_dist), 0, 1)
dot_soft = np.clip((dot_radius + 1 - np.hypot(xx - dot_cx, yy - dot_cy)), 0, 1)
layers = {
    "bg": bg,
    "top": layer(soft(top_mask) * (1 - lens_soft)),
    "bottom": layer(soft(bottom_mask) * (1 - lens_soft)),
    "lens": layer(lens_soft),
    "dot": layer(dot_soft),
}

for name, data in layers.items():
    img = Image.fromarray(np.clip(data, 0, 255).astype(np.uint8), "RGBA")
    box = img.getbbox()
    img.save(out_dir / f"{name}.png", optimize=True)
    print(f"{name}: bbox={box}")

# Recomposited, for a side-by-side check against the original.
check = Image.new("RGBA", (W, H))
for name in ["bg", "top", "bottom", "lens", "dot"]:
    check = Image.alpha_composite(check, Image.open(out_dir / f"{name}.png"))
check.save(out_dir / "recomposed.png")
diff = np.abs(np.asarray(check).astype(int) - np.asarray(Image.open(src).convert("RGBA")).astype(int))[..., :3]
print(f"recomposed vs original: mean abs diff {diff.mean():.2f}, max {diff.max()}")
