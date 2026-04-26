"""Parse PDFs and EPUBs into chapter records.

Chapter detection strategy:
- EPUB: each spine item is treated as a chapter (using titles where present).
- PDF: split text by detected chapter headings (regex on lines starting with
  ``Chapter`` or roman/arabic-numbered headings); fall back to one chapter per
  ~3000 word block when no headings are detected.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import List

from bs4 import BeautifulSoup
from ebooklib import epub
from pypdf import PdfReader


@dataclass
class ParsedChapter:
    title: str
    content: str

    @property
    def word_count(self) -> int:
        return len(self.content.split())


@dataclass
class ParsedBook:
    title: str
    author: str
    chapters: List[ParsedChapter]


CHAPTER_HEADING_RE = re.compile(
    r"^\s*("
    r"chapter\s+[\w\-]+(?:[.:][^\n]{0,120})?"
    r"|\d{1,3}\.\s+[A-Z][^\n]{2,120}"
    r"|[IVXLCDM]+\.\s+[A-Z][^\n]{2,120}"
    r"|part\s+[\w\-]+(?:[.:][^\n]{0,120})?"
    r")\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def parse_pdf(path: str, original_name: str | None = None) -> ParsedBook:
    reader = PdfReader(path)
    meta = reader.metadata or {}
    fallback_title = os.path.splitext(original_name or os.path.basename(path))[0]
    title = (meta.get("/Title") or fallback_title).strip() or "Untitled"
    author = (meta.get("/Author") or "Unknown").strip()

    pages_text: List[str] = []
    for page in reader.pages:
        try:
            pages_text.append(page.extract_text() or "")
        except Exception:
            pages_text.append("")
    full_text = "\n\n".join(pages_text)

    chapters = _split_into_chapters(full_text)
    if not chapters:
        chapters = [ParsedChapter(title="Full Document", content=full_text.strip() or "(empty)")]
    return ParsedBook(title=title, author=author, chapters=chapters)


def _split_into_chapters(text: str) -> List[ParsedChapter]:
    matches = list(CHAPTER_HEADING_RE.finditer(text))
    if matches:
        chapters: List[ParsedChapter] = []
        for i, m in enumerate(matches):
            start = m.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            heading = m.group(0).strip()
            body = text[start:end].strip()
            # Cut off the heading line from body for cleaner content.
            body_lines = body.split("\n", 1)
            body_clean = body_lines[1].strip() if len(body_lines) > 1 else body
            if len(body_clean.split()) < 30:
                continue
            chapters.append(ParsedChapter(title=heading[:120], content=body_clean))
        if chapters:
            return chapters

    # Fallback: split by ~3000 word blocks.
    words = text.split()
    if len(words) < 50:
        return []
    block = 3000
    out: List[ParsedChapter] = []
    for i in range(0, len(words), block):
        chunk = " ".join(words[i : i + block])
        out.append(ParsedChapter(title=f"Section {len(out) + 1}", content=chunk))
    return out


def parse_epub(path: str, original_name: str | None = None) -> ParsedBook:
    book = epub.read_epub(path)
    title = os.path.splitext(original_name or os.path.basename(path))[0] or "Untitled"
    author = "Unknown"
    md_title = book.get_metadata("DC", "title")
    if md_title:
        title = md_title[0][0]
    md_creator = book.get_metadata("DC", "creator")
    if md_creator:
        author = md_creator[0][0]

    chapters: List[ParsedChapter] = []
    for item in book.get_items():
        if item.get_type() != 9:  # ITEM_DOCUMENT
            continue
        soup = BeautifulSoup(item.get_content(), "html.parser")
        # Drop scripts/styles
        for tag in soup(["script", "style"]):
            tag.decompose()
        ch_title = ""
        for h in soup.find_all(["h1", "h2", "h3"]):
            ch_title = h.get_text(strip=True)
            if ch_title:
                break
        text = soup.get_text("\n", strip=True)
        if len(text.split()) < 50:
            continue
        if not ch_title:
            ch_title = f"Section {len(chapters) + 1}"
        chapters.append(ParsedChapter(title=ch_title[:120], content=text))
    if not chapters:
        # Fallback: collapse everything into a single chapter.
        full = ""
        for item in book.get_items():
            if item.get_type() == 9:
                soup = BeautifulSoup(item.get_content(), "html.parser")
                full += soup.get_text("\n", strip=True) + "\n"
        chapters = [ParsedChapter(title="Full Document", content=full.strip() or "(empty)")]
    return ParsedBook(title=title, author=author, chapters=chapters)


def parse_text(path: str, original_name: str | None = None) -> ParsedBook:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        text = f.read()
    title = os.path.splitext(original_name or os.path.basename(path))[0]
    chapters = _split_into_chapters(text) or [ParsedChapter(title="Full Document", content=text)]
    return ParsedBook(title=title, author="Unknown", chapters=chapters)


def parse_book(path: str, original_name: str | None = None) -> ParsedBook:
    ext = os.path.splitext(original_name or path)[1].lower()
    if ext == ".pdf":
        return parse_pdf(path, original_name=original_name)
    if ext == ".epub":
        return parse_epub(path, original_name=original_name)
    if ext in (".txt", ".md"):
        return parse_text(path, original_name=original_name)
    raise ValueError(f"Unsupported file extension: {ext}")
