"""
Document management API routes.

Upload, list, retrieve, and delete source documents.
Documents belong to a project.
"""

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from database import get_db, Document, CodedSegment, AgentAlert
from models import DocumentOut, DocumentUploadResponse
from utils.file_parser import extract_text, extract_html
from services.vector_store import delete_segment_embedding

router = APIRouter(prefix="/api/documents", tags=["documents"])

CURRENT_USER = "default"


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(""),
    doc_type: str = Form("transcript"),
    project_id: str = Form(...),
    db: Session = Depends(get_db),
):
    """Upload a TXT, DOCX, or PDF file into a project."""
    content = await file.read()
    text = extract_text(file.filename or "file.txt", content)
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from file.")
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    html = extract_html(file.filename or "", content)

    doc_id = str(uuid.uuid4())
    doc_title = title or (file.filename or "Untitled").rsplit(".", 1)[0]

    doc = Document(
        id=doc_id,
        project_id=project_id,
        title=doc_title,
        full_text=text,
        doc_type=doc_type,
        html_content=html,
        original_filename=file.filename,
    )
    db.add(doc)
    db.commit()

    return DocumentUploadResponse(
        id=doc_id, title=doc_title, doc_type=doc_type, char_count=len(text),
        project_id=project_id,
    )


@router.post("/paste", response_model=DocumentUploadResponse)
async def paste_document(
    title: str = Form(...),
    text: str = Form(...),
    doc_type: str = Form("transcript"),
    project_id: str = Form(...),
    db: Session = Depends(get_db),
):
    """Create a document from pasted text inside a project."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    doc_id = str(uuid.uuid4())
    doc = Document(
        id=doc_id, project_id=project_id, title=title, full_text=text, doc_type=doc_type
    )
    db.add(doc)
    db.commit()
    return DocumentUploadResponse(
        id=doc_id, title=title, doc_type=doc_type, char_count=len(text),
        project_id=project_id,
    )


@router.get("/", response_model=list[DocumentOut])
def list_documents(project_id: str = "", db: Session = Depends(get_db)):
    query = db.query(Document)
    if project_id:
        query = query.filter(Document.project_id == project_id)
    docs = query.order_by(Document.created_at.desc()).all()
    return [
        DocumentOut(
            id=d.id,
            title=d.title,
            full_text=d.full_text,
            doc_type=d.doc_type,
            html_content=d.html_content,
            project_id=d.project_id,
            created_at=d.created_at,
        )
        for d in docs
    ]


@router.get("/{doc_id}", response_model=DocumentOut)
def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentOut(
        id=doc.id,
        title=doc.title,
        full_text=doc.full_text,
        doc_type=doc.doc_type,
        html_content=doc.html_content,
        project_id=doc.project_id,
        created_at=doc.created_at,
    )


@router.delete("/{doc_id}")
def delete_document(doc_id: str, db: Session = Depends(get_db)):
    """Delete a document and clean up its segments, alerts, and vector embeddings."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    segments = db.query(CodedSegment).filter(CodedSegment.document_id == doc_id).all()
    for seg in segments:
        delete_segment_embedding(CURRENT_USER, seg.id)
        db.query(AgentAlert).filter(AgentAlert.segment_id == seg.id).delete()

    db.delete(doc)
    db.commit()
    return {"status": "deleted"}
