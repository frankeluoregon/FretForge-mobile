"""TabIt (.tbt) parser — artist/song/genre from directory structure.

Expected structure: TabIt/{genre}/{letter}/{artist}/{song}.tbt
"""
from __future__ import annotations

import re
from pathlib import PurePosixPath


def parse_tabit_path(rel_path: str) -> dict | None:
    """Extract artist, song, genre from a TabIt relative path."""
    parts = PurePosixPath(rel_path).parts
    # Minimum: TabIt / genre / letter / artist / file.tbt
    if len(parts) < 5:
        # Shallow files: TabIt/genre/file.tbt or TabIt/file.tbt
        filename = PurePosixPath(rel_path).stem
        genre = parts[1] if len(parts) >= 3 else ""
        return {
            "artist": "Unknown",
            "artist_raw": "",
            "song": filename,
            "song_raw": filename,
            "format": "tbt",
            "genre": genre,
            "version": 1,
        }

    genre = parts[1]
    artist_raw = parts[-2]  # directory right above the file
    filename = PurePosixPath(rel_path).stem

    # Strip trailing (2), (3)
    version = 1
    ver_match = re.search(r"\s*\((\d+)\)\s*$", filename)
    if ver_match:
        version = int(ver_match.group(1))
        filename = filename[: ver_match.start()].strip()

    return {
        "artist": artist_raw,
        "artist_raw": artist_raw,
        "song": filename,
        "song_raw": filename,
        "format": "tbt",
        "genre": genre,
        "version": version,
    }
