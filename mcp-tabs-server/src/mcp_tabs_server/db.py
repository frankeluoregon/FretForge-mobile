"""SQLite database helpers — schema, inserts, queries."""
from __future__ import annotations

import sqlite3
from pathlib import Path

import aiosqlite

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DB_PATH = DATA_DIR / "tabs_index.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS tabs (
    id            INTEGER PRIMARY KEY,
    artist        TEXT NOT NULL,
    artist_raw    TEXT DEFAULT '',
    song          TEXT NOT NULL,
    song_raw      TEXT DEFAULT '',
    format        TEXT NOT NULL,
    source_dir    TEXT NOT NULL,
    genre         TEXT DEFAULT '',
    version       INTEGER DEFAULT 1,
    path          TEXT NOT NULL UNIQUE,
    file_size     INTEGER DEFAULT 0,
    indexed_at    TEXT DEFAULT (datetime('now')),
    metadata_json TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_artist      ON tabs(artist);
CREATE INDEX IF NOT EXISTS idx_song        ON tabs(song);
CREATE INDEX IF NOT EXISTS idx_artist_song ON tabs(artist, song);
CREATE INDEX IF NOT EXISTS idx_format      ON tabs(format);
CREATE INDEX IF NOT EXISTS idx_genre       ON tabs(genre);

CREATE VIRTUAL TABLE IF NOT EXISTS tabs_fts
    USING fts5(artist, song, content=tabs, content_rowid=id);

CREATE TRIGGER IF NOT EXISTS tabs_ai AFTER INSERT ON tabs BEGIN
    INSERT INTO tabs_fts(rowid, artist, song) VALUES (new.id, new.artist, new.song);
END;

CREATE TABLE IF NOT EXISTS index_meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);
"""


def init_db_sync() -> sqlite3.Connection:
    """Create the database (if needed) and return a sync connection."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.executescript(SCHEMA)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


_async_db: aiosqlite.Connection | None = None


async def get_async_db() -> aiosqlite.Connection:
    """Return a shared async connection (singleton).

    The connection is created once and reused for all requests, avoiding
    the "threads can only be started once" RuntimeError that occurs on
    Windows when aiosqlite connections are rapidly created/closed.
    """
    global _async_db
    if _async_db is None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        _async_db = await aiosqlite.connect(str(DB_PATH))
        _async_db.row_factory = aiosqlite.Row
    return _async_db


async def search(db: aiosqlite.Connection, query: str = "",
                 artist: str = "", song: str = "", fmt: str = "",
                 genre: str = "", limit: int = 50) -> list[dict]:
    """Search tabs by FTS query and/or structured filters."""
    conditions = []
    params: list = []

    if query:
        conditions.append("t.id IN (SELECT rowid FROM tabs_fts WHERE tabs_fts MATCH ?)")
        params.append(query)
    if artist:
        conditions.append("t.artist LIKE ?")
        params.append(f"%{artist}%")
    if song:
        conditions.append("t.song LIKE ?")
        params.append(f"%{song}%")
    if fmt:
        conditions.append("t.format = ?")
        params.append(fmt)
    if genre:
        conditions.append("t.genre LIKE ?")
        params.append(f"%{genre}%")

    where = " AND ".join(conditions) if conditions else "1=1"
    sql = f"""
        SELECT t.artist, t.song, t.format, t.genre, t.path, t.source_dir
        FROM tabs t
        WHERE {where}
        ORDER BY t.artist, t.song
        LIMIT ?
    """
    params.append(limit)
    cursor = await db.execute(sql, params)
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def get_stats(db: aiosqlite.Connection) -> dict:
    stats: dict = {}
    cur = await db.execute("SELECT COUNT(*) FROM tabs")
    stats["total_files"] = (await cur.fetchone())[0]
    cur = await db.execute("SELECT COUNT(DISTINCT artist) FROM tabs")
    stats["total_artists"] = (await cur.fetchone())[0]
    cur = await db.execute("SELECT COUNT(DISTINCT artist || '|' || song) FROM tabs")
    stats["total_songs"] = (await cur.fetchone())[0]

    by_format: dict[str, int] = {}
    cur = await db.execute("SELECT format, COUNT(*) FROM tabs GROUP BY format ORDER BY COUNT(*) DESC")
    for row in await cur.fetchall():
        by_format[row[0]] = row[1]
    stats["by_format"] = by_format

    by_source: dict[str, int] = {}
    cur = await db.execute("SELECT source_dir, COUNT(*) FROM tabs GROUP BY source_dir ORDER BY COUNT(*) DESC")
    for row in await cur.fetchall():
        by_source[row[0]] = row[1]
    stats["by_source"] = by_source

    by_genre: dict[str, int] = {}
    cur = await db.execute("SELECT genre, COUNT(*) FROM tabs WHERE genre != '' GROUP BY genre ORDER BY COUNT(*) DESC")
    for row in await cur.fetchall():
        by_genre[row[0]] = row[1]
    stats["by_genre"] = by_genre

    return stats
