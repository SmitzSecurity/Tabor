from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ChapterRecord:
    chapter_id: str
    chapter_title: str
    chapter_text: str
    synopsis: str
    key_terms: list[str]


@dataclass
class UserProfileState:
    mastered_concepts_by_book: dict[str, list[str]] = field(default_factory=dict)
    difficult_concepts_by_book: dict[str, list[str]] = field(default_factory=dict)
    chapters_completed: dict[str, int] = field(default_factory=dict)
    profile_notes: list[str] = field(default_factory=list)


@dataclass
class FocusSessionRecord:
    session_id: str
    user_id: str
    required_pages: int
    required_due_cards: int
    min_minutes_locked: int
    pages_completed: int
    cards_completed: int
    started_at: str


class InMemoryStore:
    def __init__(self) -> None:
        self.chapters: dict[tuple[str, str, int], ChapterRecord] = {}
        self.user_profiles: dict[str, UserProfileState] = {}
        self.focus_sessions: dict[str, FocusSessionRecord] = {}

    def get_or_create_profile(self, user_id: str) -> UserProfileState:
        profile = self.user_profiles.get(user_id)
        if profile is None:
            profile = UserProfileState()
            self.user_profiles[user_id] = profile
        return profile

