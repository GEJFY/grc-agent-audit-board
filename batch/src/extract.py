"""XBRL zip から「監査の状況」(jpcrp_cor:AuditsTextBlock)を抽出し、
「① 監査役監査の状況」相当のセクションを切り出す。

設計メモ(タクソノミ要素リスト ESE140114 で確認済み):
- 「監査役監査の状況」単独のタグは存在しない。
- (3)監査の状況の全体が jpcrp_cor:AuditsTextBlock に包括タグ付けされる。
- 会計基準(IFRS/日本基準/米国基準)に関わらず記述情報は開示府令タクソノミで
  同一要素のため、抽出ロジックは共通。
- 機関設計により見出しが「監査役監査」「監査等委員会監査」「監査委員会監査」等に
  揺れるため、正規表現で吸収する。
"""
from __future__ import annotations

import re
import unicodedata
import zipfile
from html.parser import HTMLParser

AUDITS_TEXT_BLOCK = "AuditsTextBlock"
ACCOUNTING_STANDARDS_DEI = "AccountingStandardsDEI"

# ① 見出し(機関設計バリエーションと番号表記の揺れを吸収)
_SEC1 = re.compile(
    r"(?:①|\(1\)|１\.?|1\.?)?\s*"
    r"(監査役監査|監査等委員会(?:による)?監査|監査委員会(?:による)?監査|"
    r"監査役及び監査役会|監査等委員会|組織的監査)"
    r"の?状況",
)
# ② 見出し(次セクションの開始 = ①の終端)
_SEC2 = re.compile(r"(?:②|\(2\)|２\.?|2\.?)\s*内部監査の状況")


class _TextExtractor(HTMLParser):
    """HTMLからテキストのみを抽出(表のセルは空白区切り)。"""

    def __init__(self):
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data):
        self.parts.append(data)

    def handle_endtag(self, tag):
        if tag in ("p", "tr", "div", "br", "table", "h1", "h2", "h3", "h4"):
            self.parts.append("\n")
        elif tag in ("td", "th"):
            self.parts.append(" ")

    def text(self) -> str:
        return "".join(self.parts)


def strip_html(html: str) -> str:
    p = _TextExtractor()
    p.feed(html)
    t = unicodedata.normalize("NFKC", p.text())
    t = re.sub(r"[ \t\u3000]+", " ", t)
    t = re.sub(r"\n\s*\n+", "\n", t)
    return t.strip()


def find_public_doc_names(zf: zipfile.ZipFile) -> list[str]:
    """PublicDoc配下のインラインXBRL(htm)を返す。AuditDocは対象外。"""
    return [
        n
        for n in zf.namelist()
        if "/PublicDoc/" in n and n.lower().endswith((".htm", ".html"))
    ]


def _find_ix_nonnumeric(html: str, local_name: str) -> str | None:
    """ix:nonNumeric name="jpcrp_cor:<local_name>" の中身を返す。

    インラインXBRLの入れ子に対応するため、開始タグから同名タグの
    深さを数えて対応する終了タグまでを取る。
    """
    open_pat = re.compile(
        r"<ix:nonNumeric\b[^>]*\bname\s*=\s*\"[^\"]*:" + local_name + r"\"[^>]*>",
        re.IGNORECASE,
    )
    m = open_pat.search(html)
    if not m:
        return None
    tag_pat = re.compile(r"<(/?)ix:nonNumeric\b[^>]*>", re.IGNORECASE)
    depth = 1
    pos = m.end()
    for t in tag_pat.finditer(html, pos):
        depth += -1 if t.group(1) else 1
        if depth == 0:
            return html[m.end() : t.start()]
    return None


def extract_audits_text_block(zf: zipfile.ZipFile) -> str | None:
    """zip内のPublicDocからAuditsTextBlockのHTML断片を返す。"""
    for name in find_public_doc_names(zf):
        html = zf.read(name).decode("utf-8", errors="replace")
        frag = _find_ix_nonnumeric(html, AUDITS_TEXT_BLOCK)
        if frag:
            return frag
    return None


def extract_accounting_standard(zf: zipfile.ZipFile) -> str | None:
    for name in find_public_doc_names(zf):
        html = zf.read(name).decode("utf-8", errors="replace")
        frag = _find_ix_nonnumeric(html, ACCOUNTING_STANDARDS_DEI)
        if frag:
            return strip_html(frag)
    return None


def slice_kansayaku_section(audits_text: str) -> str:
    """プレーンテキスト化した「監査の状況」から①相当を切り出す。

    ①見出しが見つからなければ全文を返す(構造化LLM側で吸収)。
    """
    m1 = _SEC1.search(audits_text)
    if not m1:
        return audits_text
    m2 = _SEC2.search(audits_text, m1.end())
    return audits_text[m1.start() : m2.start() if m2 else len(audits_text)].strip()
