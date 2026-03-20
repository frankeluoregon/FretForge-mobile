from __future__ import annotations
from pydantic import BaseModel


class TabEntry(BaseModel):
    id: int | None = None
    artist: str
    artist_raw: str = ""
    song: str
    song_raw: str = ""
    format: str
    source_dir: str
    genre: str = ""
    version: int = 1
    path: str
    file_size: int = 0
    metadata_json: str = ""


class SearchResult(BaseModel):
    artist: str
    song: str
    format: str
    genre: str = ""
    path: str
    rank: float = 0.0


class LibraryStats(BaseModel):
    total_files: int = 0
    total_artists: int = 0
    total_songs: int = 0
    by_format: dict[str, int] = {}
    by_source: dict[str, int] = {}
    by_genre: dict[str, int] = {}
