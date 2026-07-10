"""extract.py のユニットテスト。

実際の有報インラインXBRLの構造(ix:nonNumeric、入れ子、機関設計の
見出し揺れ)を模した合成フィクスチャで検証する。
"""
import io
import zipfile

import pytest

from src import extract

# 監査役会設置会社の典型パターン(入れ子のix:nonNumericを含む)
IXBRL_KANSAYAKUKAI = """<html xmlns:ix="http://www.xbrl.org/2013/inlineXBRL">
<body>
<ix:nonNumeric name="jpcrp_cor:AuditsTextBlock" contextRef="FilingDateInstant">
<h4>(3) 【監査の状況】</h4>
<p>① 監査役監査の状況</p>
<p>当社の監査役会は監査役4名(うち社外監査役2名)で構成され、常勤監査役を2名選定しております。</p>
<p>当事業年度において監査役会を年13回開催しており、個々の監査役の出席状況は次のとおりであります。</p>
<table><tr><td>氏 名</td><td>開催回数</td><td>出席回数</td></tr>
<tr><td>山田 太郎</td><td>13回</td><td>13回</td></tr>
<tr><td>佐藤 花子</td><td>13回</td><td>12回</td></tr></table>
<p>監査役 山田太郎は、長年当社の経理部門を担当しており、財務及び会計に関する相当程度の知見を有しております。</p>
<p>監査役会における主な検討事項は、内部統制システムの整備・運用状況、
会計監査人の監査上の主要な検討事項(KAM)に関する協議、サイバーセキュリティ対応であります。</p>
<p>② 内部監査の状況</p>
<p>内部監査室(5名)が年間監査計画に基づき実施しております。</p>
<p>③ 会計監査人の状況</p>
<p><ix:nonNumeric name="jpcrp_cor:NoteOnChangeOfIndependentAuditorsAuditsTextBlock" contextRef="FilingDateInstant">該当事項はありません。</ix:nonNumeric></p>
</ix:nonNumeric>
<ix:nonNumeric name="jpdei_cor:AccountingStandardsDEI" contextRef="FilingDateInstant">IFRS</ix:nonNumeric>
</body></html>"""

# 監査等委員会設置会社(見出し表記の揺れ)
IXBRL_IINKAI = """<html xmlns:ix="http://www.xbrl.org/2013/inlineXBRL">
<body>
<ix:nonNumeric name="jpcrp_cor:AuditsTextBlock" contextRef="FilingDateInstant">
<p>(1) 監査等委員会監査の状況</p>
<p>監査等委員会は年15回開催しました。</p>
<p>(2) 内部監査の状況</p>
<p>内部監査部が担当しております。</p>
</ix:nonNumeric>
</body></html>"""


def make_zip(html: str, path: str = "XBRL/PublicDoc/0000000_honbun_test.htm") -> zipfile.ZipFile:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(path, html)
        zf.writestr("XBRL/AuditDoc/audit.htm", "<html>監査報告書</html>")
    buf.seek(0)
    return zipfile.ZipFile(buf)


class TestAuditsTextBlock:
    def test_extracts_full_block_with_nesting(self):
        zf = make_zip(IXBRL_KANSAYAKUKAI)
        frag = extract.extract_audits_text_block(zf)
        assert frag is not None
        # 入れ子のix:nonNumericを越えて③まで含むこと
        assert "会計監査人の状況" in frag
        assert "該当事項はありません" in frag

    def test_ignores_audit_doc(self):
        zf = make_zip(IXBRL_KANSAYAKUKAI)
        names = extract.find_public_doc_names(zf)
        assert all("/PublicDoc/" in n for n in names)

    def test_returns_none_when_absent(self):
        zf = make_zip("<html><body>no tags</body></html>")
        assert extract.extract_audits_text_block(zf) is None


class TestSlicing:
    def test_kansayakukai_section(self):
        zf = make_zip(IXBRL_KANSAYAKUKAI)
        text = extract.strip_html(extract.extract_audits_text_block(zf))
        section = extract.slice_kansayaku_section(text)
        # strip_htmlのNFKC正規化で「①」は「1」になる
        assert section.splitlines()[0].endswith("監査役監査の状況")
        assert "年13回開催" in section
        assert "山田 太郎" in section
        # ②以降は含まない
        assert "内部監査室" not in section
        assert "会計監査人の状況" not in section

    def test_iinkai_heading_variant(self):
        zf = make_zip(IXBRL_IINKAI)
        text = extract.strip_html(extract.extract_audits_text_block(zf))
        section = extract.slice_kansayaku_section(text)
        assert "監査等委員会監査の状況" in section
        assert "年15回開催" in section
        assert "内部監査部" not in section

    def test_fallback_returns_full_text(self):
        text = "見出しのない自由記述のみのケース"
        assert extract.slice_kansayaku_section(text) == text


class TestDei:
    def test_accounting_standard(self):
        zf = make_zip(IXBRL_KANSAYAKUKAI)
        assert extract.extract_accounting_standard(zf) == "IFRS"


class TestStickiness:
    def test_identical_text_scores_one(self):
        from src.structure import boilerplate_score

        t = "監査役会を年13回開催しております。" * 5
        assert boilerplate_score(t, t) == 1.0

    def test_different_text_scores_low(self):
        from src.structure import boilerplate_score

        a = "監査役会を年13回開催し、KAMについて協議しております。"
        b = "当社は品質管理体制の強化に取り組んでおります。"
        assert boilerplate_score(a, b) < 0.3

    def test_none_when_no_previous(self):
        from src.structure import boilerplate_score

        assert boilerplate_score("text", None) is None
