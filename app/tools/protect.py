"""protect: AES-256 password plus permission flags (pypdf)."""
from pathlib import Path

from pypdf import PdfWriter
from pypdf.constants import UserAccessPermissions as P

from app.core.pdf_utils import open_pdf
from app.core.tooling import Output, RunContext, ToolError, ToolResult, ToolSpec

# What each switch allows. Everything not allowed is withheld from the user password.
FLAGS = {
    "allow_print": P.PRINT | P.PRINT_TO_REPRESENTATION,
    "allow_copy": P.EXTRACT | P.EXTRACT_TEXT_AND_GRAPHICS,
    "allow_modify": P.MODIFY | P.ASSEMBLE_DOC,
    "allow_annotate": P.ADD_OR_MODIFY | P.FILL_FORM_FIELDS,
}


def permissions_flag(params: dict) -> int:
    flag = int(P.R1 | P.R2 | P.R7 | P.R8) | 0xFFFFF000  # reserved bits 1-2, 7-8, 13-32 must be 1
    for key, bits in FLAGS.items():
        if params.get(key, key in ("allow_print", "allow_annotate")):
            flag |= int(bits)
    return flag - (1 << 32)  # /P is a signed 32-bit integer


def run(inputs: list[Path], params: dict, ctx: RunContext) -> ToolResult:
    password = params.get("password") or ""
    if len(password) < 1:
        raise ToolError("Choose a password.")
    owner = params.get("owner_password") or password + "-owner"
    reader = open_pdf(inputs[0], params.get("current_password"))
    writer = PdfWriter(clone_from=reader)
    writer.encrypt(user_password=password, owner_password=owner, algorithm="AES-256",
                   permissions_flag=permissions_flag(params))
    name = f"{Path(ctx.filenames[0]).stem}_protected.pdf"
    out = ctx.work_dir / name
    with open(out, "wb") as f:
        writer.write(f)
    allowed = [k.removeprefix("allow_") for k in FLAGS if params.get(k, k in ("allow_print", "allow_annotate"))]
    return ToolResult(
        ok=True,
        message="Protected with AES-256. Opening it now needs the password.",
        outputs=[Output(out, name, "application/pdf")],
        data={"algorithm": "AES-256 (PDF 2.0, /V 5 /R 6)", "allowed": allowed, "owner_password_set": bool(params.get("owner_password"))},
    )


TOOL = ToolSpec(
    id="protect",
    name="Password-protect",
    tier="standard",
    adobe_feature="password-protect PDFs",
    description="Encrypt a PDF with AES-256 so it needs a password to open, and set what readers may do.",
    params_schema={
        "type": "object",
        "required": ["password"],
        "properties": {
            "password": {"type": "string", "description": "Password needed to open the PDF"},
            "owner_password": {"type": "string", "description": "Optional separate password for changing permissions"},
            "allow_print": {"type": "boolean", "default": True},
            "allow_copy": {"type": "boolean", "default": False},
            "allow_modify": {"type": "boolean", "default": False},
            "allow_annotate": {"type": "boolean", "default": True, "description": "Comments and form filling"},
        },
    },
    run=run,
    min_files=1,
    max_files=1,
)
