"use client";
import React, { useMemo, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ReferenceLine, BarChart, Bar, Cell, LineChart, Line, Legend,
  ResponsiveContainer,
} from "recharts";
import {
  buildCompanies, THEMES, INDUSTRIES, SEGMENTS, SIZES, ORGS, QUALITY_ITEMS,
  median, mean, sd, compositeScore,
} from "../lib/mockData";

const C = {
  ink: "#1A2233", navy: "#24406E", navySoft: "#5C7099",
  shu: "#C73E3A", shuSoft: "#F5E3E2",
  bg: "#F3F5F8", card: "#FFFFFF", muted: "#8A94A6", line: "#E3E8EF",
  good: "#2E6E4E", goodSoft: "#E4F0EA", warn: "#B97A1C", warnSoft: "#FBF1DE",
};
const font = {
  display: "'Shippori Mincho','Hiragino Mincho ProN',serif",
  body: "'Zen Kaku Gothic New','Hiragino Kaku Gothic ProN',sans-serif",
};

const COMPANIES = buildCompanies();
const ALL = "すべて";

const Card = ({ children, style }) => (
  <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "clamp(14px,2.5vw,20px)", ...style }}>{children}</div>
);
const SectionTitle = ({ kanji, sub }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontFamily: font.display, fontSize: 16, fontWeight: 600 }}>{kanji}</div>
    {sub && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{sub}</div>}
  </div>
);
const Select = ({ label, value, onChange, options }) => (
  <label style={{ fontSize: 11, color: C.muted, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
    {label}
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ fontFamily: font.body, fontSize: 13, padding: "7px 8px", borderRadius: 6, border: `1px solid ${C.line}`, background: "#fff", color: C.ink, maxWidth: "100%" }}>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  </label>
);

const HankoScore = ({ score }) => (
  <div style={{ position: "relative", width: 118, height: 118, transform: "rotate(-3deg)", flexShrink: 0 }}>
    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${C.shu}` }} />
    <div style={{ position: "absolute", inset: 6, borderRadius: "50%", border: `1.5px solid ${C.shu}`, opacity: 0.55 }} />
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.shu }}>
      <div style={{ fontFamily: font.display, fontSize: 11, letterSpacing: 3, fontWeight: 600 }}>監査活動</div>
      <div style={{ fontFamily: font.display, fontSize: 42, fontWeight: 700, lineHeight: 1 }}>{score}</div>
      <div style={{ fontSize: 9, letterSpacing: 2, marginTop: 2 }}>比較母集団内偏差値</div>
    </div>
  </div>
);

const Kpi = ({ label, value, unit, delta, better }) => (
  <Card style={{ padding: "12px 14px", flex: "1 1 140px", minWidth: 140 }}>
    <div style={{ fontSize: 10.5, color: C.muted, letterSpacing: 1 }}>{label}</div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 3 }}>
      <span style={{ fontFamily: font.display, fontSize: 26, fontWeight: 700 }}>{value}</span>
      <span style={{ fontSize: 11, color: C.muted }}>{unit}</span>
    </div>
    <div style={{ fontSize: 10.5, marginTop: 5, display: "inline-block", padding: "2px 7px", borderRadius: 4, background: better ? C.goodSoft : C.warnSoft, color: better ? C.good : C.warn, fontWeight: 700 }}>{delta}</div>
  </Card>
);

export default function Dashboard() {
  const [industry, setIndustry] = useState("電気機器");
  const [segment, setSegment] = useState(ALL);
  const [size, setSize] = useState(ALL);
  const [org, setOrg] = useState(ALL);
  const [companyId, setCompanyId] = useState(999);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);

  const me = COMPANIES.find((c) => c.id === companyId) || COMPANIES[0];

  // 比較母集団(自社は属性フィルタに関わらず常に含める)
  const peers = useMemo(() => {
    const f = COMPANIES.filter((c) =>
      (industry === ALL || c.industry === industry) &&
      (segment === ALL || c.segment === segment) &&
      (size === ALL || c.size === size) &&
      (org === ALL || c.org === org)
    );
    return f.some((c) => c.id === me.id) ? f : [me, ...f];
  }, [industry, segment, size, org, me]);

  const stats = useMemo(() => {
    const scores = peers.map(compositeScore);
    const myZ = (compositeScore(me) - mean(scores)) / sd(scores);
    return {
      medMeet: median(peers.map((c) => c.meetings)),
      medAtt: median(peers.map((c) => c.attendance)),
      hensachi: Math.round(50 + myZ * 10),
      rank: [...peers].sort((a, b) => compositeScore(b) - compositeScore(a)).findIndex((c) => c.id === me.id) + 1,
      medStick: median(peers.map((c) => c.stickiness)),
    };
  }, [peers, me]);

  const gapData = useMemo(() =>
    THEMES.map((t) => {
      const rate = Math.round((peers.filter((c) => c.themes.includes(t)).length / peers.length) * 100);
      const discussed = me.themes.includes(t);
      return { theme: t, rate, discussed, gap: !discussed && rate >= 60 };
    }).sort((a, b) => b.rate - a.rate), [peers, me]);
  const gaps = gapData.filter((d) => d.gap);

  const qualityRows = useMemo(() =>
    QUALITY_ITEMS.map((q) => ({
      ...q,
      mine: !!me.quality[q.key],
      rate: Math.round((peers.filter((c) => c.quality[q.key]).length / peers.length) * 100),
    })), [peers, me]);

  const hist = useMemo(() => {
    const buckets = [[5, 7], [8, 10], [11, 13], [14, 16], [17, 20]];
    return buckets.map(([lo, hi]) => ({
      range: `${lo}–${hi}回`,
      count: peers.filter((c) => c.meetings >= lo && c.meetings <= hi).length,
      mine: me.meetings >= lo && me.meetings <= hi,
    }));
  }, [peers, me]);

  const trend = [
    { year: "FY2022", サイバーセキュリティ: 31, サステナビリティ開示: 18, "実効性評価の開示": 12 },
    { year: "FY2023", サイバーセキュリティ: 42, サステナビリティ開示: 34, "実効性評価の開示": 16 },
    { year: "FY2024", サイバーセキュリティ: 55, サステナビリティ開示: 52, "実効性評価の開示": 20 },
    { year: "FY2025", サイバーセキュリティ: 66, サステナビリティ開示: 63, "実効性評価の開示": 26 },
  ];

  // AIによる意味的類似企業(実運用ではpgvector検索。ここでは属性+テーマ重複の近似)
  const similar = useMemo(() => {
    const jaccard = (a, b) => {
      const A = new Set(a), B = new Set(b);
      const inter = [...A].filter((x) => B.has(x)).length;
      return inter / (A.size + B.size - inter || 1);
    };
    return COMPANIES.filter((c) => c.id !== me.id)
      .map((c) => ({
        ...c,
        sim: jaccard(c.themes, me.themes) * 0.5 +
          (c.industry === me.industry ? 0.2 : 0) + (c.size === me.size ? 0.15 : 0) + (c.org === me.org ? 0.15 : 0),
        qCount: Object.values(c.quality).filter(Boolean).length,
      }))
      .sort((a, b) => (b.sim + b.qCount * 0.05) - (a.sim + a.qCount * 0.05))
      .slice(0, 3);
  }, [me]);

  const ask = async () => {
    if (!question.trim() || asking) return;
    setAsking(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, companyId: me.id, filters: { industry, segment, size, org } }),
      });
      const data = await res.json();
      setAnswer(data.answer || data.error || "回答を取得できませんでした。");
    } catch {
      setAnswer("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setAsking(false);
    }
  };

  const peerRows = useMemo(() => [...peers].sort((a, b) => compositeScore(b) - compositeScore(a)), [peers]);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: font.body, color: C.ink }}>
      <header style={{ background: C.ink, color: "#fff", padding: "16px clamp(14px,3vw,28px)" }}>
        <div style={{ fontFamily: font.display, fontSize: "clamp(17px,2.6vw,21px)", fontWeight: 700, letterSpacing: 2 }}>
          監査役会レンズ <span style={{ fontSize: 11, color: "#9FB0CC", letterSpacing: 4 }}>AUDIT BOARD LENS</span>
        </div>
        <div style={{ fontSize: 10.5, color: "#9FB0CC", marginTop: 3 }}>
          有報「監査の状況」全上場企業横断分析 ｜ 出典:EDINET ｜ 本画面はサンプルデータ
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "18px clamp(12px,3vw,22px) 60px" }}>
        {/* filters */}
        <Card style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          <Select label="自社" value={me.name} options={COMPANIES.map((c) => c.name)}
            onChange={(v) => setCompanyId(COMPANIES.find((c) => c.name === v).id)} />
          <Select label="業種" value={industry} options={[ALL, ...INDUSTRIES]} onChange={setIndustry} />
          <Select label="市場区分" value={segment} options={[ALL, ...SEGMENTS]} onChange={setSegment} />
          <Select label="規模(時価総額)" value={size} options={[ALL, ...SIZES]} onChange={setSize} />
          <Select label="機関設計" value={org} options={[ALL, ...ORGS]} onChange={setOrg} />
        </Card>

        {/* score row */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14 }}>
          <Card style={{ display: "flex", gap: 18, alignItems: "center", flex: "1 1 340px" }}>
            <HankoScore score={stats.hensachi} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: font.display, fontSize: 17, fontWeight: 700 }}>{me.name}</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>
                {me.industry} ｜ {me.segment} ｜ {me.org} ｜ {me.std}
              </div>
              <div style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.7 }}>
                比較母集団 {peers.length}社中 <b style={{ fontFamily: font.display, fontSize: 16 }}>{stats.rank}位</b>。
                活動量と開示の質の合成指標です(監査品質そのものの評価ではありません)。
              </div>
            </div>
          </Card>
          <div style={{ display: "flex", gap: 10, flex: "2 1 460px", flexWrap: "wrap" }}>
            <Kpi label="監査役会 開催回数" value={me.meetings} unit="回/年"
              delta={`中央値比 ${me.meetings - stats.medMeet >= 0 ? "+" : ""}${me.meetings - stats.medMeet}回`}
              better={me.meetings >= stats.medMeet} />
            <Kpi label="平均出席率" value={me.attendance} unit="%"
              delta={`中央値比 ${Math.round(me.attendance - stats.medAtt) >= 0 ? "+" : ""}${Math.round(me.attendance - stats.medAtt)}pt`}
              better={me.attendance >= stats.medAtt} />
            <Kpi label="開示の定型文度" value={Math.round(me.stickiness * 100)} unit="%"
              delta={me.stickiness <= stats.medStick ? "中央値以下(良)" : "前年踏襲が強い"}
              better={me.stickiness <= stats.medStick} />
            <Kpi label="議題カバレッジ" value={me.themes.length} unit={`/${THEMES.length}`}
              delta={gaps.length ? `要検討 ${gaps.length}件` : "ギャップなし"} better={gaps.length === 0} />
          </div>
        </div>

        {/* quality checklist */}
        <Card style={{ marginTop: 14 }}>
          <SectionTitle kanji="開示質チェック(金融庁好事例集・有報レビュー観点)"
            sub="投資家・当局が期待する記載の有無と、比較母集団での実施率" />
          <div style={{ display: "grid", gap: 8 }}>
            {qualityRows.map((q) => (
              <div key={q.key} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 10px", borderRadius: 8, background: q.mine ? C.goodSoft : q.rate >= 40 ? C.shuSoft : "#FAFBFC" }}>
                <span style={{ fontWeight: 800, color: q.mine ? C.good : C.shu, width: 20 }}>{q.mine ? "○" : "×"}</span>
                <span style={{ fontSize: 12.5, flex: "1 1 240px" }}>{q.label}</span>
                <span style={{ fontSize: 11, color: C.muted }}>{q.src}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: C.navy }}>母集団実施率 {q.rate}%</span>
              </div>
            ))}
          </div>
        </Card>

        {/* agenda gap */}
        <Card style={{ marginTop: 14, borderLeft: `4px solid ${gaps.length ? C.shu : C.good}` }}>
          <SectionTitle kanji="アジェンダ・ギャップ分析" sub="母集団の過半が検討しているのに自社が未検討のテーマを朱で表示" />
          {gaps.length > 0 && (
            <div style={{ background: C.shuSoft, color: C.shu, borderRadius: 8, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, marginBottom: 12 }}>
              未検討 {gaps.length}テーマ: {gaps.map((g) => g.theme).join(" / ")}
            </div>
          )}
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={gapData} layout="vertical" margin={{ left: 8, right: 44, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke={C.line} />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: C.muted }} />
                <YAxis type="category" dataKey="theme" width={128} tick={{ fontSize: 10.5, fill: C.ink }} />
                <Tooltip formatter={(v, n, p) => [`${v}%(自社:${p.payload.discussed ? "検討済" : "未検討"})`, "母集団の検討実施率"]} contentStyle={{ fontFamily: font.body, fontSize: 12 }} />
                <Bar dataKey="rate" radius={[0, 3, 3, 0]} barSize={14}>
                  {gapData.map((d, i) => <Cell key={i} fill={d.gap ? C.shu : d.discussed ? C.navy : C.navySoft} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* scatter + hist */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14, marginTop: 14 }}>
          <Card>
            <SectionTitle kanji="開催頻度 × 出席率" sub="点線=母集団中央値。朱の菱形が自社" />
            <div style={{ height: 270 }}>
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 8, right: 14, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke={C.line} />
                  <XAxis type="number" dataKey="meetings" unit="回" domain={[4, 20]} tick={{ fontSize: 10, fill: C.muted }} />
                  <YAxis type="number" dataKey="attendance" unit="%" domain={[88, 101]} tick={{ fontSize: 10, fill: C.muted }} />
                  <ZAxis range={[60, 200]} />
                  <ReferenceLine x={stats.medMeet} stroke={C.muted} strokeDasharray="4 4" />
                  <ReferenceLine y={stats.medAtt} stroke={C.muted} strokeDasharray="4 4" />
                  <Tooltip content={({ payload }) => payload?.length ? (
                    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 6, padding: 9, fontSize: 11.5 }}>
                      <b>{payload[0].payload.name}</b><br />{payload[0].payload.org}<br />
                      開催{payload[0].payload.meetings}回 ｜ 出席率{payload[0].payload.attendance}%
                    </div>) : null} />
                  <Scatter data={peers.filter((d) => d.id !== me.id)} fill={C.navySoft} fillOpacity={0.8} />
                  <Scatter data={peers.filter((d) => d.id === me.id)} fill={C.shu} shape="diamond" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <SectionTitle kanji="開催回数の分布" sub="朱の帯が自社の位置" />
            <div style={{ height: 270 }}>
              <ResponsiveContainer>
                <BarChart data={hist} margin={{ top: 8, right: 10, left: -18, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke={C.line} />
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: C.muted }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: C.muted }} />
                  <Tooltip formatter={(v) => [`${v}社`, "社数"]} contentStyle={{ fontFamily: font.body, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]} barSize={40}>
                    {hist.map((d, i) => <Cell key={i} fill={d.mine ? C.shu : C.navy} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* AI similar + ask */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14, marginTop: 14 }}>
          <Card>
            <SectionTitle kanji="AIが見つけた参考開示企業" sub="議題・属性の意味的類似度が高く、開示の質が厚い企業(実運用は埋め込みベクトル検索)" />
            {similar.map((c) => (
              <div key={c.id} style={{ borderBottom: `1px solid ${C.line}`, padding: "9px 2px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <b style={{ fontSize: 13 }}>{c.name}</b>
                  <span style={{ fontSize: 11, color: C.navy, fontWeight: 700 }}>類似度 {Math.round(c.sim * 100)}%</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {c.industry}・{c.segment}・{c.org} ｜ 質チェック {c.qCount}/{QUALITY_ITEMS.length}項目 ｜ 開催{c.meetings}回
                </div>
              </div>
            ))}
          </Card>
          <Card>
            <SectionTitle kanji="AIに質問(RAG)" sub="収集した開示原文を根拠に、出典付きで回答します" />
            <div style={{ display: "flex", gap: 8 }}>
              <input value={question} onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask()}
                placeholder="例: 同業プライムでKAM検討過程を開示している例は?"
                style={{ flex: 1, fontFamily: font.body, fontSize: 13, padding: "9px 10px", borderRadius: 8, border: `1px solid ${C.line}`, minWidth: 0 }} />
              <button onClick={ask} disabled={asking}
                style={{ fontFamily: font.body, fontSize: 13, fontWeight: 700, padding: "9px 16px", borderRadius: 8, border: "none", background: asking ? C.navySoft : C.navy, color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>
                {asking ? "検索中…" : "質問する"}
              </button>
            </div>
            {answer && (
              <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.8, background: "#FAFBFC", border: `1px solid ${C.line}`, borderRadius: 8, padding: 12, whiteSpace: "pre-wrap" }}>{answer}</div>
            )}
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 8 }}>
              回答は下書きです。最終判断は必ず原文をご確認ください。
            </div>
          </Card>
        </div>

        {/* trend */}
        <Card style={{ marginTop: 14 }}>
          <SectionTitle kanji="検討テーマの経年トレンド(全産業)" sub="「主な検討事項」への言及率。来期監査計画の重点テーマ選定の根拠に" />
          <div style={{ height: 250 }}>
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 8, right: 16, left: -14, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke={C.line} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} />
                <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 10, fill: C.muted }} />
                <Tooltip contentStyle={{ fontFamily: font.body, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: font.body }} />
                <Line type="monotone" dataKey="サイバーセキュリティ" stroke={C.shu} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="サステナビリティ開示" stroke={C.navy} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="実効性評価の開示" stroke={C.navySoft} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* peer table */}
        <Card style={{ marginTop: 14 }}>
          <SectionTitle kanji="ピア比較" sub="比較母集団・合成スコア順" />
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 640 }}>
              <thead>
                <tr style={{ color: C.muted, textAlign: "left", borderBottom: `2px solid ${C.ink}` }}>
                  {["#", "会社名", "市場", "機関設計", "開催", "出席率", "定型文度", "質チェック", "議題数"].map((h) => (
                    <th key={h} style={{ padding: "7px 9px", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {peerRows.map((c, i) => {
                  const isMe = c.id === me.id;
                  return (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${C.line}`, background: isMe ? C.shuSoft : i % 2 ? "#FAFBFC" : "transparent", fontWeight: isMe ? 700 : 400 }}>
                      <td style={{ padding: "7px 9px", color: C.muted }}>{i + 1}</td>
                      <td style={{ padding: "7px 9px", color: isMe ? C.shu : C.ink, whiteSpace: "nowrap" }}>{c.name}</td>
                      <td style={{ padding: "7px 9px" }}>{c.segment}</td>
                      <td style={{ padding: "7px 9px", whiteSpace: "nowrap" }}>{c.org}</td>
                      <td style={{ padding: "7px 9px" }}>{c.meetings}回</td>
                      <td style={{ padding: "7px 9px" }}>{c.attendance}%</td>
                      <td style={{ padding: "7px 9px" }}>{Math.round(c.stickiness * 100)}%</td>
                      <td style={{ padding: "7px 9px" }}>{Object.values(c.quality).filter(Boolean).length}/{QUALITY_ITEMS.length}</td>
                      <td style={{ padding: "7px 9px" }}>{c.themes.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{ fontSize: 10.5, color: C.muted, marginTop: 18, lineHeight: 1.8 }}>
          データソース: EDINET(金融庁)有価証券報告書「第4 提出会社の状況 4(3) 監査の状況」jpcrp_cor:AuditsTextBlock を月次バッチ収集しLLMで構造化。
          偏差値・スコアは活動量と開示の質の合成指標であり、監査品質そのものの評価ではありません。本画面の数値はすべて架空のサンプルです。
        </div>
      </main>
    </div>
  );
}
