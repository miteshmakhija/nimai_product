# app/services/conversation_manager.py
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from app.models.db import Conversation, ConversationMessage, RFQ, Quote


class ConversationManager:
    """Manages conversation lifecycle, messages, and RFQ field tracking."""

    def __init__(self, db_session: Session, llm=None):
        self.db = db_session
        self.llm = llm

    def create_conversation(
        self,
        uploaded_file_path: str,
        filename: str
    ) -> str:
        """
        Initialize new conversation.

        Args:
            uploaded_file_path: Path to uploaded RFQ file
            filename: Original filename

        Returns:
            conversation_id (UUID as string)
        """
        conversation = Conversation(
            status="active",
            uploaded_filename=filename,
            uploaded_file_path=uploaded_file_path
        )

        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)

        return str(conversation.id)

    def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict] = None
    ) -> None:
        """
        Store message in conversation_messages table.

        Args:
            conversation_id: Conversation UUID
            role: 'user', 'assistant', or 'system'
            content: Message text
            metadata: Optional structured data
        """
        message = ConversationMessage(
            conversation_id=conversation_id,
            role=role,
            content=content,
            message_metadata=metadata
        )

        self.db.add(message)
        self.db.commit()

    def get_conversation_history(self, conversation_id: str) -> List[Dict]:
        """
        Retrieve all messages for a conversation.

        Args:
            conversation_id: Conversation UUID

        Returns:
            List of message dicts with role, content, metadata, created_at
        """
        messages = self.db.query(ConversationMessage).filter_by(
            conversation_id=conversation_id
        ).order_by(ConversationMessage.created_at).all()

        return [
            {
                "id": str(msg.id),
                "role": msg.role,
                "content": msg.content,
                "metadata": msg.message_metadata,
                "created_at": msg.created_at.isoformat()
            }
            for msg in messages
        ]

    def list_conversations(
        self,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict]:
        """
        List conversations for session resume UI.

        Args:
            status: Filter by status ('active', 'completed', 'abandoned')
            limit: Maximum number of conversations to return

        Returns:
            List of conversation dicts
        """
        query = self.db.query(Conversation).order_by(
            Conversation.updated_at.desc()
        )

        if status:
            query = query.filter_by(status=status)

        conversations = query.limit(limit).all()

        return [
            {
                "id": str(conv.id),
                "status": conv.status,
                "uploaded_filename": conv.uploaded_filename,
                "created_at": conv.created_at.isoformat(),
                "updated_at": conv.updated_at.isoformat()
            }
            for conv in conversations
        ]

    def delete_conversation(self, conversation_id: str) -> bool:
        """
        Delete a conversation and all related records.

        Returns:
            True if deleted, False if not found
        """
        conversation = self.db.query(Conversation).filter_by(id=conversation_id).first()
        if not conversation:
            return False

        self.db.delete(conversation)
        self.db.commit()
        return True

    def identify_missing_fields(
        self,
        rfq_data: Dict,
        template: Dict
    ) -> List[str]:
        """
        Compare structured RFQ against template requirements.

        Args:
            rfq_data: Extracted RFQ structured data
            template: Template dictionary with required_fields

        Returns:
            List of missing field names
        """
        required_fields = template.get("required_fields", [])
        missing = []

        for field in required_fields:
            value = rfq_data.get(field)
            if value is None or value == "" or value == []:
                missing.append(field)

        return missing

    def generate_clarifying_question(
        self,
        field_name: str,
        context: Dict
    ) -> str:
        """
        Use LLM to create natural question for missing field.

        Args:
            field_name: Name of missing field
            context: Partial RFQ data for context

        Returns:
            Natural language question string
        """
        if not self.llm:
            return self._get_default_question(field_name)

        # Build prompt
        prompt = self._build_question_prompt(field_name, context)

        try:
            question = self.llm.invoke(prompt)
            return question.strip()
        except Exception as e:
            print(f"LLM question generation failed: {e}")
            return self._get_default_question(field_name)

    def _build_question_prompt(self, field_name: str, context: Dict) -> str:
        """Build prompt for LLM question generation."""
        context_str = "\n".join([f"- {k}: {v}" for k, v in context.items() if v])

        prompt = f"""Generate a natural, conversational question to ask the user.

Context: We're gathering details for a quotation.
Missing field: {field_name}

Existing data:
{context_str}

Ask a single, clear question to get this information.
Be professional but friendly. Keep it under 20 words.
Output only the question, no additional text."""

        return prompt

    def _get_default_question(self, field_name: str) -> str:
        """Generate default question for field without LLM."""
        # Convert snake_case to readable format
        readable_name = field_name.replace("_", " ").title()

        # Field-specific questions
        default_questions = {
            "operating_temperature_celsius": "What is the operating temperature in Celsius?",
            "design_temperature_celsius": "What is the design temperature in Celsius?",
            "material_of_construction": "What material should be used for construction?",
            "vessel_details": "Can you provide the vessel details?",
            "offer_date": "What should be the offer date?",
            "offer_number": "What is the offer number for this quotation?"
        }

        return default_questions.get(
            field_name,
            f"What is the value for {readable_name}?"
        )
