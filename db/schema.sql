-- Supabase (PostgreSQL) スキーマ
create table if not exists audit_disclosures (
  doc_id text primary key,
  edinet_code text,
  sec_code text,
  filer_name text,
  period_end date,
  submit_date date,
  accounting_standard text,
  industry text,            -- 東証33業種(別途マスタから付与)
  market_segment text,      -- プライム/スタンダード/グロース
  market_cap_bin text,      -- 規模区分
  raw_text text not null,   -- ①監査役監査の状況(再処理の保険)
  structured jsonb not null,
  stickiness numeric,       -- 前年類似度(定型文度)
  embedding vector(1536),   -- 意味検索用(pgvector)
  created_at timestamptz default now()
);
create index if not exists idx_ad_edinet on audit_disclosures (edinet_code, period_end);
create index if not exists idx_ad_industry on audit_disclosures (industry, market_segment);
