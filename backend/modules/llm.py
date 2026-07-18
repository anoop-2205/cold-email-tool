"""LLM-agnostic call layer.

Every module that needs an AI completion calls `complete_json()` or
`complete_text()` here instead of importing anthropic/ollama directly.
Switching providers is one config change (LLM_PROVIDER in .env) with no
changes anywhere else, per the plan's "LLM-Agnostic" design principle.
"""
import json
import re

import httpx

from config import settings


class LLMError(RuntimeError):
    pass


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        return match.group(1)
    # Response got cut off by max_tokens before the closing fence -- still
    # strip the leading ``` so callers get a chance at parsing the
    # truncated-but-otherwise-valid prefix instead of failing on the fence
    # markers alone.
    return re.sub(r"^```(?:json)?\s*", "", text)


def complete_text(system: str, user: str, max_tokens: int = 2000) -> str:
    """Return the raw text completion from the configured provider."""
    if settings.llm_provider == "ollama":
        return _ollama_complete(system, user)
    return _claude_complete(system, user, max_tokens)


def complete_json(system: str, user: str, max_tokens: int = 2000) -> dict:
    """Return a parsed JSON object. Raises LLMError if the model didn't
    return valid JSON (callers should catch and handle/skip)."""
    raw = complete_text(system, user, max_tokens)
    try:
        return json.loads(_strip_code_fence(raw))
    except json.JSONDecodeError as exc:
        raise LLMError(f"LLM did not return valid JSON: {exc}\nRaw output: {raw[:500]}") from exc


def _claude_complete(system: str, user: str, max_tokens: int) -> str:
    if not settings.anthropic_api_key:
        raise LLMError("ANTHROPIC_API_KEY is not set. Add it to .env or switch LLM_PROVIDER=ollama.")
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return "".join(block.text for block in response.content if block.type == "text")


def _ollama_complete(system: str, user: str) -> str:
    try:
        resp = httpx.post(
            f"{settings.ollama_base_url}/api/generate",
            json={
                "model": settings.ollama_model,
                "prompt": user,
                "system": system,
                "stream": False,
            },
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json()["response"]
    except httpx.HTTPError as exc:
        raise LLMError(f"Ollama request failed: {exc}. Is `ollama serve` running?") from exc
