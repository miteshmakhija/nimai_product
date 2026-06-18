"""Document parser service."""
# app/services/parser.py


def extract_text(file_path: str) -> str:
    """Parse document to markdown-formatted text.

    TXT files bypass Docling (faster, no ML models needed).
    PDF and DOCX go through Docling which preserves tables and headings as markdown.
    Docling is imported lazily — it loads heavy ML models on first call and caches them.
    """
    lower = file_path.lower()

    if lower.endswith('.txt'):
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()

    from docling.document_converter import DocumentConverter  # lazy — heavy ML deps
    converter = DocumentConverter()
    result = converter.convert(file_path)
    return result.document.export_to_markdown()
