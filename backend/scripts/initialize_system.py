# scripts/initialize_system.py
import sys
import os
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import get_settings
from app.core.llm import get_llm
from app.core.embeddings import create_vector_store
from app.services.parser import extract_text
from app.services.template_manager import TemplateManager
from app.models.db import Base
from sqlalchemy import create_engine


def main():
    """Initialize system: template extraction, vector store, database."""
    print("=== Quote Assistant Initialization ===\n")

    settings = get_settings()

    # Step 1: Verify LLM connectivity
    print("1. Checking LLM connectivity...")
    try:
        test_llm = get_llm("extractor")
        test_llm.invoke("ping")
        print(f"✓ LLM provider ({settings.extractor_provider}) is reachable\n")
    except Exception as e:
        print(f"WARNING: LLM check failed: {e}")
        print("Continuing with initialization...\n")

    # Step 2: Check sample files
    print("2. Checking sample PDFs...")
    samples_path = Path(settings.samples_dir)
    if not samples_path.exists():
        print(f"ERROR: Samples directory not found: {settings.samples_dir}")
        sys.exit(1)

    sample_files = list(samples_path.glob("*.pdf"))
    if len(sample_files) == 0:
        print(f"ERROR: No PDF files found in {settings.samples_dir}")
        sys.exit(1)

    print(f"✓ Found {len(sample_files)} sample PDFs\n")

    # Step 3: Extract template
    print("3. Extracting quotation template...")
    template_path = Path(settings.templates_dir) / "quotation_template.json"

    if template_path.exists():
        print("✓ Template already exists, skipping extraction\n")
    else:
        llm = get_llm()
        manager = TemplateManager(template_dir=settings.templates_dir, llm=llm)

        # Parse sample PDFs
        sample_texts = []
        for pdf_file in sample_files:
            print(f"  Parsing {pdf_file.name}...")
            text = extract_text(str(pdf_file))
            sample_texts.append(text)

        # Extract template
        print("  Analyzing samples with LLM...")
        template = manager.extract_template_from_samples(sample_texts)

        # Save template
        manager.save_template(template)
        print(f"✓ Template saved to {template_path}\n")

    # Step 4: Build vector store
    print("4. Building vector store...")
    vector_store_path = Path(settings.vector_store_dir)
    index_file = vector_store_path / "index.faiss"

    if index_file.exists():
        print("✓ Vector store already exists, skipping\n")
    else:
        # Parse and chunk sample PDFs
        texts = []
        metadatas = []

        for pdf_file in sample_files:
            print(f"  Processing {pdf_file.name}...")
            full_text = extract_text(str(pdf_file))

            # Simple chunking by paragraphs, with size limit
            paragraphs = [p.strip() for p in full_text.split('\n\n') if p.strip()]

            for i, para in enumerate(paragraphs):
                if len(para) > 50:  # Skip very short chunks
                    # Split large paragraphs into smaller chunks (max 500 chars)
                    if len(para) > 500:
                        # Split by sentences or lines
                        sub_chunks = [para[j:j+500] for j in range(0, len(para), 500)]
                        for sub_idx, sub_chunk in enumerate(sub_chunks):
                            texts.append(sub_chunk)
                            metadatas.append({
                                "source_file": pdf_file.name,
                                "chunk_index": f"{i}_{sub_idx}"
                            })
                    else:
                        texts.append(para)
                        metadatas.append({
                            "source_file": pdf_file.name,
                            "chunk_index": i
                        })

        print(f"  Creating embeddings for {len(texts)} chunks...")
        create_vector_store(texts, metadatas, settings.vector_store_dir)
        print("✓ Vector store created\n")

    # Step 5: Initialize database
    print("5. Initializing database...")
    engine = create_engine(settings.database_url)

    try:
        Base.metadata.create_all(engine)
        print("✓ Database tables created\n")
    except Exception as e:
        print(f"ERROR: Database initialization failed: {e}")
        sys.exit(1)

    # Step 6: Create data directories
    print("6. Creating data directories...")
    Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.templates_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.vector_store_dir).mkdir(parents=True, exist_ok=True)
    print("✓ Data directories ready\n")

    print("=== Initialization Complete ===")
    print(f"\nTemplate: {template_path}")
    print(f"Vector Store: {vector_store_path}")
    print(f"Database: {settings.database_url}")
    print("\nSystem is ready to use!")


if __name__ == "__main__":
    main()
