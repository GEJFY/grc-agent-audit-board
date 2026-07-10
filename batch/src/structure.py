"""切り出した「監査役監査の状況」テキストをClaude APIで構造化する。

リサーチ報告書の設計に基づき、定量項目に加えて開示の「質」に関わる
フラグ(結論記載・KAM検討・実効性評価・三様監査連携)も抽出する。
ハルシネーション対策として、原文に無い値は null とするよう指示し、
出力はJSONのみ。
"""
from __future__ import annotations

import json
import os

import anthropic

MODEL = os.environ.get("STRUCTURE_MODEL", "claude-haiku-4-5-20251001")

THEMES = [
    "内部統制(J-SOX)評価",
    "会計監査人との連携・KAM",
    "サイバーセキュリティ",
    "グループガバナンス",
    "サステナビリティ開示",
    "内部通報制度の運用",
    "IT全般統制",
    "品質・コンプライアンス",
    "政策保有株式",
    "経営リスク・事業ポートフォリオ",
    "その他",
]

SYSTEM = """あなたは日本の有価証券報告書「監査役監査の状況」を構造化する専門アシスタントです。
与えられた原文にある情報のみを抽出し、原文に記載がない項目は必ず null にしてください。
推測で値を補ってはいけません。出力はJSONオブジェクトのみで、前置き・後書き・コードブロック記号は一切出力しないでください。"""

PROMPT_TEMPLATE = """次の「監査役監査の状況」原文から、以下のJSONスキーマで抽出してください。

{{
  "organ_type": "監査役会設置会社|監査等委員会設置会社|指名委員会等設置会社|null",
  "meetings_per_year": 数値またはnull,
  "members_total": 数値またはnull,
  "members_outside": 数値またはnull,
  "members_full_time": 数値またはnull,
  "attendance_overall_pct": 数値またはnull(全員一律や平均が読み取れる場合のみ),
  "attendance_by_member": [{{"name": "氏名", "attended": 数値, "held": 数値}}] または [],
  "financial_expert": true/false/null(財務及び会計に関する相当程度の知見を有する者の記載),
  "key_topics": ["原文の主な検討事項を短い名詞句で"],
  "topic_tags": [次のリストから該当するものすべて: {themes}],
  "quality_flags": {{
    "has_audit_conclusion": true/false(重点監査項目に対する監査結果・監査役会の認識まで記載があるか),
    "has_kam_discussion": true/false(KAMに関する監査役等の検討内容の記載),
    "has_effectiveness_evaluation": true/false(監査役会等の実効性評価への言及),
    "has_three_way_audit": true/false(内部監査・会計監査人との三様監査連携の記載),
    "has_dual_reporting": true/false(内部監査から取締役会・監査役会への直接報告の仕組み)
  }},
  "full_time_activities": "常勤監査役の活動状況の要約(2文以内)またはnull"
}}

原文:
{text}"""


def structure_kansayaku_text(text: str, client: anthropic.Anthropic | None = None) -> dict:
    client = client or anthropic.Anthropic()
    msg = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        system=SYSTEM,
        messages=[
            {
                "role": "user",
                "content": PROMPT_TEMPLATE.format(
                    themes="、".join(THEMES), text=text[:12000]
                ),
            }
        ],
    )
    raw = "".join(b.text for b in msg.content if b.type == "text")
    raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
    return json.loads(raw)


def boilerplate_score(current: str, previous: str | None) -> float | None:
    """前年開示との類似度(0-1)。高いほど定型文=stickinessが強い。

    Lazy Prices系の知見に基づく簡易実装(文字3-gram Jaccard)。
    前年データが無ければ None。
    """
    if not previous:
        return None

    def ngrams(s: str, n: int = 3) -> set[str]:
        s = "".join(s.split())
        return {s[i : i + n] for i in range(max(len(s) - n + 1, 0))}

    a, b = ngrams(current), ngrams(previous)
    if not a or not b:
        return None
    return round(len(a & b) / len(a | b), 4)
