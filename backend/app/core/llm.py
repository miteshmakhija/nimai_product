# app/core/llm.py
from langchain_core.language_models import BaseChatModel
from app.core.config import get_settings, resolved_provider


def get_llm(function: str = "extractor") -> BaseChatModel:
    provider, model = resolved_provider(function)
    return _create_llm(provider, model)


def _create_llm(provider: str, model: str) -> BaseChatModel:
    settings = get_settings()

    if provider == "gemini":
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY not set. Add it to backend/.env.")
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            api_key=settings.gemini_api_key,
            base_url=settings.gemini_base_url,
            temperature=0,
            timeout=settings.gemini_timeout,
        )

    elif provider == "openai":
        if not settings.openai_api_key:
            raise ValueError(
                "OPENAI_API_KEY not set. Add it to backend/.env."
            )
        from langchain_openai import ChatOpenAI
        kwargs = dict(
            model=model,
            api_key=settings.openai_api_key,
            temperature=0,
            timeout=settings.openai_timeout,
        )
        if settings.openai_base_url:
            kwargs["base_url"] = settings.openai_base_url
        return ChatOpenAI(**kwargs)

    elif provider == "bedrock":
        region = settings.effective_bedrock_region
        if not region:
            raise ValueError(
                "No AWS region set. Add BEDROCK_REGION or AWS_REGION to backend/.env."
            )
        import boto3
        from langchain_aws import ChatBedrock

        session_kwargs = {}
        if settings.aws_profile.strip():
            session_kwargs["profile_name"] = settings.aws_profile.strip()

        session = boto3.Session(**session_kwargs)
        bedrock_client = session.client(
            service_name="bedrock-runtime",
            region_name=region,
        )

        return ChatBedrock(
            model_id=model or settings.bedrock_model_id,
            client=bedrock_client,
            model_kwargs={"temperature": 0},
        )

    elif provider == "ollama":
        if not settings.ollama_host:
            raise ValueError(
                "OLLAMA_HOST is not set but an LLM provider is configured as 'ollama'. "
                "Set OLLAMA_HOST in backend/.env (e.g. http://localhost:11434)."
            )
        from langchain_community.chat_models import ChatOllama
        return ChatOllama(
            model=model,
            base_url=settings.ollama_host,
            timeout=settings.ollama_timeout,
        )

    else:
        raise ValueError(f"Unknown LLM provider: {provider}")
