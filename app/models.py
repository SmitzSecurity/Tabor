from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "tabor-mvp"


class IngestChapterRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    book_id: str = Field(min_length=1, max_length=128)
    chapter_index: int = Field(ge=1)
    chapter_title: str = Field(min_length=1, max_length=256)
    chapter_text: str = Field(min_length=10)


class IngestChapterResponse(BaseModel):
    chapter_id: str
    ingested_at: str
    synopsis: str
    key_terms: list[str]


class AskRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    book_id: str = Field(min_length=1, max_length=128)
    chapter_index: int = Field(ge=1)
    question: str = Field(min_length=3, max_length=1000)
    mode: Literal["text", "speech"] = "text"


class AskResponse(BaseModel):
    answer: str
    related_highlight_candidate: str | None = None
    recommendation: str
    should_save_note: bool


class GenerateStudyPackRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    book_id: str = Field(min_length=1, max_length=128)
    chapter_index: int = Field(ge=1)
    preferred_language: str = Field(default="en", min_length=2, max_length=8)
    include_translation: bool = False


class Flashcard(BaseModel):
    front: str
    back: str
    tags: list[str]


class QuizQuestion(BaseModel):
    prompt: str
    expected_answer_points: list[str]


class StudyPackResponse(BaseModel):
    highlights: list[str]
    quote_candidates: list[str]
    notes: list[str]
    flashcards: list[Flashcard]
    quiz: list[QuizQuestion]
    anki_export_payload: dict
    translated_excerpt: str | None = None
    generated_at: str


class FocusSessionRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    required_pages: int = Field(default=10, ge=1, le=500)
    required_due_cards: int = Field(default=20, ge=0, le=2000)
    min_minutes_locked: int = Field(default=25, ge=1, le=600)
    starts_at_unlock: bool = True
    schedule_label: Literal["daily", "every_8_hours"] = "daily"


class FocusSessionState(BaseModel):
    user_id: str
    session_id: str
    required_pages: int
    required_due_cards: int
    min_minutes_locked: int
    pages_completed: int
    cards_completed: int
    started_at: str
    unlock_eligible: bool


class FocusProgressRequest(BaseModel):
    pages_completed_delta: int = Field(default=0, ge=0, le=500)
    cards_completed_delta: int = Field(default=0, ge=0, le=5000)


class ReaderProfileResponse(BaseModel):
    user_id: str
    mastered_concepts_by_book: dict[str, list[str]]
    difficult_concepts_by_book: dict[str, list[str]]
    chapters_completed: dict[str, int]
    profile_notes: list[str]

