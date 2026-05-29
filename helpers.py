# -*- coding: utf-8 -*-

from __future__ import annotations

import re
import time
from datetime import date, datetime
from typing import Any


def _now_ts() -> float:
    return time.time()


def _today_key() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _date_key(value: date) -> str:
    return value.strftime("%Y-%m-%d")


def _safe_int(value: Any, default: int, minimum: int = 0, maximum: int | None = None) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    parsed = max(minimum, parsed)
    if maximum is not None:
        parsed = min(maximum, parsed)
    return parsed


def _safe_float(value: Any, default: float, minimum: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, parsed)


def _single_line(text: Any, limit: int = 80) -> str:
    normalized = re.sub(r"\s+", " ", str(text or "")).strip()
    return normalized[:limit]


def _strip_internal_message_blocks(text: Any) -> str:
    normalized = str(text or "")
    normalized = re.sub(r"\[\[TTSBLOCK:[^\]]*\]\]", "", normalized)
    normalized = re.sub(r"<tts\b[^>]*>.*?</tts>", "", normalized, flags=re.IGNORECASE | re.DOTALL)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized
