"""First-run indexer — walks d:\\tabs and builds the SQLite index."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

from .db import init_db_sync
from .parsers.olga import parse_olga_path
from .parsers.tabit import parse_tabit_path
from .parsers.filename import parse_filename
from .parsers.chordpro import parse_chordpro_header

TABS_ROOT = Path("D:/tabs")

# Top-level dirs and which parser to use
# "olga" = deep path parser, "tabit" = genre path parser, "flat" = filename parser
DIR_PARSERS: dict[str, str] = {
    "OLGA": "olga",
    "TabIt": "tabit",
    "GP3": "flat", "GP4": "flat", "GP5": "flat", "GPX": "flat", "GTP": "flat",
    "PTB": "flat",
    "CRD": "flat", "TAB": "flat", "BTAB": "flat",
    "PRO": "flat", "LYR": "flat",
    "MID": "flat", "TXT": "flat",
    "CHOPRO": "flat",
    "Classtab": "flat",
}

# Extensions we care about
VALID_EXTS = {
    ".gz", ".txt", ".tab", ".crd", ".btab", ".pro", ".lyr", ".chopro",
    ".gp3", ".gp4", ".gp5", ".gpx", ".gtp",
    ".ptb", ".tbt", ".mid",
    ".htm",  # Classtab index (skip for now)
}

INSERT_SQL = """
INSERT OR IGNORE INTO tabs
    (artist, artist_raw, song, song_raw, format, source_dir, genre, version, path, file_size)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""

BATCH_SIZE = 2000


def index_library(root: Path | None = None, full: bool = True) -> dict:
    """Scan the tab library and populate the SQLite index.

    Returns a summary dict with counts.
    """
    root = root or TABS_ROOT
    conn = init_db_sync()

    if full:
        conn.execute("DELETE FROM tabs")
        conn.execute("DELETE FROM tabs_fts")
        conn.commit()

    total = 0
    skipped = 0
    batch: list[tuple] = []
    t0 = time.time()

    for source_dir, parser_type in DIR_PARSERS.items():
        dir_path = root / source_dir
        if not dir_path.exists():
            continue

        print(f"Scanning {source_dir}...", flush=True)
        dir_count = 0

        for dirpath, _dirnames, filenames in os.walk(dir_path):
            for fname in filenames:
                ext = _ext(fname)
                if ext not in VALID_EXTS:
                    continue

                abs_path = os.path.join(dirpath, fname)
                rel_path = os.path.relpath(abs_path, root).replace("\\", "/")

                entry = _parse_entry(rel_path, source_dir, parser_type, abs_path)
                if entry is None:
                    skipped += 1
                    continue

                try:
                    fsize = os.path.getsize(abs_path)
                except OSError:
                    fsize = 0

                batch.append((
                    entry["artist"], entry.get("artist_raw", ""),
                    entry["song"], entry.get("song_raw", ""),
                    entry["format"], source_dir,
                    entry.get("genre", ""), entry.get("version", 1),
                    abs_path, fsize,
                ))

                dir_count += 1
                total += 1

                if len(batch) >= BATCH_SIZE:
                    _flush(conn, batch)

        print(f"  {source_dir}: {dir_count:,} files", flush=True)

    # Final flush
    if batch:
        _flush(conn, batch)

    # Update meta
    conn.execute(
        "INSERT OR REPLACE INTO index_meta (key, value) VALUES ('last_indexed', datetime('now'))"
    )
    conn.commit()
    conn.close()

    elapsed = time.time() - t0
    summary = {"total_indexed": total, "skipped": skipped, "elapsed_sec": round(elapsed, 1)}
    print(f"\nDone: {total:,} files indexed, {skipped:,} skipped in {elapsed:.1f}s")
    return summary


def _parse_entry(rel_path: str, source_dir: str, parser_type: str,
                 abs_path: str) -> dict | None:
    """Route to the correct parser based on directory type."""
    if parser_type == "olga":
        return parse_olga_path(rel_path)
    if parser_type == "tabit":
        return parse_tabit_path(rel_path)

    # Flat directory — use filename parser
    entry = parse_filename(rel_path, source_dir)

    # For .chopro/.pro files, try to enrich artist/song from file header
    if entry["format"] in ("chopro", "pro") and entry["artist"] == "Unknown":
        try:
            with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
                header = f.read(4096)
            meta = parse_chordpro_header(header)
            if "title" in meta:
                entry["song"] = meta["title"]
            if "artist" in meta:
                entry["artist"] = meta["artist"]
        except OSError:
            pass

    return entry


def _flush(conn, batch: list[tuple]) -> None:
    conn.executemany(INSERT_SQL, batch)
    conn.commit()
    batch.clear()


def _ext(fname: str) -> str:
    """Get extension, handling .txt.gz compound extension."""
    if fname.endswith(".txt.gz"):
        return ".gz"
    low = fname.lower()
    dot = low.rfind(".")
    return low[dot:] if dot >= 0 else ""


def main():
    """CLI entry point: `tabs-index`"""
    full = "--full" in sys.argv or not (TABS_ROOT.parent / "data" / "tabs_index.db").exists()
    index_library(full=full)


if __name__ == "__main__":
    main()
