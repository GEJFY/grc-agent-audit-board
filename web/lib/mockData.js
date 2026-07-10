// サンプルデータ生成(実運用ではSupabaseのaudit_disclosuresに置換)
// 属性軸: 業種 × 市場区分 × 規模 × 機関設計 × 会計基準

export const THEMES = [
  "内部統制(J-SOX)評価", "会計監査人との連携・KAM", "サイバーセキュリティ",
  "グループガバナンス", "サステナビリティ開示", "内部通報制度の運用",
  "IT全般統制", "品質・コンプライアンス", "政策保有株式", "経営リスク・事業ポートフォリオ",
];
export const INDUSTRIES = ["電気機器", "輸送用機器", "医薬品", "情報・通信", "銀行"];
export const SEGMENTS = ["プライム", "スタンダード", "グロース"];
export const SIZES = ["大型(5000億円〜)", "中型(1000〜5000億円)", "小型(〜1000億円)"];
export const ORGS = ["監査役会設置会社", "監査等委員会設置会社", "指名委員会等設置会社"];

// 金融庁「記述情報の開示の好事例集」+有報レビュー指摘に基づく開示質チェック項目
export const QUALITY_ITEMS = [
  { key: "has_audit_conclusion", label: "重点監査項目への監査結果・認識の記載", src: "好事例集2024" },
  { key: "has_kam_discussion", label: "KAMに関する監査役等の検討内容", src: "好事例集2024" },
  { key: "has_effectiveness_evaluation", label: "監査役会等の実効性評価への言及", src: "好事例集2024" },
  { key: "has_three_way_audit", label: "三様監査の連携状況", src: "実効性評価調査" },
  { key: "has_dual_reporting", label: "内部監査のデュアルレポーティング", src: "有報レビュー指摘" },
];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAME_A = ["東邦", "相模", "北斗", "大和", "旭光", "常磐", "京浜", "瀬戸", "白山", "武蔵", "近江", "扇島"];
const NAME_B = {
  "電気機器": ["電装", "電子工業", "計測器", "精機"],
  "輸送用機器": ["車体", "機工", "重工", "発条"],
  "医薬品": ["製薬", "薬品", "バイオ", "生命科学"],
  "情報・通信": ["情報システム", "ネットワークス", "データ", "ソリューションズ"],
  "銀行": ["フィナンシャルグループ", "銀行", "ホールディングス", "信託"],
};

export function buildCompanies() {
  const rng = mulberry32(20260710);
  const list = [];
  let id = 1;
  INDUSTRIES.forEach((ind) => {
    for (let k = 0; k < 14; k++) {
      const segment = SEGMENTS[rng() < 0.5 ? 0 : rng() < 0.75 ? 1 : 2];
      const size = segment === "プライム" ? SIZES[rng() < 0.5 ? 0 : 1] : SIZES[rng() < 0.3 ? 1 : 2];
      const org = ORGS[rng() < 0.55 ? 0 : rng() < 0.85 ? 1 : 2];
      const base = (ind === "銀行" ? 14 : ind === "医薬品" ? 12 : 11) + (segment === "プライム" ? 1 : 0);
      const meetings = Math.max(5, Math.round(base + (rng() - 0.5) * 8));
      const attendance = Math.min(100, Math.round(90 + rng() * 10));
      const total = 3 + Math.floor(rng() * 3);
      const outside = Math.max(2, Math.round(total * (0.5 + rng() * 0.3)));
      const themes = THEMES.filter((t) => {
        let p = 0.5;
        if (t === "内部統制(J-SOX)評価" || t === "会計監査人との連携・KAM") p = 0.95;
        if (t === "サイバーセキュリティ") p = ind === "情報・通信" ? 0.85 : 0.55;
        if (t === "政策保有株式") p = ind === "銀行" ? 0.8 : 0.4;
        if (segment === "プライム") p += 0.1;
        return rng() < p;
      });
      // 好事例集ベースの質フラグ(プライム大型ほど実施率が高い傾向を再現)
      const qBias = (segment === "プライム" ? 0.25 : 0) + (size === SIZES[0] ? 0.15 : 0);
      const quality = Object.fromEntries(
        QUALITY_ITEMS.map((q, i) => [q.key, rng() < 0.25 + qBias + (i < 2 ? 0.2 : 0)])
      );
      list.push({
        id: id++, name: NAME_A[(id * 5) % NAME_A.length] + NAME_B[ind][(id * 3) % NAME_B[ind].length],
        industry: ind, segment, size, org,
        std: rng() < 0.35 ? "IFRS" : "日本基準",
        meetings, attendance, total, outside,
        fullTime: 1 + (rng() < 0.5 ? 1 : 0),
        expert: rng() < 0.72,
        themes, quality,
        stickiness: Math.round((0.35 + rng() * 0.6) * 100) / 100,
      });
    }
  });
  list.push({
    id: 999, name: "大和電子工業(自社)", industry: "電気機器", segment: "プライム",
    size: SIZES[1], org: "監査役会設置会社", std: "IFRS",
    meetings: 8, attendance: 98, total: 4, outside: 2, fullTime: 2, expert: true,
    themes: ["内部統制(J-SOX)評価", "会計監査人との連携・KAM", "内部通報制度の運用", "品質・コンプライアンス"],
    quality: {
      has_audit_conclusion: false, has_kam_discussion: true,
      has_effectiveness_evaluation: false, has_three_way_audit: true, has_dual_reporting: false,
    },
    stickiness: 0.91,
  });
  return list;
}

export const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const mean = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
export const sd = (arr) => {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2))) || 1;
};

export function compositeScore(c) {
  const cover = c.themes.length / THEMES.length;
  const q = Object.values(c.quality).filter(Boolean).length / QUALITY_ITEMS.length;
  return (c.meetings / 18) * 0.25 + (c.attendance / 100) * 0.15 +
    (c.outside / c.total) * 0.1 + (c.expert ? 0.1 : 0) +
    cover * 0.2 + q * 0.15 + (1 - c.stickiness) * 0.05;
}
