"""compress: downsample and recompress images, compress streams, drop duplicates."""
import io
from pathlib import Path

from PIL import Image
from pypdf import PdfWriter

from app.core.pdf_utils import open_pdf
from app.core.tooling import Output, RunContext, ToolResult, ToolSpec

PRESETS = {  # longest image side in pixels, JPEG quality
    "low": (2400, 85),
    "medium": (1600, 70),
    "high": (1100, 55),
}


def run(inputs: list[Path], params: dict, ctx: RunContext) -> ToolResult:
    src = inputs[0]
    before = src.stat().st_size
    max_px, quality = PRESETS.get(params.get("level", "medium"), PRESETS["medium"])
    max_px = int(params.get("max_px") or max_px)
    quality = int(params.get("quality") or quality)

    reader = open_pdf(src, params.get("password"))
    writer = PdfWriter(clone_from=reader)
    images_done = images_skipped = 0
    for page in writer.pages:
        for img in page.images:
            try:
                if img.indirect_reference is None:  # inline image: leave it
                    images_skipped += 1
                    continue
                xobj = img.indirect_reference.get_object()
                stored = len(xobj._data)  # size as stored in the file (still encoded)
                pil = img.image
                if pil.mode in ("RGBA", "LA", "P", "1") or "/SMask" in xobj or "/Mask" in xobj:
                    images_skipped += 1  # transparency/masks: leave alone rather than break them
                    continue
                if max(pil.size) > max_px:
                    pil.thumbnail((max_px, max_px), Image.LANCZOS)
                if pil.mode not in ("RGB", "L"):
                    pil = pil.convert("RGB")
                buf = io.BytesIO()
                pil.save(buf, "JPEG", quality=quality, optimize=True)
                if buf.tell() < stored:
                    img.replace(pil, quality=quality)
                    images_done += 1
                else:
                    images_skipped += 1
            except Exception:
                images_skipped += 1
        page.compress_content_streams(level=9)
    writer.compress_identical_objects(remove_identicals=True, remove_orphans=True)

    name = f"{Path(ctx.filenames[0]).stem}_compressed.pdf"
    out = ctx.work_dir / name
    with open(out, "wb") as f:
        writer.write(f)
    after = out.stat().st_size
    if after >= before:  # never hand back a bigger file
        out.write_bytes(src.read_bytes())
        after = before
    saved = 100 * (before - after) / before if before else 0
    return ToolResult(
        ok=True,
        message=f"{before / 1024:.0f} KB → {after / 1024:.0f} KB ({saved:.0f}% smaller).",
        outputs=[Output(out, name, "application/pdf")],
        data={"bytes_before": before, "bytes_after": after, "percent_saved": round(saved, 1),
              "images_recompressed": images_done, "images_skipped": images_skipped,
              "max_px": max_px, "jpeg_quality": quality},
    )


TOOL = ToolSpec(
    id="compress",
    name="Compress PDF",
    tier="standard",
    adobe_feature="Compress (part of “70+ tools”)",
    description="Make a PDF smaller: downsample images, recompress streams, and report size before and after.",
    params_schema={
        "type": "object",
        "properties": {
            "level": {"type": "string", "enum": ["low", "medium", "high"], "default": "medium", "description": "How hard to compress"},
            "max_px": {"type": "integer", "description": "Override: longest image side in pixels"},
            "quality": {"type": "integer", "minimum": 10, "maximum": 95, "description": "Override: JPEG quality"},
        },
    },
    run=run,
    min_files=1,
    max_files=1,
)
