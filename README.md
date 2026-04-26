# Tabor — Active Reading & Cognitive Illumination (MVP)

Tabor is an offline-first, AI-integrated reading environment that bridges
passive consumption and active retention. It turns any uploaded PDF, EPUB, or
text file into a chapter-by-chapter tutoring experience with voice chat,
auto-generated flashcards, spaced repetition, focus mode, and an "airlock"
that gates the library behind your due-card queue.

## Why Tabor?

Reading is one-directional. Tabor makes it bidirectional: every chapter
becomes a tutor that can answer questions, propose highlights, generate
Anki-ready flashcards, quiz you on the way out, and remember exactly what
you've read so it never spoils later chapters.

## MVP feature set

| Capability | What it does |
| --- | --- |
| **Library** | Drop EPUB / PDF / TXT / MD files. Tabor parses them into chapters automatically. |
| **Reader** | Distraction-light chapter view with TOC, progress, completion tracking. |
| **Voice / text tutor** | Push-to-talk (Web Speech API) or type. Answers are grounded in the *current* chapter only. |
| **Highlights** | Select any text to save it. AI can also suggest the most quote-worthy lines. |
| **Auto-flashcards** | One click turns a chapter into mixed cloze + comprehension cards. |
| **Spaced repetition** | Built-in SM-2 scheduler with `Again / Hard / Good / Easy` review UI. |
| **Anki export** | TSV download (Front / Back / Tags) at `/api/anki-export`. |
| **Airlock** | Optional setting forces N due-card reviews before the library unlocks. |
| **Focus session** | Pomodoro-style timer that toggles a focus-mode style on the page. |
| **Progressive AI profile** | Per-chapter AI study notes are stored, scoped to chapters the reader has reached. |
| **End-of-chapter quiz** | One click generates open-ended recall questions. |

## On-device AI

Tabor speaks the OpenAI Chat Completions protocol. Point it at any local
inference server in `Settings`:

- `http://localhost:11434/v1` for [Ollama](https://ollama.com)
- `http://localhost:1234/v1` for LM Studio
- A llama.cpp `server` build, etc.

If no endpoint is configured (or it is unreachable), Tabor falls back to a
pure-Python heuristic AI that performs extractive Q&A, summaries,
highlight ranking, and cloze flashcard generation. This guarantees the entire
product works **fully offline** with no network access.

## Run it

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then open <http://localhost:8000>.

## Architecture

```
app/
  main.py        FastAPI routes (pages + JSON API)
  db.py          SQLite schema, settings, helpers
  parser.py      PDF / EPUB / TXT chapter splitter
  ai.py          AI service: remote OpenAI-compatible + offline heuristic fallback
  srs.py         SM-2 spaced repetition scheduler
  templates/     Jinja2 templates (library, reader, review, settings)
  static/        Vanilla CSS + JS (no build step)
  data/          SQLite DB + uploaded files (gitignored)
```

## Roadmap (post-MVP)

- Cloud sync of decks and community-voted "popular highlights".
- Auto-translation of foreign-language source material.
- Native desktop / iPad / e-ink clients with kiosk-mode airlock.
- Cross-book knowledge graph: "Atomic Habits → cue/craving" referenced in
  another book's metaphor.
