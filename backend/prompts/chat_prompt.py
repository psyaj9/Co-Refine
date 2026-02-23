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
    """Build the messages array for the chat completion call."""
    # System prompt
    messages: list[dict] = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]

    # Inject project context as a system message
    context_parts: list[str] = []

    if codebook:
        context_parts.append("## Codebook")
        for entry in codebook:
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
        for seg in retrieved_segments[:10]:
            context_parts.append(
                f"- [{seg.get('code', '?')}] \"{seg.get('text', '')[:200]}\""
            )

    if context_parts:
        messages.append({
            "role": "system",
            "content": "Here is the researcher's current project context:\n\n" + "\n".join(context_parts),
        })

    # Conversation history (last N turns)
    for msg in conversation_history[-20:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    # Current user message
    messages.append({"role": "user", "content": user_message})

    return messages
