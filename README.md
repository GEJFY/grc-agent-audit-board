# 監査役会レンズ | AUDIT BOARD LENS

有価証券報告書「第4 提出会社の状況 4(3) 監査の状況」を EDINET API で全上場企業から月次収集し、
業種・市場区分・規模・機関設計の属性軸で自社をベンチマークできる Web ツール。

設計根拠: 機能設計リサーチ報告書(2026-07)。金融庁「記述情報の開示の好事例集」の期待3ポイント、
日本監査役協会の運用実態調査・実効性評価調査(「他社比較が難しい」という課題)、
Lazy Prices 系の stickiness 研究に基づく。

## 構成

```
batch/   EDINET収集 → AuditsTextBlock抽出 → ①切り出し → Claude構造化 → Supabase投入 (Python)
web/     ダッシュボード + RAG質問応答API (Next.js, スマホ/PC対応)
db/      Supabase(PostgreSQL + pgvector)スキーマ
.github/ 月次バッチ(cron) + CI
```

## 技術メモ(重要)

- 「監査役監査の状況」単独のXBRLタグは存在しない。`jpcrp_cor:AuditsTextBlock`
  ((3)監査の状況の包括タグ)を取得し、見出し正規表現で①を切り出す(`batch/src/extract.py`)。
- 会計基準(IFRS/日本基準/米国基準)に関わらず記述情報は開示府令タクソノミで共通。
  基準は `jpdei_cor:AccountingStandardsDEI` で取得。
- 生テキストをDBに保存し、抽出スキーマ変更時に再処理できるようにしている。
- LLM構造化は「原文にない値はnull」を強制し、スコアは「活動量と開示の質の指標であり
  監査品質の評価ではない」旨を必ず表示する。

## セットアップ

### 1. Supabase
プロジェクト作成後、`db/schema.sql` をSQL Editorで実行(pgvector拡張を有効化)。

### 2. バッチ(ローカル確認)
```bash
cd batch
pip install -r requirements.txt
python -m pytest tests/ -v            # 10 tests
export EDINET_API_KEY=...             # https://api.edinet-fsa.go.jp で取得
export ANTHROPIC_API_KEY=...
python -m src.main --year 2026 --month 6 --dry-run --limit 3
```

### 3. Web(ローカル)
```bash
cd web
npm install
npm run dev   # http://localhost:3000
```

### 4. デプロイ

#### Web(Azure Static Web Apps / 推奨・無料)

`web/` の Next.js は SSR + APIルート(`/api/ask`)を含むが、**Azure Static Web Apps の
Free プランはマネージドバックエンドで hybrid Next.js をそのまま実行できる(月額 $0)**。
サンプルデータで動くため、Supabase も EDINET APIキーも無しに公開できる。

1. Azure でリソース作成(Free プラン)。Azure CLI の場合:
   ```bash
   az login
   az group create -n rg-audit-board-lens -l japaneast
   az staticwebapp create \
     -n audit-board-lens -g rg-audit-board-lens -l eastasia \
     --sku Free
   # デプロイトークンを取得
   az staticwebapp secrets list -n audit-board-lens -g rg-audit-board-lens \
     --query "properties.apiKey" -o tsv
   ```
   ※ ポータルで作る場合は「Static Web Apps → 作成 → プラン: Free」。デプロイソースは
   「その他(Other)」を選ぶと本リポジトリ同梱の GitHub Actions がそのまま使える。
2. GitHub の **Settings → Secrets and variables → Actions** に
   `AZURE_STATIC_WEB_APPS_API_TOKEN` = 上記トークンを登録。
3. `main` へ push すると `.github/workflows/azure-static-web-apps.yml` が
   `app_location: web` をビルド&デプロイし、`https://<name>.azurestaticapps.net` で公開。
4. (任意)RAG応答を本番化するなら SWA リソースの
   **設定 → 環境変数(Application settings)** に `ANTHROPIC_API_KEY` を登録
   (未設定でもデモ応答で動作)。

> コスト目安: Static Web Apps **Free = $0**。実データ運用時に加わるのは Supabase(無料枠あり)、
> RAG利用時の Anthropic API 従量課金、バッチ実行(GitHub Actions 無料枠内)程度。

#### バッチ(EDINET月次収集)
GitHub リポジトリの Settings → Secrets に
`EDINET_API_KEY` / `ANTHROPIC_API_KEY` / `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` を登録。
毎月6日 6:00 JST に前月分を自動収集(手動実行も workflow_dispatch で可能)。

> **EDINET APIキーについて**: EDINET API v2 は `Subscription-Key`(APIキー)が必須。
> [EDINET 開発者向けページ](https://api.edinet-fsa.go.jp/) でメール登録するとキーが発行される
> (無料・審査なし)。**Webサイトの公開・閲覧だけなら不要**で、実企業データを収集する
> バッチを回すときにのみ必要。

## ロードマップ(リサーチ報告書準拠)

- [x] 第1段階 MVP: 収集・構造化・属性ベンチマーク(本リポジトリ)
- [ ] 協会統計との整合性検証(監査役会12回=62.4%等と±5%以内)
- [ ] 第2段階: 開示質スコア精緻化・好事例ギャップ+改善文案生成
- [ ] 第3段階: pgvector意味検索・経年差分ハイライト・RAG本実装

## 免責

数値・スコアは開示情報に基づく参考指標であり、監査品質そのものの評価ではありません。
現在のWeb画面はサンプルデータで動作します(Supabase接続後に実データへ切替)。
