"""create: images to PDF, and text or Markdown to PDF (reportlab)."""
from __future__ import annotations

import html
import re
from pathlib import Path

from PIL import Image, ImageOps
from reportlab import rl_config
from reportlab.lib.pagesizes import A4, LETTER, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import ListFlowable, ListItem, Paragraph, Preformatted, SimpleDocTemplate, Spacer

from app.core.tooling import Output, RunContext, ToolError, ToolResult, ToolSpec

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tif", ".tiff", ".webp"}
TEXT_EXT = {".txt", ".md", ".markdown", ".text"}
SIZES = {"A4": A4, "Letter": LETTER}

# Store image data as raw binary, not ASCII85 text (which is 25% bigger).
rl_config.useA85 = 0


def _pagesize(params: dict):
    size = SIZES.get(params.get("page_size", "A4"), A4)
    return landscape(size) if params.get("landscape") else size


def _image_source(p: Path):
    """What to hand reportlab. An upright RGB/grey JPEG goes in as its own file,
    so it's embedded as-is (DCTDecode) instead of decoded and stored losslessly,
    which made photo PDFs ~5x bigger than the photos."""
    raw = Image.open(p)
    if raw.format == "JPEG" and raw.mode in ("RGB", "L") and raw.getexif().get(0x0112, 1) == 1:
        return str(p), raw.size
    img = ImageOps.exif_transpose(raw)
    if img.mode not in ("RGB", "L"):
        bg = Image.new("RGB", img.size, "white")
        bg.paste(img, mask=img.convert("RGBA").split()[-1])
        img = bg
    return ImageReader(img), img.size


def images_to_pdf(images: list[Path], out: Path, params: dict) -> int:
    fit = params.get("fit", "page")  # page: on a fixed page size; image: page = image size
    margin = float(params.get("margin_mm", 10)) * mm
    c = canvas.Canvas(str(out))
    for p in images:
        src, (iw, ih) = _image_source(p)
        if fit == "image":
            pw, ph = iw * 72 / 150, ih * 72 / 150  # treat images as 150 dpi
            c.setPageSize((pw, ph))
            c.drawImage(src, 0, 0, pw, ph)
        else:
            pw, ph = _pagesize(params)
            if params.get("auto_orient", True) and (iw > ih) != (pw > ph):
                pw, ph = ph, pw
            c.setPageSize((pw, ph))
            scale = min((pw - 2 * margin) / iw, (ph - 2 * margin) / ih)
            w, h = iw * scale, ih * scale
            c.drawImage(src, (pw - w) / 2, (ph - h) / 2, w, h)
        c.showPage()
    c.save()
    return len(images)


_INLINE = [
    (re.compile(r"`([^`]+)`"), r'<font face="Courier">\1</font>'),
    (re.compile(r"\*\*(.+?)\*\*"), r"<b>\1</b>"),
    (re.compile(r"__(.+?)__"), r"<b>\1</b>"),
    (re.compile(r"(?<![\*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\*)"), r"<i>\1</i>"),
    (re.compile(r"\[([^\]]+)\]\(([^)]+)\)"), r'<link href="\2" color="blue">\1</link>'),
]


def _inline(text: str) -> str:
    s = html.escape(text, quote=False)
    for rx, rep in _INLINE:
        s = rx.sub(rep, s)
    return s


def markdown_flowables(text: str, markdown: bool = True) -> list:
    ss = getSampleStyleSheet()
    body = ss["BodyText"]
    body.spaceAfter = 6
    if not markdown:
        return [Paragraph(_inline(line) if line.strip() else "&nbsp;", body) for line in text.splitlines()] or [Spacer(1, 1)]
    flow: list = []
    para: list[str] = []
    items: list[str] = []
    ordered = False
    lines = text.splitlines()
    i = 0

    def flush_para():
        if para:
            flow.append(Paragraph(_inline(" ".join(para)), body))
            para.clear()

    def flush_list():
        nonlocal ordered
        if items:
            flow.append(ListFlowable(
                [ListItem(Paragraph(_inline(t), body)) for t in items],
                bulletType="1" if ordered else "bullet", leftIndent=14,
            ))
            items.clear()

    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if s.startswith("```"):
            flush_para(); flush_list()
            code = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code.append(lines[i]); i += 1
            flow.append(Preformatted("\n".join(code), ss["Code"]))
        elif m := re.match(r"^(#{1,6})\s+(.*)", s):
            flush_para(); flush_list()
            level = min(len(m.group(1)), 4)
            flow.append(Paragraph(_inline(m.group(2)), ss[f"Heading{level}"]))
        elif m := re.match(r"^([-*+])\s+(.*)", s):
            flush_para()
            if ordered and items:
                flush_list()
            ordered = False
            items.append(m.group(2))
        elif m := re.match(r"^\d+[.)]\s+(.*)", s):
            flush_para()
            if not ordered and items:
                flush_list()
            ordered = True
            items.append(m.group(1))
        elif re.match(r"^(-{3,}|\*{3,})$", s):
            flush_para(); flush_list()
            flow.append(Spacer(1, 12))
        elif not s:
            flush_para(); flush_list()
        else:
            flush_list()
            para.append(s)
        i += 1
    flush_para(); flush_list()
    return flow or [Spacer(1, 1)]


def text_to_pdf(text: str, out: Path, params: dict, markdown: bool, title: str) -> None:
    doc = SimpleDocTemplate(str(out), pagesize=_pagesize(params), title=title,
                            leftMargin=20 * mm, rightMargin=20 * mm, topMargin=20 * mm, bottomMargin=20 * mm)
    doc.build(markdown_flowables(text, markdown))


def run(inputs: list[Path], params: dict, ctx: RunContext) -> ToolResult:
    images = [p for p in inputs if p.suffix.lower() in IMAGE_EXT]
    texts = [p for p in inputs if p.suffix.lower() in TEXT_EXT]
    other = [n for p, n in zip(inputs, ctx.filenames) if p not in images and p not in texts]
    if other:
        raise ToolError(f"Can't create a PDF from {', '.join(other)}. Use images, .txt or .md files.")
    outputs = []
    if images:
        name = params.get("filename") or ("images.pdf" if len(images) > 1 else f"{images[0].stem}.pdf")
        out = ctx.work_dir / name
        images_to_pdf(images, out, params)
        outputs.append(Output(out, name, "application/pdf"))
    for p in texts:
        out = ctx.work_dir / f"{p.stem}.pdf"
        text_to_pdf(p.read_text(encoding="utf-8", errors="replace"), out, params, p.suffix.lower() != ".txt", p.stem)
        outputs.append(Output(out, out.name, "application/pdf"))
    if params.get("text"):
        name = params.get("filename") or "document.pdf"
        out = ctx.work_dir / name
        text_to_pdf(params["text"], out, params, params.get("format", "markdown") == "markdown", Path(name).stem)
        outputs.append(Output(out, name, "application/pdf"))
    if not outputs:
        raise ToolError("Select images or text files, or type some text.")
    return ToolResult(ok=True, message=f"Created {len(outputs)} PDF(s).", outputs=outputs,
                      data={"images": len(images), "text_files": len(texts)})


TOOL = ToolSpec(
    id="create",
    name="Create PDF",
    tier="standard",
    adobe_feature="Create … PDFs",
    description="Turn images into a PDF (one page each), or text/Markdown into a formatted PDF.",
    params_schema={
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "Text or Markdown to turn into a PDF (instead of, or as well as, files)"},
            "format": {"type": "string", "enum": ["markdown", "plain"], "default": "markdown"},
            "page_size": {"type": "string", "enum": ["A4", "Letter"], "default": "A4"},
            "landscape": {"type": "boolean", "default": False},
            "fit": {"type": "string", "enum": ["page", "image"], "default": "page", "description": "Images: fit on a page, or page = image size"},
            "margin_mm": {"type": "number", "default": 10},
            "filename": {"type": "string"},
        },
    },
    run=run,
)
