"""Plain-text tab reader for .crd, .tab, .btab, .lyr, .txt, .pro files."""
from __future__ import annotations


def read_text_file(abs_path: str) -> str:
    with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()
