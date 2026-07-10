"""月次バッチ: 前月提出の有報を収集 → 抽出 → 構造化 → Supabaseへupsert。

環境変数:
  EDINET_API_KEY / ANTHROPIC_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_KEY
実行:
  python -m src.main --year 2026 --month 6
  python -m src.main  # 引数なしは前月
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import os
import sys

from . import extract, structure
from .edinet_client import EdinetClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("batch")


def get_supabase():
    from supabase import create_client

    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def previous_disclosure(sb, edinet_code: str) -> str | None:
    res = (
        sb.table("audit_disclosures")
        .select("raw_text")
        .eq("edinet_code", edinet_code)
        .order("period_end", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0]["raw_text"] if res.data else None


def process_doc(client: EdinetClient, sb, meta) -> bool:
    zf = client.download_xbrl_zip(meta.doc_id)
    frag = extract.extract_audits_text_block(zf)
    if not frag:
        log.warning("AuditsTextBlock not found: %s %s", meta.doc_id, meta.filer_name)
        return False
    audits_text = extract.strip_html(frag)
    section = extract.slice_kansayaku_section(audits_text)
    std = extract.extract_accounting_standard(zf)

    structured = structure.structure_kansayaku_text(section)
    prev = previous_disclosure(sb, meta.edinet_code) if sb else None
    stickiness = structure.boilerplate_score(section, prev)

    row = {
        "doc_id": meta.doc_id,
        "edinet_code": meta.edinet_code,
        "sec_code": meta.sec_code,
        "filer_name": meta.filer_name,
        "period_end": meta.period_end,
        "submit_date": meta.submit_date,
        "accounting_standard": std,
        "raw_text": section,  # 生テキスト保存 = 再処理の保険
        "structured": structured,
        "stickiness": stickiness,
    }
    if sb:
        sb.table("audit_disclosures").upsert(row, on_conflict="doc_id").execute()
    else:
        print(json.dumps(row, ensure_ascii=False)[:500])
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    today = dt.date.today()
    prev_month = (today.replace(day=1) - dt.timedelta(days=1))
    parser.add_argument("--year", type=int, default=prev_month.year)
    parser.add_argument("--month", type=int, default=prev_month.month)
    parser.add_argument("--dry-run", action="store_true", help="DBに書かず標準出力")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    client = EdinetClient()
    sb = None if args.dry_run else get_supabase()

    docs = client.list_month(args.year, args.month)
    log.info("%d件の有報を検出 (%d-%02d)", len(docs), args.year, args.month)
    if args.limit:
        docs = docs[: args.limit]

    ok = ng = 0
    for meta in docs:
        try:
            ok += 1 if process_doc(client, sb, meta) else 0
        except Exception:
            log.exception("failed: %s %s", meta.doc_id, meta.filer_name)
            ng += 1
    log.info("完了: 成功%d / 失敗%d", ok, ng)
    return 0 if ng == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
