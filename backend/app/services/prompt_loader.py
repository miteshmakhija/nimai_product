# app/services/prompt_loader.py

from pathlib import Path

# Get project root dynamically
BASE_DIR = Path(__file__).resolve().parents[1]

PROMPT_DIR = BASE_DIR / "prompts"
SKILL_DIR = BASE_DIR / "skills"


def load_prompt(name: str) -> str:
    """
    Load prompt file from /prompts
    """
    path = PROMPT_DIR / name

    if not path.exists():
        raise FileNotFoundError(f"Prompt file not found: {path}")

    return path.read_text(encoding="utf-8")


def load_skill(category: str, name: str) -> str:
    """
    Load skill markdown from /skills/<category>
    """

    path = SKILL_DIR / category / f"{name}.md"

    if not path.exists():
        raise FileNotFoundError(f"Skill file not found: {path}")

    return path.read_text(encoding="utf-8")