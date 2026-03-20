"""Filename-based parser for flat directories (GP3/4/5, GPX, PTB, etc.).

Handles two naming conventions:
  1. "Artist - Song Title (N).ext"  → split on " - "
  2. "artist-song_name-12345.ext"   → split on hyphens, strip trailing ID
  3. "song_name.ext"                → artist = Unknown
"""
from __future__ import annotations

import re
from pathlib import PurePosixPath


def parse_filename(rel_path: str, source_dir: str) -> dict:
    """Extract artist and song from a filename in a flat directory."""
    filename = PurePosixPath(rel_path).stem  # strip extension

    # Try "Artist - Song (ver)" pattern
    if " - " in filename:
        parts = filename.split(" - ", 1)
        artist_raw = parts[0].strip()
        song_raw = parts[1].strip()
    else:
        artist_raw = ""
        song_raw = filename

    # Extract version from trailing (2), (3), etc.
    version = 1
    ver_match = re.search(r"\s*\((\d+)\)\s*$", song_raw)
    if ver_match:
        version = int(ver_match.group(1))
        song_raw = song_raw[: ver_match.start()].strip()

    # PTB naming: "artist-song-12345" — strip trailing numeric ID
    if not artist_raw and "-" in song_raw:
        parts = song_raw.rsplit("-", 1)
        if len(parts) == 2 and parts[1].strip().isdigit():
            song_raw = parts[0].strip()
        # Try splitting on first hyphen for artist
        parts = song_raw.split("-", 1)
        if len(parts) == 2 and len(parts[0]) > 1:
            artist_raw = parts[0].strip()
            song_raw = parts[1].strip()

    # Clean up underscores
    artist = _clean(artist_raw) if artist_raw else "Unknown"
    song = _clean(song_raw) if song_raw else filename

    ext = PurePosixPath(rel_path).suffix.lstrip(".").lower()

    return {
        "artist": artist,
        "artist_raw": artist_raw or "Unknown",
        "song": song,
        "song_raw": song_raw,
        "format": ext,
        "version": version,
    }


def _clean(name: str) -> str:
    name = re.sub(r"[_]+", " ", name).strip()
    # Title-case only if all lowercase or all uppercase
    if name == name.lower() or name == name.upper():
        return name.title()
    return name
