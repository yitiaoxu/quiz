"""Parse FPGA/数字IC知识手册 PDF into a local quiz question bank."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

CHAPTER_INDEX = {
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
}

CHAPTER_HEADING_RE = re.compile(
    r"^([一二三四五六七])、\s*(.+?)\s*(?:\.{2,}.*|错误!.*)?$"
)
TOC_ITEM_RE = re.compile(
    r"^(\d+)\.\s+(.+?)\s*(?:\.{2,}.*|错误!.*)?$"
)
PAGE_RE = re.compile(r"===== PAGE \d+ =====")
KEYPOINT_RE = re.compile(
    r"^\s*(?:"
    r"\d+[\)）、.]|"
    r"[（(]\d+[）)]|"
    r"[一二三四五六七八九十]+[、.]|"
    r"\d+："
    r")\s+(\S.+)$"
)
RUNNING_HEADERS = {
    "仅供学习交流，严禁用于商业用途。",
    "FPGA/数字 IC 设计",
    "FPGA/数字 IC 知识手册",
    "Verilog 语法",
    "验证",
    "其他",
    "其它",
    "SystemVerilog",
    "一些概念",
    "计算机体系结构",
    "目录",
}


def normalize_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def parse_toc(text: str) -> list[dict]:
    start = text.find("目录")
    page7 = text.find("===== PAGE 7 =====")
    if start == -1:
        start = 0
    region = text[start:page7] if page7 != -1 else text[start:]

    items: list[dict] = []
    chapter = ""
    chapter_id = 0
    for raw in region.splitlines():
        line = raw.strip()
        if not line:
            continue
        ch = CHAPTER_HEADING_RE.match(line)
        if ch:
            chapter = normalize_ws(ch.group(2))
            chapter_id = CHAPTER_INDEX[ch.group(1)]
            continue
        m = TOC_ITEM_RE.match(line)
        if m and chapter:
            items.append(
                {
                    "chapter": chapter,
                    "chapterId": chapter_id,
                    "number": int(m.group(1)),
                    "title": normalize_ws(m.group(2)),
                }
            )
    return items


def clean_body(raw: str) -> str:
    text = PAGE_RE.sub("\n", raw)
    kept: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            if kept and kept[-1] != "":
                kept.append("")
            continue
        if stripped in RUNNING_HEADERS:
            continue
        if CHAPTER_HEADING_RE.match(stripped):
            continue
        kept.append(stripped)
    while kept and kept[0] == "":
        kept.pop(0)
    while kept and kept[-1] == "":
        kept.pop()
    return "\n".join(kept).strip()


def extract_keypoints(body: str) -> list[str]:
    points: list[str] = []
    for line in body.splitlines():
        m = KEYPOINT_RE.match(line)
        if m:
            points.append(normalize_ws(m.group(1)))
    if len(points) < 2:
        return []
    return points


def _title_regex(title: str) -> str:
    return re.escape(normalize_ws(title)).replace(r"\ ", r"\s+")


def find_heading(chapter_text: str, number: int, title: str) -> tuple[int, int] | None:
    title_flex = _title_regex(title)
    patterns = [
        rf"(?:^|\n)\s*{number}\.\s+{title_flex}\s*(?=\n|$)",
        rf"(?:^|\n)\s*\d+\.\s+{title_flex}\s*(?=\n|$)",
        rf"(?:^|\n)\s*{title_flex}\s*(?=\n|$)",
    ]
    for pattern in patterns:
        m = re.search(pattern, chapter_text)
        if m:
            start = m.start()
            if chapter_text[start] == "\n":
                start += 1
            return start, m.end()
    return None


def chapter_blocks(body: str) -> dict[int, str]:
    matches = list(
        re.finditer(r"(?:^|\n)([一二三四五六七])、\s*([^\n]+)", body)
    )
    blocks: dict[int, str] = {}
    for i, m in enumerate(matches):
        chapter_id = CHAPTER_INDEX.get(m.group(1))
        if chapter_id is None:
            continue
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        blocks[chapter_id] = body[start:end]
    return blocks


def split_questions(text: str) -> list[dict]:
    toc = parse_toc(text)
    page7 = text.find("===== PAGE 7 =====")
    body = text[page7:] if page7 != -1 else text
    blocks = chapter_blocks(body)

    questions: list[dict] = []
    by_chapter: dict[int, list[dict]] = {}
    for item in toc:
        by_chapter.setdefault(item["chapterId"], []).append(item)

    for chapter_id, items in by_chapter.items():
        chapter_text = blocks.get(chapter_id, "")
        located: list[dict] = []
        for item in items:
            loc = find_heading(chapter_text, item["number"], item["title"])
            located.append(
                {
                    **item,
                    "start": loc[0] if loc else None,
                    "head_end": loc[1] if loc else None,
                }
            )

        for i, item in enumerate(located):
            qid = f"{item['chapterId']}-{item['number']}"
            if item["start"] is None:
                questions.append(
                    {
                        "id": qid,
                        "chapter": item["chapter"],
                        "chapterId": item["chapterId"],
                        "number": item["number"],
                        "title": item["title"],
                        "reference": "",
                        "keypoints": [],
                        "incomplete": True,
                        "hasFigure": False,
                    }
                )
                continue

            later = [
                x["start"]
                for x in located[i + 1 :]
                if x["start"] is not None and x["start"] > item["start"]
            ]
            end = later[0] if later else len(chapter_text)
            reference = clean_body(chapter_text[item["head_end"] : end])
            questions.append(
                {
                    "id": qid,
                    "chapter": item["chapter"],
                    "chapterId": item["chapterId"],
                    "number": item["number"],
                    "title": item["title"],
                    "reference": reference,
                    "keypoints": extract_keypoints(reference),
                    "incomplete": reference == "",
                    "hasFigure": "如图" in reference,
                }
            )
    return questions


def extract_pdf_text(pdf_path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(pdf_path))
    parts: list[str] = []
    for i, page in enumerate(reader.pages):
        parts.append(f"\n===== PAGE {i + 1} =====\n{page.extract_text() or ''}")
    return "".join(parts)


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    root = Path(__file__).resolve().parents[2]
    pdf = Path(argv[0]) if argv else root / "review" / "FPGA数字IC知识手册.pdf"
    out = (
        Path(argv[1])
        if len(argv) > 1
        else Path(__file__).resolve().parent / "questions.json"
    )
    questions = split_questions(extract_pdf_text(pdf))
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "FPGA数字IC知识手册",
        "questions": questions,
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    incomplete = sum(1 for q in questions if q["incomplete"])
    print(f"Wrote {len(questions)} questions ({incomplete} incomplete) to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
