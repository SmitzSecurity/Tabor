# Tabor MVP API

Offline-first backend MVP for an AI-powered eBook/PDF learning platform that turns reading into active recall and spaced repetition.

## What this MVP includes

- Chapter ingestion with chapter-aware memory state (no future-chapter references).
- Ask-while-reading endpoint (text/speech mode flag) with answer + save recommendation.
- Study-pack generation per chapter:
  - highlights
  - quote candidates
  - notes
  - flashcards
  - quiz prompts
  - Anki export payload
- Focus lock "airlock" sessions:
  - page quota + due-card quota
  - unlock eligibility state
- Reader profile endpoint with mastered/difficult concept tracking.
- Offline-friendly deterministic "local AI" heuristics (no external API required).
- Translation placeholder output to support multilingual UX wiring.

## Tech stack

- Python 3.10+
- FastAPI
- Pydantic v2
- Pytest + FastAPI test client

## Quick start

1) Install dependencies:

`pip install -e ".[dev]"`

2) Run the API:

`uvicorn app.main:app --reload`

3) Open docs:

- Swagger UI: `http://127.0.0.1:8000/docs`

## API endpoints

- `GET /` - service info and enabled MVP features
- `GET /health` - health check
- `POST /ingest/chapter` - ingest user/book/chapter text
- `POST /ask` - ask question against ingested chapter
- `POST /study-pack` - generate highlights/notes/flashcards/quiz/anki payload
- `POST /focus-session/start` - start focus lock session
- `POST /focus-session/{session_id}/progress` - update focus progress
- `GET /profile/{user_id}` - fetch progressive learner profile

## Testing

Run:

`pytest -q`

The test suite validates:

- chapter ingestion + chapter-aware Q&A flow
- study-pack/Anki payload generation
- focus-session gate logic
- reader profile updates

## MVP boundaries

This repository currently ships the backend platform core. The following are intentionally deferred to the next stage:

- Native iOS/Android/desktop readers and PDF/ePub rendering
- On-device quantized model runtime integration
- Real speech-to-text/text-to-speech execution
- Live AnkiConnect bridge service
- Cloud community voting/ranking for shared flashcards and questions
