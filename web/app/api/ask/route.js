// RAG質問応答API。実運用ではSupabase pgvectorで関連開示を検索して文脈に渡す。
// 現段階ではサンプルデータの上位類似行を文脈として使用する。
import { NextResponse } from "next/server";
import { buildCompanies, QUALITY_ITEMS } from "../../../lib/mockData";

export async function POST(req) {
  const { question, companyId } = await req.json();
  if (!question?.trim()) {
    return NextResponse.json({ error: "質問を入力してください。" }, { status: 400 });
  }

  const companies = buildCompanies();
  const me = companies.find((c) => c.id === companyId);
  // 簡易リトリーバル(実運用: embedding検索に置換)
  const context = companies
    .filter((c) => c.id !== companyId)
    .slice(0, 12)
    .map(
      (c) =>
        `【${c.name}｜${c.industry}｜${c.segment}｜${c.org}】開催${c.meetings}回、出席率${c.attendance}%、` +
        `質チェック${Object.values(c.quality).filter(Boolean).length}/${QUALITY_ITEMS.length}、検討テーマ: ${c.themes.join("、")}`
    )
    .join("\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      answer:
        "(デモ応答)ANTHROPIC_API_KEYが未設定のため定型応答を返しています。" +
        "デプロイ時に環境変数を設定すると、収集済み開示データを根拠にした出典付き回答が有効になります。",
    });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system:
        "あなたは日本企業のガバナンス開示の専門アナリストです。与えられた開示データのみを根拠に、" +
        "必ず企業名を出典として示しながら簡潔に日本語で回答してください。データにない情報は「データに記載がありません」と答えてください。",
      messages: [
        {
          role: "user",
          content: `自社: ${me?.name ?? "未選択"}\n\n開示データ:\n${context}\n\n質問: ${question}`,
        },
      ],
    }),
  });
  const data = await res.json();
  const answer = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return NextResponse.json({ answer: answer || "回答を生成できませんでした。" });
}
