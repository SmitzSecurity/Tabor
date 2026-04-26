"""AI service abstraction.

Tabor's vision is **offline-first**. The MVP is configured for a local
OpenAI-compatible endpoint (e.g. Ollama, LM Studio, llama.cpp server) so the
model truly runs on-device. If no endpoint is configured (or it is
unreachable), Tabor degrades gracefully to a pure-Python heuristic AI so the
product is still demonstrable end-to-end without network access.

The heuristic engine is intentionally simple but demonstrates the user-facing
behavior:
    - Q&A grounded in the current chapter's text.
    - Auto-summary, highlights, and flashcard generation.
    - Chapter-scoped "progressive profile" notes (no spoilers from later
      chapters).
"""
from __future__ import annotations

import json
import logging
import re
from collections import Counter
from dataclasses import dataclass
from typing import List, Optional

import httpx

from . import db

log = logging.getLogger(__name__)


SYSTEM_PROMPT = (
    "You are Tabor, an offline reading tutor embedded inside an e-book reader. "
    "You ground every answer in the *current* chapter's text and you NEVER "
    "reference material from later chapters that the reader has not yet "
    "encountered. Be concise, Socratic, and emphasize active recall."
)


@dataclass
class AISettings:
    endpoint: str
    model: str
    api_key: str

    @classmethod
    def load(cls) -> "AISettings":
        return cls(
            endpoint=db.get_setting("ai_endpoint", "").strip(),
            model=db.get_setting("ai_model", "llama3.2").strip(),
            api_key=db.get_setting("ai_api_key", "").strip(),
        )

    @property
    def configured(self) -> bool:
        return bool(self.endpoint)


# ---------------------------------------------------------------------------
# Remote (OpenAI-compatible) client
# ---------------------------------------------------------------------------

def _chat_remote(messages: list[dict], settings: AISettings, *, json_mode: bool = False, timeout: float = 30.0) -> str:
    url = settings.endpoint.rstrip("/") + "/chat/completions"
    headers = {"Content-Type": "application/json"}
    if settings.api_key:
        headers["Authorization"] = f"Bearer {settings.api_key}"
    payload: dict = {
        "model": settings.model,
        "messages": messages,
        "temperature": 0.3,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    with httpx.Client(timeout=timeout) as client:
        resp = client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# Heuristic offline fallback
# ---------------------------------------------------------------------------

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "then", "of", "to", "in", "on", "at", "for",
    "with", "by", "from", "as", "is", "are", "was", "were", "be", "been", "being", "this",
    "that", "these", "those", "it", "its", "he", "she", "they", "them", "we", "you", "i",
    "his", "her", "their", "our", "your", "my", "me", "do", "does", "did", "have", "has",
    "had", "will", "would", "could", "should", "can", "may", "might", "not", "no", "so",
    "than", "into", "about", "over", "under", "between", "while", "such", "any", "all",
    "what", "which", "who", "whom", "whose", "where", "when", "why", "how",
}


def _sentences(text: str) -> List[str]:
    sents = re.split(r"(?<=[.!?])\s+", text.strip())
    return [s.strip() for s in sents if len(s.strip()) > 10]


def _keywords(text: str, top_k: int = 12) -> List[str]:
    tokens = [t.lower() for t in re.findall(r"[A-Za-z][A-Za-z\-']{2,}", text)]
    tokens = [t for t in tokens if t not in _STOPWORDS]
    counts = Counter(tokens)
    return [w for w, _ in counts.most_common(top_k)]


def _score_sentence(sent: str, keywords: List[str]) -> float:
    s = sent.lower()
    return sum(1.0 for kw in keywords if kw in s) / max(1, len(sent.split()) / 20)


def _summarize(text: str, max_sents: int = 3) -> str:
    sents = _sentences(text)
    if not sents:
        return "(no extractable text)"
    kws = _keywords(text, top_k=15)
    ranked = sorted(sents, key=lambda s: _score_sentence(s, kws), reverse=True)
    picked = ranked[:max_sents]
    # restore original order
    picked.sort(key=lambda s: sents.index(s))
    return " ".join(picked)


def _heuristic_answer(question: str, context: str) -> str:
    q_kws = [w for w in _keywords(question, top_k=8) if w not in _STOPWORDS]
    if not q_kws:
        return _summarize(context, max_sents=3)
    sents = _sentences(context)
    scored = sorted(
        sents,
        key=lambda s: sum(1 for kw in q_kws if kw in s.lower()),
        reverse=True,
    )
    relevant = [s for s in scored[:3] if any(kw in s.lower() for kw in q_kws)]
    if not relevant:
        return (
            "I couldn't find a direct answer in the current chapter. "
            "Here's the chapter's gist instead:\n\n" + _summarize(context, 3)
        )
    return "Based on this chapter:\n\n" + " ".join(relevant)


def _heuristic_flashcards(text: str, n: int = 6) -> list[dict]:
    sents = _sentences(text)
    if not sents:
        return []
    kws = _keywords(text, top_k=20)
    cards: list[dict] = []
    used: set[str] = set()
    for kw in kws:
        if len(cards) >= n:
            break
        for s in sents:
            if kw in s.lower() and s not in used:
                used.add(s)
                # Build a cloze-style front by hiding the keyword.
                pattern = re.compile(rf"\b{re.escape(kw)}\b", re.IGNORECASE)
                front = pattern.sub("____", s, count=1)
                cards.append({
                    "front": f"Fill in the blank: {front}",
                    "back": kw,
                    "tags": "auto,cloze",
                })
                break
    # Add a few comprehension-style cards.
    for s in sents[: max(0, n - len(cards))]:
        cards.append({
            "front": f"In your own words, what does this passage mean?\n\n\u201c{s}\u201d",
            "back": _summarize(s, 1),
            "tags": "auto,comprehension",
        })
    return cards[:n]


def _heuristic_highlights(text: str, n: int = 3) -> list[str]:
    sents = _sentences(text)
    if not sents:
        return []
    kws = _keywords(text, top_k=15)
    ranked = sorted(sents, key=lambda s: _score_sentence(s, kws), reverse=True)
    return ranked[:n]


def _heuristic_chapter_notes(text: str) -> str:
    kws = _keywords(text, top_k=8)
    summary = _summarize(text, 4)
    return (
        "Key concepts covered so far: " + ", ".join(kws) + ".\n\n"
        "Distilled understanding: " + summary
    )


# ---------------------------------------------------------------------------
# Public API used by routes
# ---------------------------------------------------------------------------

def _trim_context(text: str, max_chars: int = 6000) -> str:
    if len(text) <= max_chars:
        return text
    head = text[: max_chars // 2]
    tail = text[-max_chars // 2 :]
    return head + "\n\n[...]\n\n" + tail


def chapter_chat(
    question: str,
    chapter_text: str,
    chapter_title: str,
    history: Optional[list[dict]] = None,
) -> str:
    """Answer a free-form question grounded in the current chapter."""
    settings = AISettings.load()
    context = _trim_context(chapter_text)
    if settings.configured:
        try:
            messages: list[dict] = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "system",
                    "content": (
                        f"Current chapter title: {chapter_title}\n\n"
                        f"Current chapter text (truncated):\n{context}"
                    ),
                },
            ]
            if history:
                messages.extend(history[-6:])
            messages.append({"role": "user", "content": question})
            return _chat_remote(messages, settings).strip()
        except Exception as e:  # noqa: BLE001
            log.warning("Remote AI failed, falling back to heuristic: %s", e)
    return _heuristic_answer(question, chapter_text)


def generate_flashcards(chapter_text: str, chapter_title: str, n: int = 6) -> list[dict]:
    settings = AISettings.load()
    context = _trim_context(chapter_text)
    if settings.configured:
        try:
            prompt = (
                "From the chapter below, produce exactly "
                f"{n} high-quality study flashcards. Each card must be a JSON "
                "object with fields 'front', 'back', and 'tags' (comma-separated). "
                "Mix factual recall and conceptual application. Return JSON of "
                "shape {\"cards\": [...]}. Do NOT reference any material outside "
                "this chapter.\n\n"
                f"Chapter: {chapter_title}\n\n{context}"
            )
            raw = _chat_remote(
                [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                settings,
                json_mode=True,
            )
            data = json.loads(raw)
            cards = data.get("cards") or []
            cleaned: list[dict] = []
            for c in cards[:n]:
                if not isinstance(c, dict):
                    continue
                front = str(c.get("front", "")).strip()
                back = str(c.get("back", "")).strip()
                if not front or not back:
                    continue
                cleaned.append({
                    "front": front,
                    "back": back,
                    "tags": str(c.get("tags", "auto")),
                })
            if cleaned:
                return cleaned
        except Exception as e:  # noqa: BLE001
            log.warning("Remote flashcard generation failed, using heuristic: %s", e)
    return _heuristic_flashcards(chapter_text, n=n)


def suggest_highlights(chapter_text: str, n: int = 3) -> list[str]:
    settings = AISettings.load()
    context = _trim_context(chapter_text)
    if settings.configured:
        try:
            prompt = (
                f"Identify the {n} most quote-worthy sentences from this chapter. "
                "Return JSON of shape {\"highlights\": [\"...\", \"...\"]}. "
                "Quote the sentences verbatim from the text.\n\n" + context
            )
            raw = _chat_remote(
                [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                settings,
                json_mode=True,
            )
            data = json.loads(raw)
            hl = data.get("highlights") or []
            cleaned = [str(h).strip() for h in hl if str(h).strip()]
            if cleaned:
                return cleaned[:n]
        except Exception as e:  # noqa: BLE001
            log.warning("Remote highlights failed, using heuristic: %s", e)
    return _heuristic_highlights(chapter_text, n=n)


def summarize_chapter(chapter_text: str, chapter_title: str) -> str:
    """Build progressive AI-profile notes for the chapter."""
    settings = AISettings.load()
    context = _trim_context(chapter_text)
    if settings.configured:
        try:
            prompt = (
                "Write a dense study note for the chapter below. Structure it as: "
                "(1) 3-5 bullet 'Key Concepts', (2) one paragraph 'Distilled "
                "Understanding'. Use ONLY information present in this chapter; do "
                "not refer to later or earlier material.\n\n"
                f"Chapter title: {chapter_title}\n\n{context}"
            )
            return _chat_remote(
                [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                settings,
            ).strip()
        except Exception as e:  # noqa: BLE001
            log.warning("Remote summarize failed, using heuristic: %s", e)
    return _heuristic_chapter_notes(chapter_text)


def end_of_chapter_quiz(chapter_text: str, chapter_title: str, n: int = 3) -> list[str]:
    """Open-ended questions to push the user into active recall."""
    settings = AISettings.load()
    context = _trim_context(chapter_text)
    if settings.configured:
        try:
            prompt = (
                f"Generate {n} open-ended end-of-chapter recall questions to push "
                "the reader to articulate what they just learned. Return JSON of "
                "shape {\"questions\": [\"...\"]}. Vary difficulty and avoid yes/no "
                "questions.\n\n" + context
            )
            raw = _chat_remote(
                [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                settings,
                json_mode=True,
            )
            data = json.loads(raw)
            qs = [str(q).strip() for q in (data.get("questions") or []) if str(q).strip()]
            if qs:
                return qs[:n]
        except Exception as e:  # noqa: BLE001
            log.warning("Remote quiz failed, using heuristic: %s", e)
    # Heuristic: turn highlights into questions.
    highs = _heuristic_highlights(chapter_text, n=n)
    return [
        f"In your own words, explain: \u201c{h}\u201d" for h in highs
    ] or [f"What was the central argument of '{chapter_title}'?"]
