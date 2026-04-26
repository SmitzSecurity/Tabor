# Tabor

Offline-first, active-reading web app: import PDFs (IndexedDB), read in the browser, generate flashcards (mock AI or [Ollama](https://ollama.com/)), export tab-separated text for Anki import, and use a configurable **airlock** (local card reviews before the rest of the UI) plus a **focus** overlay (timer + page flips).

## Run the app

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). **Settings** lets you point at a local Ollama server; without it, the tutor uses a small built-in mock so the flow still works.

## What’s in the MVP

- PDF viewing (PDF.js) with page text for the tutor
- Highlights and read position stored locally
- AI chat route: optional Ollama, otherwise mock responses and optional `JSON_CARDS` parsing into stored flashcards
- Anki-friendly TSV export
- Airlock: N reviews per day or 8-hour period on `tabor`-tagged cards
- Focus mode overlay (from the home screen) with page-count exit from the reader

Cloud voting, true AnkiConnect sync, STT, wake-on-unlock, and EPUB are not in this slice.
