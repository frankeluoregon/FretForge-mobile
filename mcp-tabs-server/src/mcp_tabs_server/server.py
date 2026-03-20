"""MCP server for the guitar tab library."""
from __future__ import annotations

import asyncio
import gzip
import json
import sys
from pathlib import Path

from mcp.server.fastmcp import FastMCP

from . import db
from .parsers.chordpro import parse_chordpro_header, strip_chords
from .parsers.text import read_text_file

mcp = FastMCP(
    "Guitar Tab Library",
    instructions="Search and read from a 593K-file guitar tab archive",
)

TABS_ROOT = Path("D:/tabs")


# ── Tools ────────────────────────────────────────────────────────────────────


@mcp.tool()
async def search_tabs(
    query: str = "",
    artist: str = "",
    song: str = "",
    format: str = "",
    genre: str = "",
    limit: int = 50,
) -> list[dict]:
    """Search the tab library by free text, artist, song, format, or genre.

    Examples:
      search_tabs(query="metallica sandman")
      search_tabs(artist="Beatles", format="gp4")
      search_tabs(genre="Classical", limit=20)
    """
    conn = await db.get_async_db()
    return await db.search(conn, query=query, artist=artist, song=song,
                           fmt=format, genre=genre, limit=limit)


@mcp.tool()
async def list_artists(prefix: str = "", genre: str = "", limit: int = 100) -> list[str]:
    """List distinct artists, optionally filtered by name prefix or genre."""
    conn = await db.get_async_db()
    conditions = []
    params: list = []
    if prefix:
        conditions.append("artist LIKE ?")
        params.append(f"{prefix}%")
    if genre:
        conditions.append("genre LIKE ?")
        params.append(f"%{genre}%")
    where = " AND ".join(conditions) if conditions else "1=1"
    sql = f"SELECT DISTINCT artist FROM tabs WHERE {where} ORDER BY artist LIMIT ?"
    params.append(limit)
    cur = await conn.execute(sql, params)
    return [row[0] for row in await cur.fetchall()]


@mcp.tool()
async def list_songs_by_artist(artist: str) -> list[dict]:
    """List all songs by an artist with their available formats."""
    conn = await db.get_async_db()
    sql = """
        SELECT song, GROUP_CONCAT(DISTINCT format) as formats, COUNT(*) as count
        FROM tabs WHERE artist LIKE ? GROUP BY song ORDER BY song
    """
    cur = await conn.execute(sql, [f"%{artist}%"])
    rows = await cur.fetchall()
    return [{"song": r[0], "formats": r[1], "count": r[2]} for r in rows]


@mcp.tool()
async def list_formats_for_song(artist: str, song: str) -> list[dict]:
    """Find all available formats and versions of a specific song."""
    conn = await db.get_async_db()
    sql = """
        SELECT format, version, path, source_dir, file_size
        FROM tabs WHERE artist LIKE ? AND song LIKE ?
        ORDER BY format, version
    """
    cur = await conn.execute(sql, [f"%{artist}%", f"%{song}%"])
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


@mcp.tool()
async def get_tab_content(path: str) -> str:
    """Read and return the content of a tab file.

    Handles gzip decompression for .gz files, plain text for .crd/.tab/.txt etc.
    For binary formats (GP, PTB, MIDI, TBT), returns a metadata summary.
    """
    p = Path(path)
    if not p.exists():
        return f"Error: file not found: {path}"

    ext = p.suffix.lower()
    compound = p.name.lower()

    # Gzipped text (OLGA)
    if compound.endswith(".txt.gz") or ext == ".gz":
        with gzip.open(path, "rt", encoding="utf-8", errors="replace") as f:
            return f.read()

    # Plain text formats
    if ext in (".txt", ".crd", ".tab", ".btab", ".pro", ".lyr"):
        return read_text_file(path)

    # ChordPro
    if ext == ".chopro":
        text = read_text_file(path)
        meta = parse_chordpro_header(text)
        header = "\n".join(f"{k}: {v}" for k, v in meta.items())
        return f"--- ChordPro Metadata ---\n{header}\n\n--- Content ---\n{text}"

    # GuitarPro
    if ext in (".gp3", ".gp4", ".gp5"):
        return _read_guitarpro(path)

    # MIDI
    if ext == ".mid":
        return _read_midi(path)

    # Binary formats we can't render as text
    if ext in (".gpx", ".gtp", ".ptb", ".tbt"):
        return f"Binary format ({ext}). Use get_tab_metadata() for details. Path: {path}"

    return f"Unsupported format: {ext}"


@mcp.tool()
async def get_tab_metadata(path: str) -> dict:
    """Extract detailed metadata from a tab file.

    For GP files: title, artist, tracks, tuning, tempo.
    For MIDI: tracks, tempo, duration.
    For ChordPro: title, artist, key, capo.
    """
    p = Path(path)
    if not p.exists():
        return {"error": f"file not found: {path}"}

    ext = p.suffix.lower()

    if ext in (".gp3", ".gp4", ".gp5"):
        try:
            import guitarpro
            song = guitarpro.parse(path)
            tracks = []
            for t in song.tracks:
                strings = [str(s.value) for s in t.strings] if t.strings else []
                tracks.append({"name": t.name, "strings": len(t.strings), "tuning": strings})
            return {
                "title": song.title or "",
                "artist": song.artist or "",
                "album": song.album or "",
                "tempo": song.tempo.value if song.tempo else 0,
                "tracks": tracks,
            }
        except Exception as e:
            return {"error": str(e)}

    if ext == ".mid":
        try:
            import mido
            mid = mido.MidiFile(path)
            track_names = []
            for t in mid.tracks:
                for msg in t:
                    if msg.type == "track_name":
                        track_names.append(msg.name)
                        break
            return {
                "type": mid.type,
                "ticks_per_beat": mid.ticks_per_beat,
                "num_tracks": len(mid.tracks),
                "track_names": track_names,
                "duration_sec": round(mid.length, 1),
            }
        except Exception as e:
            return {"error": str(e)}

    if ext in (".chopro", ".pro"):
        try:
            text = read_text_file(path)
            return parse_chordpro_header(text)
        except Exception as e:
            return {"error": str(e)}

    return {"format": ext, "size": p.stat().st_size}


@mcp.tool()
async def get_library_stats() -> dict:
    """Return summary statistics: total files, artists, songs, counts by format/genre."""
    conn = await db.get_async_db()
    return await db.get_stats(conn)


@mcp.tool()
async def reindex(full: bool = False) -> dict:
    """Rebuild the library index. full=True for complete rescan, False for incremental."""
    from .indexer import index_library
    return index_library(full=full)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _read_guitarpro(path: str) -> str:
    """Render a GuitarPro file as a text summary."""
    try:
        import guitarpro
        song = guitarpro.parse(path)
        lines = [
            f"Title: {song.title}",
            f"Artist: {song.artist}",
            f"Album: {song.album}",
            f"Tempo: {song.tempo.value if song.tempo else '?'} BPM",
            f"Tracks: {len(song.tracks)}",
            "",
        ]
        for i, t in enumerate(song.tracks):
            tuning = ", ".join(str(s.value) for s in t.strings) if t.strings else "?"
            lines.append(f"  Track {i + 1}: {t.name} ({len(t.strings)} strings, tuning: {tuning})")
            lines.append(f"    Measures: {len(t.measures)}")
        return "\n".join(lines)
    except Exception as e:
        return f"Error reading GuitarPro file: {e}"


def _read_midi(path: str) -> str:
    """Render a MIDI file as a text summary."""
    try:
        import mido
        mid = mido.MidiFile(path)
        lines = [
            f"MIDI Type: {mid.type}",
            f"Ticks/beat: {mid.ticks_per_beat}",
            f"Tracks: {len(mid.tracks)}",
            f"Duration: {mid.length:.1f}s",
            "",
        ]
        for i, t in enumerate(mid.tracks):
            name = ""
            for msg in t:
                if msg.type == "track_name":
                    name = msg.name
                    break
            lines.append(f"  Track {i + 1}: {name or '(unnamed)'} ({len(t)} messages)")
        return "\n".join(lines)
    except Exception as e:
        return f"Error reading MIDI file: {e}"


# ── Entry point ──────────────────────────────────────────────────────────────


def main():
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(mcp.run_stdio_async())


if __name__ == "__main__":
    main()
