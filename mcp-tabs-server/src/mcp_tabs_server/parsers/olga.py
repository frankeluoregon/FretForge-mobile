"""OLGA archive parser — artist/song from deep path + gzip decompression."""
from __future__ import annotations

import gzip
import re
from pathlib import PurePosixPath

# Suffix → format mapping for OLGA filenames
_SUFFIX_MAP = {
    "_btab": "btab",
    "_bass": "btab",
    "_tab": "tab",
    "_crd": "crd",
    "_pro": "pro",
    "_lyr": "lyr",
}


def parse_olga_path(rel_path: str) -> dict | None:
    """Extract artist, song, format from an OLGA relative path.

    Expected structure: OLGA/{letter}/{range}/{artist}/{filename}.txt.gz
    Returns dict with artist, song, format, version or None if unparseable.
    """
    parts = PurePosixPath(rel_path).parts
    # Minimum: OLGA / letter / range / artist / file
    if len(parts) < 5:
        return None

    artist_raw = parts[3]
    filename = parts[-1]

    # Strip .txt.gz or .gz
    name = filename
    for ext in (".txt.gz", ".gz", ".txt"):
        if name.endswith(ext):
            name = name[: -len(ext)]
            break

    # Detect format suffix
    fmt = "tab"  # default
    for suffix, detected_fmt in _SUFFIX_MAP.items():
        if name.endswith(suffix):
            name = name[: -len(suffix)]
            fmt = detected_fmt
            break

    # Detect version (_ver2, _ver3, etc.)
    version = 1
    ver_match = re.search(r"_ver(\d+)$", name)
    if ver_match:
        version = int(ver_match.group(1))
        name = name[: ver_match.start()]

    artist = _clean_name(artist_raw)
    song = _clean_name(name)

    # Skip special dirs
    if artist_raw in ("lessons", "unknown"):
        artist = artist_raw.title()

    return {
        "artist": artist,
        "artist_raw": artist_raw,
        "song": song,
        "song_raw": name,
        "format": fmt,
        "version": version,
    }


def read_olga_file(abs_path: str) -> str:
    """Read and decompress an OLGA .txt.gz file."""
    if abs_path.endswith(".gz"):
        with gzip.open(abs_path, "rt", encoding="utf-8", errors="replace") as f:
            return f.read()
    with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def _clean_name(raw: str) -> str:
    """Convert underscore-separated name to title case."""
    return re.sub(r"[_]+", " ", raw).strip().title()
