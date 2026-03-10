from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import User
from features.documents.schemas import DocumentOut, DocumentUploadResponse
from features.documents.file_parser import extract_text, extract_html
from features.documents.repository import (
    get_document_by_id,
    list_documents,
    delete_document,
)
from features.documents.service import (
    normalise_text,
    cleanup_document_vectors,
    create_document_from_upload,
)
from features.projects.repository import get_membership
from infrastructure.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _require_member(db: Session, project_id: str, user_id: str) -> None:
    if not get_membership(db, project_id, user_id):
        raise HTTPException(status_code=403, detail="Access denied")


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(""),
    doc_type: str = Form("transcript"),
    project_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()
    text = extract_text(file.filename or "file.txt", content)
    if not text:
        raise HTTPException(status_code=400, detail="Could not extract text from file.")
    text = normalise_text(text)
    html = extract_html(file.filename or "", content)
    doc_title = title or (file.filename or "Untitled").rsplit(".", 1)[0]

    doc = create_document_from_upload(
        db, project_id=project_id, title=doc_title, text=text,
        doc_type=doc_type, html=html, original_filename=file.filename,
    )
    return DocumentUploadResponse(
        id=doc.id, title=doc.title, doc_type=doc.doc_type,
        char_count=len(text), project_id=project_id,
    )


@router.get("/", response_model=list[DocumentOut])
def list_documents_endpoint(
    project_id: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if project_id:
        _require_member(db, project_id, current_user.id)
    docs = list_documents(db, project_id)
    return [
        DocumentOut(
            id=d.id, title=d.title, full_text=d.full_text, doc_type=d.doc_type,
            html_content=d.html_content, project_id=d.project_id, created_at=d.created_at,
        )
        for d in docs
    ]


@router.get("/{doc_id}", response_model=DocumentOut)
def get_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = get_document_by_id(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentOut(
        id=doc.id, title=doc.title, full_text=doc.full_text, doc_type=doc.doc_type,
        html_content=doc.html_content, project_id=doc.project_id, created_at=doc.created_at,
    )


@router.delete("/{doc_id}")
def delete_document_endpoint(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = get_document_by_id(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    cleanup_document_vectors(db, doc_id, current_user.id)
    delete_document(db, doc)
    return {"status": "deleted"}
