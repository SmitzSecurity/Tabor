from __future__ import annotations

import re
from collections import Counter


STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "he",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "that",
    "the",
    "to",
    "was",
    "were",
    "will",
    "with",
}


def sentence_split(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def tokenize_words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z][A-Za-z\-']{2,}", text.lower())


def extract_key_terms(text: str, top_n: int = 8) -> list[str]:
    words = [w for w in tokenize_words(text) if w not in STOPWORDS]
    counts = Counter(words)
    return [w for w, _ in counts.most_common(top_n)]


def generate_synopsis(text: str, max_sentences: int = 2) -> str:
    sentences = sentence_split(text)
    if not sentences:
        return "No synopsis available."
    return " ".join(sentences[:max_sentences])


def recommend_highlights(text: str, max_items: int = 5) -> list[str]:
    sentences = sentence_split(text)
    # Prefer medium-length informative sentences.
    ranked = sorted(
        sentences,
        key=lambda s: abs(len(s) - 140),
    )
    return ranked[:max_items]


def recommend_quotes(text: str, max_items: int = 3) -> list[str]:
    sentences = sentence_split(text)
    # Quote-like sentence heuristic: impactful and compact.
    quote_like = [s for s in sentences if 50 <= len(s) <= 180]
    return quote_like[:max_items]


def generate_notes(text: str, key_terms: list[str]) -> list[str]:
    synopsis = generate_synopsis(text, max_sentences=1)
    notes = [f"Core takeaway: {synopsis}"]
    if key_terms:
        notes.append(f"Key concepts to retain: {', '.join(key_terms[:5])}.")
    return notes


def generate_flashcards(chapter_title: str, text: str, key_terms: list[str]) -> list[dict]:
    synopsis = generate_synopsis(text, max_sentences=1)
    cards: list[dict] = [
        {
            "front": f"What is the main idea of '{chapter_title}'?",
            "back": synopsis,
            "tags": ["tabor", "chapter-summary"],
        }
    ]
    for term in key_terms[:5]:
        cards.append(
            {
                "front": f"Define '{term}' in the context of this chapter.",
                "back": f"'{term}' is a central concept discussed in relation to the chapter's main argument.",
                "tags": ["tabor", "concept"],
            }
        )
    return cards


def generate_quiz(text: str, key_terms: list[str], max_items: int = 4) -> list[dict]:
    quiz: list[dict] = []
    summary = generate_synopsis(text, max_sentences=1)
    quiz.append(
        {
            "prompt": "In your own words, summarize this chapter.",
            "expected_answer_points": [summary],
        }
    )
    for term in key_terms[: max_items - 1]:
        quiz.append(
            {
                "prompt": f"How does the chapter connect '{term}' to the broader theme?",
                "expected_answer_points": [f"Explains the role of {term}.", "Connects concept to chapter thesis."],
            }
        )
    return quiz[:max_items]


def answer_question(chapter_text: str, question: str, prior_concepts: list[str]) -> tuple[str, str | None]:
    sentences = sentence_split(chapter_text)
    if not sentences:
        return ("I do not have enough text in this chapter to answer that yet.", None)

    q_terms = set(tokenize_words(question))
    best_sentence = None
    best_score = -1
    for s in sentences:
        s_terms = set(tokenize_words(s))
        score = len(q_terms & s_terms)
        if score > best_score:
            best_score = score
            best_sentence = s

    answer = best_sentence or sentences[0]
    if prior_concepts:
        answer += f" This also connects to concepts you have seen before: {', '.join(prior_concepts[:3])}."
    highlight_candidate = best_sentence if best_score > 0 else None
    return answer, highlight_candidate


def translate_excerpt(text: str, preferred_language: str) -> str:
    excerpt = generate_synopsis(text, max_sentences=1)
    # MVP placeholder translation marker while remaining offline-first.
    return f"[{preferred_language}] {excerpt}"

