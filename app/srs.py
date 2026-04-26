"""Tiny SM-2 spaced repetition scheduler.

Quality is a 0..5 score where:
    0 - complete blackout
    3 - correct with serious difficulty
    5 - perfect recall
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass
class CardState:
    ease: float
    interval_days: float
    repetitions: int


def review(state: CardState, quality: int) -> tuple[CardState, datetime]:
    quality = max(0, min(5, quality))
    if quality < 3:
        new_reps = 0
        new_interval = 0.5  # 12h
    else:
        new_reps = state.repetitions + 1
        if new_reps == 1:
            new_interval = 1
        elif new_reps == 2:
            new_interval = 6
        else:
            new_interval = round(state.interval_days * state.ease, 2)

    new_ease = state.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ease = max(1.3, new_ease)

    next_state = CardState(
        ease=new_ease,
        interval_days=new_interval,
        repetitions=new_reps,
    )
    next_due = datetime.utcnow() + timedelta(days=new_interval)
    return next_state, next_due
