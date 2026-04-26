# Tabor: Active Reading & Cognitive Illumination

Tabor is an offline-first reading MVP that turns EPUB/PDF-style content into an active learning session. The prototype is dependency-free and runs as a static web app so the product loop can be tested quickly on desktop or tablet browsers.

## MVP scope

- Distraction-aware reader with a page-based focus airlock.
- Offline-style assistant panel for summaries, questions, translations, notes, quotes, and flashcards.
- Progressive AI profile that only references chapters the reader has completed.
- Anki-ready TSV export for generated flashcards.
- Community deck preview modeled after Kindle popular highlights.
- Lightweight tests for the learning and focus logic.

## Run locally

```bash
npm run serve
```

Open `http://localhost:4173`.

## Test

```bash
npm test
```
