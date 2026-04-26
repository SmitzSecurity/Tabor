from fastapi.testclient import TestClient

from app.main import app, store


client = TestClient(app)


SAMPLE_TEXT = (
    "Atomic habits begin with tiny, repeatable actions. "
    "The cue-craving-response-reward loop drives behavior change. "
    "Identity-based habits are more durable than outcome-based goals. "
    "Consistency compounds into long-term transformation."
)


def test_health_and_root() -> None:
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    root = client.get("/")
    assert root.status_code == 200
    assert "study pack generation" in " ".join(root.json()["features"])


def test_reset_store() -> None:
    store.chapters.clear()
    store.user_profiles.clear()
    store.focus_sessions.clear()


def test_ingest_ask_and_study_pack_flow() -> None:
    ingest_payload = {
        "user_id": "u1",
        "book_id": "atomic-habits",
        "chapter_index": 1,
        "chapter_title": "Tiny Changes",
        "chapter_text": SAMPLE_TEXT,
    }
    ingest = client.post("/ingest/chapter", json=ingest_payload)
    assert ingest.status_code == 200
    ingest_data = ingest.json()
    assert ingest_data["chapter_id"] == "atomic-habits-ch1"
    assert len(ingest_data["key_terms"]) > 0

    ask = client.post(
        "/ask",
        json={
            "user_id": "u1",
            "book_id": "atomic-habits",
            "chapter_index": 1,
            "question": "What is the habit loop?",
            "mode": "speech",
        },
    )
    assert ask.status_code == 200
    ask_data = ask.json()
    assert "cue-craving-response-reward" in ask_data["answer"].lower()
    assert ask_data["should_save_note"] is False

    study_pack = client.post(
        "/study-pack",
        json={
            "user_id": "u1",
            "book_id": "atomic-habits",
            "chapter_index": 1,
            "include_translation": True,
            "preferred_language": "es",
        },
    )
    assert study_pack.status_code == 200
    pack = study_pack.json()
    assert len(pack["highlights"]) > 0
    assert len(pack["flashcards"]) >= 2
    assert len(pack["quiz"]) >= 1
    assert pack["anki_export_payload"]["deck_name"] == "atomic-habits::Chapter 1"
    assert pack["translated_excerpt"].startswith("[es]")


def test_focus_session_gate() -> None:
    start = client.post(
        "/focus-session/start",
        json={
            "user_id": "u2",
            "required_pages": 5,
            "required_due_cards": 3,
            "min_minutes_locked": 25,
            "starts_at_unlock": True,
            "schedule_label": "daily",
        },
    )
    assert start.status_code == 200
    state = start.json()
    assert state["unlock_eligible"] is False
    session_id = state["session_id"]

    progress_1 = client.post(
        f"/focus-session/{session_id}/progress",
        json={"pages_completed_delta": 3, "cards_completed_delta": 3},
    )
    assert progress_1.status_code == 200
    assert progress_1.json()["unlock_eligible"] is False

    progress_2 = client.post(
        f"/focus-session/{session_id}/progress",
        json={"pages_completed_delta": 2, "cards_completed_delta": 0},
    )
    assert progress_2.status_code == 200
    assert progress_2.json()["unlock_eligible"] is True


def test_profile_tracks_chapter_state() -> None:
    profile = client.get("/profile/u1")
    assert profile.status_code == 200
    data = profile.json()
    assert data["chapters_completed"]["atomic-habits"] == 1
    assert "atomic-habits" in data["mastered_concepts_by_book"]
