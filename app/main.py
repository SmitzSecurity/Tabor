"""Tabor MVP — FastAPI server.

A single-process backend that serves the reader UI, the upload + library API,
voice/text chat, flashcard generation, SRS review, focus + airlock controls,
and a CSV export compatible with Anki imports.
"""
from __future__ import annotations

import csv
import io
import os
import sqlite3
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import ai, db, parser
from .srs import CardState, review as srs_review

BASE_DIR = os.path.dirname(__file__)

app = FastAPI(title="Tabor", description="Active Reading & Cognitive Illumination")
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_dict(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    return {k: row[k] for k in row.keys()}


def _book_or_404(book_id: int) -> dict:
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM books WHERE id=?", (book_id,)).fetchone()
        if not row:
            raise HTTPException(404, "book not found")
        return _row_to_dict(row)  # type: ignore[return-value]
    finally:
        conn.close()


def _chapter_or_404(book_id: int, idx: int) -> dict:
    conn = db.get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM chapters WHERE book_id=? AND idx=?", (book_id, idx)
        ).fetchone()
        if not row:
            raise HTTPException(404, "chapter not found")
        return _row_to_dict(row)  # type: ignore[return-value]
    finally:
        conn.close()


def _due_count() -> int:
    conn = db.get_conn()
    try:
        row = conn.execute(
            "SELECT COUNT(*) AS c FROM flashcards WHERE due_at <= CURRENT_TIMESTAMP"
        ).fetchone()
        return int(row["c"]) if row else 0
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    conn = db.get_conn()
    try:
        books = [
            _row_to_dict(r)
            for r in conn.execute(
                "SELECT b.*, "
                "(SELECT COUNT(*) FROM chapters c WHERE c.book_id=b.id) AS chapter_count, "
                "(SELECT COUNT(*) FROM chapters c WHERE c.book_id=b.id AND c.completed=1) AS completed_count "
                "FROM books b ORDER BY b.created_at DESC"
            ).fetchall()
        ]
        flashcard_count = conn.execute("SELECT COUNT(*) AS c FROM flashcards").fetchone()["c"]
        highlight_count = conn.execute("SELECT COUNT(*) AS c FROM highlights").fetchone()["c"]
    finally:
        conn.close()

    settings = db.all_settings()
    airlock_required = settings.get("airlock_enabled") == "1" and _due_count() >= int(
        settings.get("airlock_min_reviews", "10")
    )
    return templates.TemplateResponse(
        "library.html",
        {
            "request": request,
            "books": books,
            "settings": settings,
            "due_count": _due_count(),
            "flashcard_count": flashcard_count,
            "highlight_count": highlight_count,
            "airlock_required": airlock_required,
            "ai_configured": bool(settings.get("ai_endpoint", "").strip()),
        },
    )


@app.get("/book/{book_id}", response_class=HTMLResponse)
def book_view(request: Request, book_id: int, c: int = 0):
    book = _book_or_404(book_id)
    conn = db.get_conn()
    try:
        chapters = [
            _row_to_dict(r)
            for r in conn.execute(
                "SELECT id, idx, title, word_count, completed FROM chapters "
                "WHERE book_id=? ORDER BY idx",
                (book_id,),
            ).fetchall()
        ]
        if not chapters:
            raise HTTPException(404, "no chapters parsed")
        idx = max(0, min(c, len(chapters) - 1))
        active = _row_to_dict(
            conn.execute(
                "SELECT * FROM chapters WHERE book_id=? AND idx=?",
                (book_id, idx),
            ).fetchone()
        )
        history = [
            _row_to_dict(r)
            for r in conn.execute(
                "SELECT role, content FROM chat_messages "
                "WHERE book_id=? AND chapter_id=? "
                "ORDER BY id DESC LIMIT 20",
                (book_id, active["id"]),
            ).fetchall()
        ][::-1]
        highlights = [
            _row_to_dict(r)
            for r in conn.execute(
                "SELECT * FROM highlights WHERE book_id=? AND chapter_id=? "
                "ORDER BY id DESC",
                (book_id, active["id"]),
            ).fetchall()
        ]
        chapter_cards = conn.execute(
            "SELECT COUNT(*) AS c FROM flashcards WHERE chapter_id=?",
            (active["id"],),
        ).fetchone()["c"]
    finally:
        conn.close()

    with db.transaction() as conn:
        conn.execute(
            "UPDATE books SET last_chapter_idx=? WHERE id=?",
            (idx, book_id),
        )

    settings = db.all_settings()
    return templates.TemplateResponse(
        "reader.html",
        {
            "request": request,
            "book": book,
            "chapters": chapters,
            "active": active,
            "history": history,
            "highlights": highlights,
            "chapter_cards": chapter_cards,
            "settings": settings,
            "due_count": _due_count(),
            "ai_configured": bool(settings.get("ai_endpoint", "").strip()),
        },
    )


@app.get("/review", response_class=HTMLResponse)
def review_page(request: Request):
    conn = db.get_conn()
    try:
        cards = [
            _row_to_dict(r)
            for r in conn.execute(
                "SELECT f.*, b.title AS book_title, c.title AS chapter_title "
                "FROM flashcards f "
                "LEFT JOIN books b ON b.id=f.book_id "
                "LEFT JOIN chapters c ON c.id=f.chapter_id "
                "WHERE f.due_at <= CURRENT_TIMESTAMP "
                "ORDER BY f.due_at ASC LIMIT 50"
            ).fetchall()
        ]
        total_cards = conn.execute("SELECT COUNT(*) AS c FROM flashcards").fetchone()["c"]
    finally:
        conn.close()
    return templates.TemplateResponse(
        "review.html",
        {
            "request": request,
            "cards": cards,
            "total_cards": total_cards,
            "due_count": len(cards),
        },
    )


@app.get("/settings", response_class=HTMLResponse)
def settings_page(request: Request):
    return templates.TemplateResponse(
        "settings.html",
        {"request": request, "settings": db.all_settings()},
    )


@app.post("/settings")
def settings_save(
    ai_endpoint: str = Form(""),
    ai_model: str = Form("llama3.2"),
    ai_api_key: str = Form(""),
    airlock_enabled: str = Form("0"),
    airlock_min_reviews: str = Form("10"),
    focus_default_minutes: str = Form("25"),
    user_language: str = Form("en"),
):
    db.set_setting("ai_endpoint", ai_endpoint.strip())
    db.set_setting("ai_model", ai_model.strip() or "llama3.2")
    db.set_setting("ai_api_key", ai_api_key.strip())
    db.set_setting("airlock_enabled", "1" if airlock_enabled in ("1", "on", "true") else "0")
    try:
        int(airlock_min_reviews)
    except ValueError:
        airlock_min_reviews = "10"
    db.set_setting("airlock_min_reviews", airlock_min_reviews)
    try:
        int(focus_default_minutes)
    except ValueError:
        focus_default_minutes = "25"
    db.set_setting("focus_default_minutes", focus_default_minutes)
    db.set_setting("user_language", user_language.strip() or "en")
    return RedirectResponse("/settings", status_code=303)


# ---------------------------------------------------------------------------
# Library API
# ---------------------------------------------------------------------------

@app.post("/api/upload")
async def api_upload(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(400, "missing filename")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".pdf", ".epub", ".txt", ".md"):
        raise HTTPException(400, f"unsupported extension: {ext}")
    original = os.path.basename(file.filename)
    safe_name = f"{int(datetime.utcnow().timestamp())}_{original}"
    dst = os.path.join(db.UPLOAD_DIR, safe_name)
    with open(dst, "wb") as f:
        f.write(await file.read())
    try:
        parsed = parser.parse_book(dst, original_name=original)
    except Exception as e:  # noqa: BLE001
        os.remove(dst)
        raise HTTPException(400, f"failed to parse: {e}")

    with db.transaction() as conn:
        cur = conn.execute(
            "INSERT INTO books(title, author, source_path, file_kind) VALUES (?,?,?,?)",
            (parsed.title, parsed.author, dst, ext.lstrip(".")),
        )
        book_id = cur.lastrowid
        for i, ch in enumerate(parsed.chapters):
            conn.execute(
                "INSERT INTO chapters(book_id, idx, title, content, word_count) "
                "VALUES (?,?,?,?,?)",
                (book_id, i, ch.title, ch.content, ch.word_count),
            )
    return {"book_id": book_id, "chapters": len(parsed.chapters), "title": parsed.title}


@app.post("/api/book/{book_id}/delete")
def api_delete_book(book_id: int):
    book = _book_or_404(book_id)
    with db.transaction() as conn:
        conn.execute("DELETE FROM books WHERE id=?", (book_id,))
    try:
        if os.path.exists(book["source_path"]):
            os.remove(book["source_path"])
    except OSError:
        pass
    return {"ok": True}


@app.post("/api/chapter/{chapter_id}/complete")
def api_complete_chapter(chapter_id: int, completed: bool = True):
    with db.transaction() as conn:
        cur = conn.execute(
            "UPDATE chapters SET completed=? WHERE id=?",
            (1 if completed else 0, chapter_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "chapter not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# AI API — chat, flashcards, highlights, summary, quiz
# ---------------------------------------------------------------------------

def _load_chapter_text(chapter_id: int) -> tuple[dict, dict]:
    conn = db.get_conn()
    try:
        ch = conn.execute("SELECT * FROM chapters WHERE id=?", (chapter_id,)).fetchone()
        if not ch:
            raise HTTPException(404, "chapter not found")
        bk = conn.execute("SELECT * FROM books WHERE id=?", (ch["book_id"],)).fetchone()
        return _row_to_dict(bk), _row_to_dict(ch)  # type: ignore[return-value]
    finally:
        conn.close()


@app.post("/api/chapter/{chapter_id}/chat")
async def api_chat(chapter_id: int, request: Request):
    body = await request.json()
    question = (body.get("message") or "").strip()
    if not question:
        raise HTTPException(400, "empty message")
    book, ch = _load_chapter_text(chapter_id)
    conn = db.get_conn()
    try:
        history_rows = conn.execute(
            "SELECT role, content FROM chat_messages "
            "WHERE book_id=? AND chapter_id=? ORDER BY id DESC LIMIT 8",
            (book["id"], ch["id"]),
        ).fetchall()
    finally:
        conn.close()
    history = [{"role": r["role"], "content": r["content"]} for r in history_rows][::-1]
    answer = ai.chapter_chat(question, ch["content"], ch["title"], history)
    with db.transaction() as conn:
        conn.execute(
            "INSERT INTO chat_messages(book_id, chapter_id, role, content) VALUES(?,?,?,?)",
            (book["id"], ch["id"], "user", question),
        )
        conn.execute(
            "INSERT INTO chat_messages(book_id, chapter_id, role, content) VALUES(?,?,?,?)",
            (book["id"], ch["id"], "assistant", answer),
        )
    return {"answer": answer}


@app.post("/api/chapter/{chapter_id}/flashcards")
def api_make_flashcards(chapter_id: int, n: int = 6):
    book, ch = _load_chapter_text(chapter_id)
    cards = ai.generate_flashcards(ch["content"], ch["title"], n=n)
    saved: list[dict] = []
    with db.transaction() as conn:
        for c in cards:
            cur = conn.execute(
                "INSERT INTO flashcards(book_id, chapter_id, front, back, tags) "
                "VALUES(?,?,?,?,?)",
                (book["id"], ch["id"], c["front"], c["back"], c.get("tags", "auto")),
            )
            saved.append({"id": cur.lastrowid, **c})
    return {"cards": saved}


@app.post("/api/chapter/{chapter_id}/highlights/suggest")
def api_suggest_highlights(chapter_id: int, n: int = 3):
    book, ch = _load_chapter_text(chapter_id)
    suggestions = ai.suggest_highlights(ch["content"], n=n)
    return {"suggestions": suggestions}


@app.post("/api/chapter/{chapter_id}/highlights")
async def api_add_highlight(chapter_id: int, request: Request):
    body = await request.json()
    text = (body.get("text") or "").strip()
    note = (body.get("note") or "").strip()
    if not text:
        raise HTTPException(400, "highlight text required")
    book, ch = _load_chapter_text(chapter_id)
    with db.transaction() as conn:
        cur = conn.execute(
            "INSERT INTO highlights(book_id, chapter_id, text, note) VALUES(?,?,?,?)",
            (book["id"], ch["id"], text, note),
        )
        hid = cur.lastrowid
    return {"id": hid, "text": text, "note": note}


@app.post("/api/highlight/{hid}/delete")
def api_delete_highlight(hid: int):
    with db.transaction() as conn:
        conn.execute("DELETE FROM highlights WHERE id=?", (hid,))
    return {"ok": True}


@app.post("/api/chapter/{chapter_id}/summarize")
def api_summarize(chapter_id: int):
    book, ch = _load_chapter_text(chapter_id)
    notes = ai.summarize_chapter(ch["content"], ch["title"])
    with db.transaction() as conn:
        conn.execute("UPDATE chapters SET ai_notes=? WHERE id=?", (notes, ch["id"]))
    return {"notes": notes}


@app.post("/api/chapter/{chapter_id}/quiz")
def api_quiz(chapter_id: int, n: int = 3):
    book, ch = _load_chapter_text(chapter_id)
    questions = ai.end_of_chapter_quiz(ch["content"], ch["title"], n=n)
    return {"questions": questions}


# ---------------------------------------------------------------------------
# Flashcard review API
# ---------------------------------------------------------------------------

@app.post("/api/flashcard/{card_id}/review")
async def api_card_review(card_id: int, request: Request):
    body = await request.json()
    quality = int(body.get("quality", 3))
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM flashcards WHERE id=?", (card_id,)).fetchone()
        if not row:
            raise HTTPException(404, "card not found")
    finally:
        conn.close()
    state = CardState(
        ease=row["ease"],
        interval_days=row["interval_days"],
        repetitions=row["repetitions"],
    )
    next_state, next_due = srs_review(state, quality)
    with db.transaction() as conn:
        conn.execute(
            "UPDATE flashcards SET ease=?, interval_days=?, repetitions=?, "
            "due_at=?, last_reviewed_at=CURRENT_TIMESTAMP WHERE id=?",
            (
                next_state.ease,
                next_state.interval_days,
                next_state.repetitions,
                next_due.isoformat(sep=" "),
                card_id,
            ),
        )
    return {
        "next_due": next_due.isoformat(),
        "interval_days": next_state.interval_days,
        "ease": next_state.ease,
        "repetitions": next_state.repetitions,
    }


@app.post("/api/flashcard/{card_id}/delete")
def api_card_delete(card_id: int):
    with db.transaction() as conn:
        conn.execute("DELETE FROM flashcards WHERE id=?", (card_id,))
    return {"ok": True}


@app.get("/api/anki-export")
def api_anki_export(book_id: Optional[int] = None):
    """Anki-compatible TSV export (front<TAB>back<TAB>tags)."""
    conn = db.get_conn()
    try:
        if book_id is not None:
            rows = conn.execute(
                "SELECT front, back, tags FROM flashcards WHERE book_id=? ORDER BY id",
                (book_id,),
            ).fetchall()
            label = f"book{book_id}"
        else:
            rows = conn.execute(
                "SELECT front, back, tags FROM flashcards ORDER BY id"
            ).fetchall()
            label = "all"
    finally:
        conn.close()
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter="\t", quoting=csv.QUOTE_MINIMAL)
    for r in rows:
        front = r["front"].replace("\n", "<br>")
        back = r["back"].replace("\n", "<br>")
        writer.writerow([front, back, r["tags"] or ""])
    buf.seek(0)
    fname = f"tabor_anki_{label}.tsv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/tab-separated-values",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


# ---------------------------------------------------------------------------
# Airlock + focus session API
# ---------------------------------------------------------------------------

@app.get("/api/status")
def api_status():
    s = db.all_settings()
    return {
        "due_count": _due_count(),
        "airlock_enabled": s.get("airlock_enabled") == "1",
        "airlock_min_reviews": int(s.get("airlock_min_reviews", "10")),
        "focus_default_minutes": int(s.get("focus_default_minutes", "25")),
        "ai_configured": bool(s.get("ai_endpoint", "").strip()),
        "ai_model": s.get("ai_model", ""),
    }


@app.post("/api/session/start")
async def api_session_start(request: Request):
    body = await request.json()
    book_id = body.get("book_id")
    with db.transaction() as conn:
        cur = conn.execute(
            "INSERT INTO sessions(book_id) VALUES(?)", (book_id,)
        )
        sid = cur.lastrowid
    return {"id": sid}


@app.post("/api/session/{sid}/end")
async def api_session_end(sid: int, request: Request):
    body = await request.json()
    minutes = float(body.get("minutes", 0))
    with db.transaction() as conn:
        cur = conn.execute(
            "UPDATE sessions SET ended_at=CURRENT_TIMESTAMP, minutes_focused=? WHERE id=?",
            (minutes, sid),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "session not found")
    return {"ok": True}


@app.get("/api/profile")
def api_profile():
    """Progressive AI profile: list completed chapters and their stored notes."""
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT b.id AS book_id, b.title, c.id AS chapter_id, c.idx, c.title AS chapter_title, "
            "c.completed, c.ai_notes "
            "FROM books b JOIN chapters c ON c.book_id=b.id "
            "ORDER BY b.created_at DESC, c.idx ASC"
        ).fetchall()
        out = [_row_to_dict(r) for r in rows]
    finally:
        conn.close()
    return {"items": out}
