"""
Prompt builders — public surface for the prompts package.

Each module in this package builds the messages list for a specific LLM task.
Keeping prompts separate from the feature code makes them easy to iterate on
without touching business logic, and makes it obvious what each LLM call is for.
"""
from .analysis_prompt import build_analysis_prompt
from .audit_prompt import build_coding_audit_prompt
from .chat_prompt import build_chat_messages

__all__ = [
    "build_analysis_prompt",
    "build_coding_audit_prompt",
    "build_chat_messages",
]
