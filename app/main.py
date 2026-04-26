from __future__ import annotations

from uuid import uuid4

from fastapi import FastAPI, HTTPException

from app.engine import (
    answer_question,
    extract_key_terms,
    generate_flashcards,
    generate_notes,
    generate_quiz,
    generate_synopsis,
    recommend_highlights,
    recommend_quotes,
    translate_excerpt,
)
from app.models import (
    AskRequest,
    AskResponse,
    FocusProgressRequest,
    FocusSessionRequest,
    FocusSessionState,
    GenerateStudyPackRequest,
    HealthResponse,
    IngestChapterRequest,
    IngestChapterResponse,
    ReaderProfileResponse,
    StudyPackResponse,
    utc_now_iso,
)
from app.storage import ChapterRecord, FocusSessionRecord, InMemoryStore

app = FastAPI(title="Tabor MVP API", version="0.1.0")
store = InMemoryStore()


def chapter_key(user_id: str, book_id: str, chapter_index: int) -> tuple[str, str, int]:
    return (user_id, book_id, chapter_index)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


@app.get("/")
def root() -> dict:
    return {
        "name": "Tabor MVP API",
        "status": "online",
        "features": [
            "offline chapter ingestion",
            "chapter-aware ask while reading",
            "study pack generation (highlights, notes, flashcards, quiz)",
            "anki export payload",
            "focus lock sessions",
            "reader profile memory",
        ],
    }


@app.post("/ingest/chapter", response_model=IngestChapterResponse)
def ingest_chapter(payload: IngestChapterRequest) -> IngestChapterResponse:
    key = chapter_key(payload.user_id, payload.book_id, payload.chapter_index)
    key_terms = extract_key_terms(payload.chapter_text)
    synopsis = generate_synopsis(payload.chapter_text)
    chapter_id = f"{payload.book_id}-ch{payload.chapter_index}"

    store.chapters[key] = ChapterRecord(
        chapter_id=chapter_id,
        chapter_title=payload.chapter_title,
        chapter_text=payload.chapter_text,
        synopsis=synopsis,
        key_terms=key_terms,
    )

    profile = store.get_or_create_profile(payload.user_id)
    profile.chapters_completed[payload.book_id] = max(
        profile.chapters_completed.get(payload.book_id, 0), payload.chapter_index
    )
    profile.mastered_concepts_by_book.setdefault(payload.book_id, [])
    profile.mastered_concepts_by_book[payload.book_id].extend(term for term in key_terms[:3])
    profile.profile_notes.append(
        f"Ingested chapter {payload.chapter_index} of {payload.book_id}: {payload.chapter_title}."
    )

    return IngestChapterResponse(
        chapter_id=chapter_id,
        ingested_at=utc_now_iso(),
        synopsis=synopsis,
        key_terms=key_terms,
    )


@app.post("/ask", response_model=AskResponse)
def ask(payload: AskRequest) -> AskResponse:
    key = chapter_key(payload.user_id, payload.book_id, payload.chapter_index)
    chapter = store.chapters.get(key)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Chapter not found. Ingest chapter first.")

    profile = store.get_or_create_profile(payload.user_id)
    completed = profile.chapters_completed.get(payload.book_id, 0)
    if payload.chapter_index > completed:
        raise HTTPException(status_code=400, detail="Cannot query beyond completed chapter state.")

    prior_concepts = profile.mastered_concepts_by_book.get(payload.book_id, [])
    answer, highlight_candidate = answer_question(chapter.chapter_text, payload.question, prior_concepts)

    should_save_note = "difficult" in payload.question.lower() or "confusing" in payload.question.lower()
    recommendation = (
        "Save this as a note and generate flashcards."
        if should_save_note
        else "Consider adding this to highlights."
    )
    if should_save_note:
        profile.difficult_concepts_by_book.setdefault(payload.book_id, []).append(payload.question[:120])

    return AskResponse(
        answer=answer,
        related_highlight_candidate=highlight_candidate,
        recommendation=recommendation,
        should_save_note=should_save_note,
    )


@app.post("/study-pack", response_model=StudyPackResponse)
def study_pack(payload: GenerateStudyPackRequest) -> StudyPackResponse:
    key = chapter_key(payload.user_id, payload.book_id, payload.chapter_index)
    chapter = store.chapters.get(key)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Chapter not found. Ingest chapter first.")

    highlights = recommend_highlights(chapter.chapter_text)
    quote_candidates = recommend_quotes(chapter.chapter_text)
    notes = generate_notes(chapter.chapter_text, chapter.key_terms)
    flashcards_raw = generate_flashcards(chapter.chapter_title, chapter.chapter_text, chapter.key_terms)
    quiz_raw = generate_quiz(chapter.chapter_text, chapter.key_terms)

    anki_export_payload = {
        "deck_name": f"{payload.book_id}::Chapter {payload.chapter_index}",
        "notes": flashcards_raw,
        "sync_hint": "POST these notes to AnkiConnect at /addNotes in desktop bridge.",
    }

    translated_excerpt = None
    if payload.include_translation:
        translated_excerpt = translate_excerpt(chapter.chapter_text, payload.preferred_language)

    return StudyPackResponse(
        highlights=highlights,
        quote_candidates=quote_candidates,
        notes=notes,
        flashcards=flashcards_raw,  # pydantic coerces dicts into models
        quiz=quiz_raw,
        anki_export_payload=anki_export_payload,
        translated_excerpt=translated_excerpt,
        generated_at=utc_now_iso(),
    )


@app.post("/focus-session/start", response_model=FocusSessionState)
def start_focus_session(payload: FocusSessionRequest) -> FocusSessionState:
    session_id = f"focus-{uuid4().hex[:10]}"
    record = FocusSessionRecord(
        session_id=session_id,
        user_id=payload.user_id,
        required_pages=payload.required_pages,
        required_due_cards=payload.required_due_cards,
        min_minutes_locked=payload.min_minutes_locked,
        pages_completed=0,
        cards_completed=0,
        started_at=utc_now_iso(),
    )
    store.focus_sessions[session_id] = record
    return FocusSessionState(
        user_id=record.user_id,
        session_id=record.session_id,
        required_pages=record.required_pages,
        required_due_cards=record.required_due_cards,
        min_minutes_locked=record.min_minutes_locked,
        pages_completed=record.pages_completed,
        cards_completed=record.cards_completed,
        started_at=record.started_at,
        unlock_eligible=False,
    )


@app.post("/focus-session/{session_id}/progress", response_model=FocusSessionState)
def update_focus_progress(session_id: str, payload: FocusProgressRequest) -> FocusSessionState:
    record = store.focus_sessions.get(session_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Focus session not found.")

    record.pages_completed += payload.pages_completed_delta
    record.cards_completed += payload.cards_completed_delta
    unlock_eligible = (
        record.pages_completed >= record.required_pages
        and record.cards_completed >= record.required_due_cards
    )

    return FocusSessionState(
        user_id=record.user_id,
        session_id=record.session_id,
        required_pages=record.required_pages,
        required_due_cards=record.required_due_cards,
        min_minutes_locked=record.min_minutes_locked,
        pages_completed=record.pages_completed,
        cards_completed=record.cards_completed,
        started_at=record.started_at,
        unlock_eligible=unlock_eligible,
    )


@app.get("/profile/{user_id}", response_model=ReaderProfileResponse)
def reader_profile(user_id: str) -> ReaderProfileResponse:
    profile = store.get_or_create_profile(user_id)
    return ReaderProfileResponse(
        user_id=user_id,
        mastered_concepts_by_book=profile.mastered_concepts_by_book,
        difficult_concepts_by_book=profile.difficult_concepts_by_book,
        chapters_completed=profile.chapters_completed,
        profile_notes=profile.profile_notes,
    )
