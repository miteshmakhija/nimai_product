# app/services/template_manager.py
import json
import os
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime


class TemplateManager:
    """Manages quotation template extraction, storage, and validation."""

    def __init__(self, template_dir: str = "data/templates", llm=None):
        self.template_dir = Path(template_dir)
        self.template_path = self.template_dir / "quotation_template.json"
        self.llm = llm

    def get_template(self) -> Dict:
        """Load template from file."""
        if not self.template_path.exists():
            raise FileNotFoundError(f"Template not found at {self.template_path}")

        with open(self.template_path, 'r') as f:
            return json.load(f)

    def extract_template_from_samples(self, sample_texts: List[str]) -> Dict:
        """
        Parse sample documents and use LLM to identify common structure.

        Args:
            sample_texts: List of full text from sample quotation documents

        Returns:
            Template dictionary with sections, fields, and format examples
        """
        if not self.llm:
            return self._get_default_template()

        # Build prompt for LLM
        prompt = self._build_extraction_prompt(sample_texts)

        try:
            # Call LLM
            response = self.llm.invoke(prompt)

            # Parse JSON response
            template = json.loads(response)

            # Add metadata
            template["extracted_date"] = datetime.now().strftime("%Y-%m-%d")

            # Validate and enhance template
            template = self._validate_and_enhance_template(template)

            return template

        except Exception as e:
            print(f"LLM template extraction failed: {e}")
            return self._get_default_template()

    def save_template(self, template: Dict) -> None:
        """Save template to file."""
        self.template_dir.mkdir(parents=True, exist_ok=True)

        with open(self.template_path, 'w') as f:
            json.dump(template, f, indent=2)

    def validate_quote_against_template(
        self,
        quote_text: str,
        template: Dict
    ) -> Tuple[bool, List[str]]:
        """
        Check if quote follows template structure.

        Args:
            quote_text: Generated quote content
            template: Template dictionary

        Returns:
            Tuple of (valid: bool, errors: List[str])
        """
        errors = []

        # Check required fields
        required_fields = template.get("required_fields", [])
        quote_lower = quote_text.lower()

        for field in required_fields:
            field_variants = [
                field.lower(),
                field.replace("_", " ").lower(),
                field.replace("_", "-").lower()
            ]

            if not any(variant in quote_lower for variant in field_variants):
                errors.append(f"Missing required field: {field}")

        # Check required sections
        sections = template.get("sections", [])
        for section in sections:
            if section.get("required", False):
                section_name = section["name"].lower()
                if section_name not in quote_lower:
                    errors.append(f"Missing required section: {section['name']}")

        return len(errors) == 0, errors

    def _build_extraction_prompt(self, sample_texts: List[str]) -> str:
        """Build prompt for LLM template extraction."""
        samples_combined = "\n\n---SAMPLE DOCUMENT---\n\n".join(sample_texts)

        prompt = f"""Analyze these quotation documents to extract a reusable template.

{samples_combined}

Identify:
1. Common sections present in all documents (header, pricing, terms, footer, etc.)
2. Required fields across all samples (offer number, date, materials, temperatures, etc.)
3. Formatting patterns (tables, bullet points, numbering styles)
4. Layout structure and branding elements

Output as JSON with this structure:
{{
  "version": "1.0",
  "sections": [
    {{"name": "section_name", "required": true/false, "format": "description", "fields": ["field1", "field2"]}}
  ],
  "required_fields": ["field1", "field2"],
  "format_examples": {{"date_format": "DD-MMM-YYYY", "currency": "INR"}}
}}

Output only valid JSON, no additional text."""

        return prompt

    def _validate_and_enhance_template(self, template: Dict) -> Dict:
        """Validate and add defaults to extracted template."""
        # Ensure required top-level keys
        if "version" not in template:
            template["version"] = "1.0"

        if "sections" not in template:
            template["sections"] = []

        if "required_fields" not in template:
            template["required_fields"] = []

        # Ensure format_examples has defaults
        if "format_examples" not in template:
            template["format_examples"] = {}

        if "date_format" not in template["format_examples"]:
            template["format_examples"]["date_format"] = "DD-MMM-YYYY"

        if "currency" not in template["format_examples"]:
            template["format_examples"]["currency"] = "INR"

        return template

    def _get_default_template(self) -> Dict:
        """Return minimal default template as fallback."""
        return {
            "version": "1.0",
            "extracted_date": datetime.now().strftime("%Y-%m-%d"),
            "sections": [
                {
                    "name": "header",
                    "required": True,
                    "format": "company_letterhead",
                    "fields": ["company_name", "address"]
                },
                {
                    "name": "offer_details",
                    "required": True,
                    "fields": ["offer_number", "offer_date", "customer_name"]
                },
                {
                    "name": "pricing_table",
                    "required": True,
                    "format": "table"
                },
                {
                    "name": "terms_and_conditions",
                    "required": True,
                    "format": "bullet_points"
                },
                {
                    "name": "footer",
                    "required": True,
                    "format": "signature_block"
                }
            ],
            "required_fields": [
                "offer_number",
                "offer_date",
                "operating_temperature_celsius",
                "design_temperature_celsius",
                "material_of_construction"
            ],
            "format_examples": {
                "date_format": "DD-MMM-YYYY",
                "currency": "INR"
            }
        }
