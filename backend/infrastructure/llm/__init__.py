"""LLM client + JSON parsing subpackage.

Exposes two things to the rest of the app:
- call_llm()       — send a prompt to Azure OpenAI and get a parsed dict back
- parse_json_response() + PARSE_FAILED_SENTINEL — used by callers that need
  to detect and handle failed parses explicitly
"""
