"""Make a fake 'phone photo' of the sample letter: tilt, keystone, uneven light, shadow, blur, noise, JPEG.

Still synthetic (no glare, curl or focus problems), but much harsher than b_scan.pdf.
  .venv/bin/python tests/b_photo.py      # writes samples/b_photo.jpg and samples/b_photo.pdf
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.pro.pdfio import render_page  # noqa: E402


def _solve(a: list[list[float]], b: list[float]) -> list[float]:
    """Gaussian elimination (8x8), so we don't need numpy."""
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[p] = m[p], m[c]
        for r in range(n):
            if r != c:
                f = m[r][c] / m[c][c]
                m[r] = [x - f * y for x, y in zip(m[r], m[c])]
    return [m[i][n] / m[i][i] for i in range(n)]


def _perspective_coeffs(dst: list[tuple[float, float]], src: list[tuple[float, float]]) -> list[float]:
    """Coefficients PIL needs to map output points (dst) back to input points (src)."""
    a, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return _solve(a, b)


def make(letter_pdf: Path, out_jpg: Path, seed: int = 7) -> Path:
    rnd = random.Random(seed)
    page = render_page(letter_pdf, 0, 200)                      # the paper, ~1654 x 2339 px
    pw, ph = page.size
    W, H = int(pw * 1.18), int(ph * 1.12)

    # Table-top background: warm grey gradient.
    bg = Image.linear_gradient("L").resize((W, H)).convert("RGB")
    bg = Image.blend(Image.new("RGB", (W, H), (120, 105, 90)), bg, 0.25)

    # Keystone: the top edge is narrower, as when a phone is held at an angle; slight rotation.
    m = 0.06
    dst = [(W * 0.09 + pw * m, H * 0.05), (W * 0.09 + pw * (1 - m * 0.4), H * 0.04),
           (W * 0.09 + pw * 1.02, H * 0.05 + ph * 0.98), (W * 0.09 - pw * 0.01, H * 0.05 + ph)]
    src = [(0, 0), (pw, 0), (pw, ph), (0, ph)]
    coeffs = _perspective_coeffs(dst, src)
    paper = page.transform((W, H), Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor=(0, 0, 0))
    mask = Image.new("L", page.size, 255).transform((W, H), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    bg.paste(paper, (0, 0), mask)
    img = bg.rotate(-2.2, resample=Image.BICUBIC, fillcolor=(110, 96, 82))

    # Uneven light: brighter top-left, darker bottom-right, plus a soft shadow in one corner.
    light = Image.radial_gradient("L").resize((W * 2, H * 2)).crop((int(W * 0.2), int(H * 0.2), int(W * 1.2), int(H * 1.2)))
    light = light.point(lambda v: 255 - int(v * 0.35))
    img = Image.composite(img, Image.new("RGB", img.size, (0, 0, 0)), light)
    shadow = Image.new("L", img.size, 0)
    ImageDraw.Draw(shadow).ellipse([int(W * 0.55), int(H * 0.62), int(W * 1.4), int(H * 1.5)], fill=110)
    shadow = shadow.filter(ImageFilter.GaussianBlur(120))
    img = Image.composite(Image.new("RGB", img.size, (20, 18, 16)), img, shadow)

    # Camera softness, sensor noise, phone JPEG.
    img = img.filter(ImageFilter.GaussianBlur(1.1))
    noise = Image.effect_noise(img.size, 28).convert("RGB")
    img = Image.blend(img, noise, 0.07)
    img = img.resize((int(W * 0.8), int(H * 0.8)), Image.LANCZOS)   # phones downscale too
    img.save(out_jpg, quality=55)
    _ = rnd  # seed kept for future jitter
    return out_jpg


if __name__ == "__main__":
    s = ROOT / "samples"
    jpg = make(s / "b_pii_letter.pdf", s / "b_photo.jpg")
    Image.open(jpg).convert("RGB").save(s / "b_photo.pdf", resolution=160)
    print(jpg, s / "b_photo.pdf")
