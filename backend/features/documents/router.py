"""Documents feature router: upload, paste, list, get, delete."""
import uuid

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import Document
from features.documents.schemas import DocumentOut, DocumentUploadResponse
from features.documents.file_parser import extract_text, extract_html
from features.documents.repository import (
    get_document_by_id,
    list_documents,
    create_document,
    delete_document,
)
from features.documents.service import normalise_text, cleanup_document_vectors

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(""),
    doc_type: str = Form("transcript"),
    project_id: str = Form(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    text = extract_text(file.filename or "file.txt", content)
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from file.")
    text = normalise_text(text)
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
    create_document(db, doc)

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
    text = normalise_text(text)
    doc_id = str(uuid.uuid4())
    doc = Document(
        id=doc_id, project_id=project_id, title=title, full_text=text, doc_type=doc_type
    )
    create_document(db, doc)
    return DocumentUploadResponse(
        id=doc_id, title=title, doc_type=doc_type, char_count=len(text),
        project_id=project_id,
    )


@router.get("/", response_model=list[DocumentOut])
def list_documents_endpoint(project_id: str = "", db: Session = Depends(get_db)):
    docs = list_documents(db, project_id)
    return [
        DocumentOut(
            id=d.id, title=d.title, full_text=d.full_text, doc_type=d.doc_type,
            html_content=d.html_content, project_id=d.project_id, created_at=d.created_at,
        )
        for d in docs
    ]


@router.get("/{doc_id}", response_model=DocumentOut)
def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = get_document_by_id(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentOut(
        id=doc.id, title=doc.title, full_text=doc.full_text, doc_type=doc.doc_type,
        html_content=doc.html_content, project_id=doc.project_id, created_at=doc.created_at,
    )


@router.delete("/{doc_id}")
def delete_document_endpoint(doc_id: str, user_id: str = "default", db: Session = Depends(get_db)):
    doc = get_document_by_id(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    cleanup_document_vectors(db, doc_id, user_id)
    delete_document(db, doc)
    return {"status": "deleted"}
