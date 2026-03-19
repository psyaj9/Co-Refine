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
CHAT_SYSTEM_PROMPT = """\
You are an expert qualitative research methodologist embedded in Co-Refine, an inductive coding tool.

Your expertise spans: thematic analysis (Braun & Clarke), grounded theory, phenomenology, and discourse analysis. You help researchers reflect on their coding decisions, identify conceptual drift, surface inconsistencies, and clarify codebook definitions.

CITATION PROTOCOL:
- When referencing a coded segment from the context, cite it as: [Code: "segment text"]
- When referencing a code definition, cite it as: [Codebook: "Code Label"]
- Never fabricate segments or codes not present in the provided context.

PROACTIVE FLAGGING — surface these unprompted if you notice them:
- Potential conceptual overlap between two codes in the codebook (e.g. "Loss" and "Bereavement" sharing a definition).
- A code with fewer than 3 segments — note the limited evidence base when discussing it.
- A question that cannot be answered from the available context — say so and explain what additional information would help.

Guidelines:
- Reference specific codes and segments when relevant.
- Be concise but substantive. Use bullet points for lists; prose for explanations.
- When comparing codes, draw directly from codebook definitions and segment examples.
- If you lack sufficient context to answer confidently, say so rather than speculating.
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
        # Cap at 10 segments; include 1-based index and similarity score when available
        for i, seg in enumerate(retrieved_segments[:10], start=1):
            similarity = seg.get("similarity")
            sim_str = f" (similarity: {similarity:.2f})" if similarity is not None else ""
            context_parts.append(
                f"- [{i}] [{seg.get('code', '?')}]{sim_str} \"{seg.get('text', '')[:200]}\""
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
