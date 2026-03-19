"""Document file parsing: text extraction and HTML conversion.

Supports .txt, .docx, and .pdf formats. 
"""

from typing import Optional
import io
from core.logging import get_logger

logger = get_logger(__name__)

try:
    from docx import Document as DocxDocument

except ImportError:
    DocxDocument = None

try:
    import pypdf

except ImportError:
    pypdf = None

try:
    import mammoth

except ImportError:
    mammoth = None


def extract_text(filename: str, content: bytes) -> Optional[str]:
    """Extract text from an uploaded file based on its extension.

    Args:
        filename: Original filename.
        content: Raw file bytes.

    Returns:
        Extracted text string, or None if the format not supported or parsing failed.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "txt":
        return content.decode("utf-8", errors="replace")
    
    elif ext == "docx":
        return _extract_docx_text(content)
    
    elif ext == "pdf":
        return _extract_pdf_text(content)

    return None


def extract_html(filename: str, content: bytes) -> Optional[str]:
    """Extract an HTML representation of the document.

    Args:
        filename: Original filename.
        content: Raw file bytes.

    Returns:
        HTML string, or None if no HTML conversion is available for this format.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "docx" and mammoth:
        result = mammoth.convert_to_html(io.BytesIO(content))
        return result.value

    return None


def _extract_docx_text(content: bytes) -> Optional[str]:
    """Pull text from a .docx file by joining paragraph text.

    Args:
        content: Raw .docx bytes.

    Returns:
        Newline-joined paragraph text, or None.
    """
    if DocxDocument is None:
        return None
    try:
        doc = DocxDocument(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception as e:
        logger.warning("Failed to parse DOCX content", extra={"error": str(e)})
        return None


def _extract_pdf_text(content: bytes) -> Optional[str]:
    """Pull text from a PDF by extracting each page and joining them.

    Args:
        content: Raw PDF bytes.

    Returns:
        Newline-joined page text, or None.
    """
    if pypdf is None:
        return None
    
    try:
        reader = pypdf.PdfReader(io.BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages)
    
    except Exception as e:
        logger.warning("Failed to parse PDF content", extra={"error": str(e)})
        return None
