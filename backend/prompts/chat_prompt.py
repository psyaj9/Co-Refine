"""
Chat prompt builder — assembles the full messages list for the research assistant.

The chat system has three sources of context injected into the system prompt:
1. The researcher's codebook (codes, definitions, AI-inferred definitions)
2. Semantically similar coded segments retrieved via vector search (RAG)
3. Recent conversation history (last 20 turns)

This design means the LLM always has up-to-date project context without
needing to fine-tune or embed the whole codebook in the model.
"""

# The baseline system prompt sets the assistant's role and constraints.
# Key constraint: "never fabricate segments or codes" — important for research validity.
CHAT_SYSTEM_PROMPT = """You are a qualitative research assistant embedded in a coding tool called Co-Refine.
You help researchers reflect on their inductive coding process. You have access to:
- The researcher's **codebook** (codes, definitions, AI-inferred definitions, interpretive lenses)
- **Coded segments** retrieved by semantic similarity to the user's question
- The conversation history

Guidelines:
- Reference specific codes and segments when relevant (quote them).
- Help the researcher identify patterns, compare codes, spot drift, and reflect.
- Be concise but substantive. Use bullet points for clarity.
- When asked to compare codes, pull from the codebook and segments.
- Never fabricate segments or codes that don't exist in the provided context.
- If you lack information to answer, say so honestly.
"""


def build_chat_messages(
    user_message: str,
    codebook: list[dict],
    retrieved_segments: list[dict],
    conversation_history: list[dict],
) -> list[dict]:
    """Assemble the full messages list for the chat LLM call.

    Injects codebook and retrieved segments as a second system message so the
    role/content structure stays clean. Conversation history is appended before
    the final user message so the LLM sees the full thread.

    Args:
        user_message: The researcher's latest message.
        codebook: List of code dicts with label/definitions/lens/segment_count.
        retrieved_segments: RAG results — segments semantically similar to the query.
        conversation_history: Prior turns as {"role": ..., "content": ...} dicts.

    Returns:
        Complete messages list ready for call_llm() or direct API call.
    """
    messages: list[dict] = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]

    context_parts: list[str] = []

    if codebook:
        context_parts.append("## Codebook")
        for entry in codebook:
            # Build a compact one-liner per code so the context stays scannable
            line = f"- **{entry['label']}**"
            if entry.get("user_definition"):
                line += f" — User definition: \"{entry['user_definition']}\""
            if entry.get("ai_definition"):
                line += f" | AI-inferred: \"{entry['ai_definition']}\""
            if entry.get("lens"):
                line += f" | Lens: \"{entry['lens']}\""
            line += f" ({entry.get('segment_count', 0)} segments)"
            context_parts.append(line)

    if retrieved_segments:
        context_parts.append("\n## Relevant Coded Segments")
        # Cap at 10 segments to avoid bloating the context window
        for seg in retrieved_segments[:10]:
            context_parts.append(
                f"- [{seg.get('code', '?')}] \"{seg.get('text', '')[:200]}\""
            )

    if context_parts:
        # Inject as a second system message rather than appending to the first,
        # which keeps the role instructions separate from the data context
        messages.append({
            "role": "system",
            "content": "Here is the researcher's current project context:\n\n" + "\n".join(context_parts),
        })

    # Include the last 20 turns only — older context is usually irrelevant and
    # would push us towards the token limit
    for msg in conversation_history[-20:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})

    return messages
