"""
Document Manager component for uploading and managing source documents.

Supports TXT, DOCX, and PDF file uploads, as well as direct text pasting.
Documents serve as the source for segment-level coding with full context.
"""

import streamlit as st
import uuid
from datetime import datetime
from typing import Optional

# For file parsing - handle missing dependencies gracefully
try:
    from docx import Document as DocxDocument
except ImportError:
    DocxDocument = None

try:
    import PyPDF2
except ImportError:
    PyPDF2 = None


def render_document_manager() -> None:
    """Render the document upload and management interface."""
    st.header("📄 Document Manager")
    st.markdown("""
    Upload or paste your source documents (transcripts, poems, essays, etc.).
    These documents will be available for segment-level coding with full context.
    """)
    
    st.markdown("---")
    
    # Two columns: upload and paste
    col1, col2 = st.columns(2)
    
    with col1:
        _render_file_upload()
    
    with col2:
        _render_text_paste()
    
    st.markdown("---")
    
    # Document list
    _render_document_list()


def _render_file_upload() -> None:
    """Render file upload section."""
    st.subheader("Upload File")
    
    # Show supported formats based on available libraries
    supported = ["txt"]
    if DocxDocument:
        supported.append("docx")
    if PyPDF2:
        supported.append("pdf")
    
    uploaded_file = st.file_uploader(
        "Choose a file",
        type=supported,
        help=f"Supported formats: {', '.join(s.upper() for s in supported)}"
    )
    
    if uploaded_file is not None:
        doc_title = st.text_input(
            "Document Title",
            value=uploaded_file.name.rsplit(".", 1)[0],
            key="upload_title"
        )
        
        doc_type = st.selectbox(
            "Document Type",
            options=["transcript", "poem", "essay", "interview", "notes", "other"],
            key="upload_type"
        )
        
        if st.button("Import Document", type="primary", key="import_btn"):
            text_content = _extract_text_from_file(uploaded_file)
            if text_content:
                _add_document(doc_title, text_content, doc_type)
                st.success(f"Document '{doc_title}' imported successfully!")
                st.rerun()
            else:
                st.error("Failed to extract text from file.")


def _render_text_paste() -> None:
    """Render text paste section."""
    st.subheader("Paste Text")
    
    doc_title = st.text_input(
        "Document Title",
        placeholder="e.g., Interview with Participant 3",
        key="paste_title"
    )
    
    doc_type = st.selectbox(
        "Document Type",
        options=["transcript", "poem", "essay", "interview", "notes", "other"],
        key="paste_type"
    )
    
    pasted_text = st.text_area(
        "Paste your text here",
        height=200,
        placeholder="Paste your full transcript, poem, or other text here...",
        key="paste_content"
    )
    
    if st.button("Add Document", type="primary", key="paste_btn"):
        if doc_title.strip() and pasted_text.strip():
            _add_document(doc_title.strip(), pasted_text.strip(), doc_type)
            st.success(f"Document '{doc_title}' added successfully!")
            st.rerun()
        else:
            st.warning("Please enter both a title and content.")


def _extract_text_from_file(uploaded_file) -> Optional[str]:
    """Extract text content from uploaded file."""
    file_type = uploaded_file.name.split(".")[-1].lower()
    
    try:
        if file_type == "txt":
            return uploaded_file.read().decode("utf-8")
        
        elif file_type == "docx" and DocxDocument:
            doc = DocxDocument(uploaded_file)
            return "\n".join([para.text for para in doc.paragraphs])
        
        elif file_type == "pdf" and PyPDF2:
            pdf_reader = PyPDF2.PdfReader(uploaded_file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            return text.strip()
        
        else:
            st.error(f"Unsupported file type or missing library for: {file_type}")
            if file_type == "docx" and not DocxDocument:
                st.info("Install python-docx: pip install python-docx")
            if file_type == "pdf" and not PyPDF2:
                st.info("Install PyPDF2: pip install PyPDF2")
            return None
            
    except Exception as e:
        st.error(f"Error reading file: {str(e)}")
        return None


def _add_document(title: str, content: str, doc_type: str) -> None:
    """Add a new document to session state."""
    from ..session import add_document
    
    doc_id = f"doc_{uuid.uuid4().hex[:8]}"
    add_document(doc_id, title, content, doc_type)


def _render_document_list() -> None:
    """Render the list of uploaded documents."""
    from ..session import get_all_documents, remove_document, get_segments_for_document
    
    documents = get_all_documents()
    
    st.subheader(f"Your Documents ({len(documents)})")
    
    if not documents:
        st.info("No documents uploaded yet. Upload a file or paste text above.")
        return
    
    for doc_id, doc in documents.items():
        segments = get_segments_for_document(doc_id)
        segment_count = len(segments)
        
        with st.expander(
            f"**{doc['title']}** ({doc['doc_type']}) - {len(doc['full_text'])} chars, {segment_count} coded segments"
        ):
            col1, col2 = st.columns([3, 1])
            
            with col1:
                st.markdown(f"**Type:** {doc['doc_type']}")
                st.markdown(f"**Added:** {doc.get('created_at', 'Unknown')}")
                st.markdown(f"**Coded Segments:** {segment_count}")
            
            with col2:
                if st.button("Delete", key=f"del_{doc_id}", use_container_width=True):
                    remove_document(doc_id)
                    st.rerun()
            
            # Preview
            st.markdown("**Preview:**")
            preview = doc['full_text'][:500] + "..." if len(doc['full_text']) > 500 else doc['full_text']
            st.text_area(
                "Document preview", 
                value=preview, 
                height=100, 
                disabled=True, 
                key=f"preview_{doc_id}",
                label_visibility="collapsed"
            )
