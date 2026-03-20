"""Minimal ChordPro / ChoPro parser.

Extracts {title:}, {artist:}, {key:}, {capo:} directives from the first
50 lines, plus strips [chord] brackets for plain lyrics view.
"""
from __future__ import annotations

import re

_DIRECTIVE_RE = re.compile(r"\{(\w+):\s*(.+?)\}", re.IGNORECASE)


def parse_chordpro_header(text: str, max_lines: int = 50) -> dict[str, str]:
    """Extract directive metadata from the top of a ChordPro file."""
    meta: dict[str, str] = {}
    for i, line in enumerate(text.splitlines()):
        if i >= max_lines:
            break
        for m in _DIRECTIVE_RE.finditer(line):
            key = m.group(1).lower()
            # Normalize aliases
            if key in ("t", "title"):
                meta["title"] = m.group(2).strip()
            elif key in ("st", "subtitle", "artist"):
                meta["artist"] = m.group(2).strip()
            elif key == "key":
                meta["key"] = m.group(2).strip()
            elif key == "capo":
                meta["capo"] = m.group(2).strip()
            elif key == "tempo":
                meta["tempo"] = m.group(2).strip()
    return meta


def strip_chords(text: str) -> str:
    """Remove [chord] brackets, returning lyrics only."""
    return re.sub(r"\[.*?\]", "", text)
