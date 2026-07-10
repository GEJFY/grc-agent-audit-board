"""EDINET API v2 クライアント。

書類一覧API(日次ループ)で有価証券報告書(docTypeCode=120)を特定し、
書類取得API(type=1)でXBRL一式のzipをダウンロードする。
APIキーは環境変数 EDINET_API_KEY で指定。
"""
from __future__ import annotations

import datetime as dt
import io
import os
import time
import zipfile
from dataclasses import dataclass

import requests

BASE = "https://api.edinet-fsa.go.jp/api/v2"
ASR_DOC_TYPE = "120"  # 有価証券報告書
ORDINANCE_CODE = "010"  # 企業内容等の開示に関する内閣府令


@dataclass
class DocMeta:
    doc_id: str
    edinet_code: str | None
    sec_code: str | None
    filer_name: str | None
    submit_date: str
    period_end: str | None


class EdinetClient:
    def __init__(self, api_key: str | None = None, sleep_sec: float = 0.5):
        self.api_key = api_key or os.environ["EDINET_API_KEY"]
        self.sleep_sec = sleep_sec  # 過度な並列アクセスを避ける
        self.session = requests.Session()

    def list_asr_documents(self, date: dt.date) -> list[DocMeta]:
        """指定日の提出書類一覧から有価証券報告書のみ返す。"""
        r = self.session.get(
            f"{BASE}/documents.json",
            params={
                "date": date.isoformat(),
                "type": 2,
                "Subscription-Key": self.api_key,
            },
            timeout=60,
        )
        r.raise_for_status()
        results = r.json().get("results", []) or []
        docs = []
        for d in results:
            if d.get("docTypeCode") != ASR_DOC_TYPE:
                continue
            if d.get("ordinanceCode") != ORDINANCE_CODE:
                continue
            if d.get("xbrlFlag") != "1":
                continue
            docs.append(
                DocMeta(
                    doc_id=d["docID"],
                    edinet_code=d.get("edinetCode"),
                    sec_code=d.get("secCode"),
                    filer_name=d.get("filerName"),
                    submit_date=date.isoformat(),
                    period_end=d.get("periodEnd"),
                )
            )
        time.sleep(self.sleep_sec)
        return docs

    def list_month(self, year: int, month: int) -> list[DocMeta]:
        """前月分など、月単位で日次ループ収集。"""
        start = dt.date(year, month, 1)
        end = (start.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
        docs: list[DocMeta] = []
        day = start
        while day < end:
            docs.extend(self.list_asr_documents(day))
            day += dt.timedelta(days=1)
        return docs

    def download_xbrl_zip(self, doc_id: str) -> zipfile.ZipFile:
        r = self.session.get(
            f"{BASE}/documents/{doc_id}",
            params={"type": 1, "Subscription-Key": self.api_key},
            timeout=120,
        )
        r.raise_for_status()
        time.sleep(self.sleep_sec)
        return zipfile.ZipFile(io.BytesIO(r.content))
