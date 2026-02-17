"""
File parsing utilities for extracting text from uploaded documents.
"""

from typing import Optional
import io

# Handle optional dependencies
try:
    from docx import Document as DocxDocument
except ImportError:
    DocxDocument = None

try:
    import PyPDF2
except ImportError:
    PyPDF2 = None

try:
    import mammoth
except ImportError:
    mammoth = None


def extract_text(filename: str, content: bytes) -> Optional[str]:
    """Extract plain text from a file based on its extension."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "txt":
        return content.decode("utf-8", errors="replace")
    elif ext == "docx":
        return _extract_docx_text(content)
    elif ext == "pdf":
        return _extract_pdf_text(content)
    return None


def extract_html(filename: str, content: bytes) -> Optional[str]:
    """Convert a DOCX file to styled HTML for rich rendering."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "docx" and mammoth:
        result = mammoth.convert_to_html(io.BytesIO(content))
        return result.value
    return None


def _extract_docx_text(content: bytes) -> Optional[str]:
    if DocxDocument is None:
        return None
    try:
        doc = DocxDocument(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception:
        return None


def _extract_pdf_text(content: bytes) -> Optional[str]:
    if PyPDF2 is None:
        return None
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages)
    except Exception:
        return None
