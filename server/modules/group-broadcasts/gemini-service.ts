import { env } from "../../shared/config/env";

export interface GeminiEventResult {
  isEvent: boolean;
  summary: string | null;
  startAt: string | null;
  endAt: string | null;
}

const SYSTEM_PROMPT = `你是一個繁體中文公告分析助理。請分析以下群組廣播訊息，判斷是否為「活動/課程/折扣」公告（有明確時間或報名期限）。
回傳純 JSON，格式如下：
{
  "isEvent": true/false,
  "summary": "不超過 80 字的白話摘要，或 null",
  "startAt": "ISO8601 開始時間，或 null（若無法從訊息推斷）",
  "endAt": "ISO8601 結束時間，或 null（若無法從訊息推斷）"
}
規則：
- isEvent=true：有明確課程/活動/報名/優惠時間，或含「即日起」/「截止」/「開放」/「報名」等詞
- isEvent=false：純通知/規定/SOP/流程/人員指示
- summary：精煉重點，不要重複標題
- 時間只能從訊息內容推斷，不要捏造，推不出來就給 null
- 今年是 ${new Date().getFullYear()} 年`;

export async function analyzeGroupBroadcastWithGemini(
  title: string,
  content: string,
): Promise<GeminiEventResult | null> {
  if (!env.googleApiKey) {
    return null;
  }

  const model = env.groupBroadcastGeminiModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.googleApiKey}`;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: "user",
        parts: [{ text: `標題：${title}\n\n內容：${content}` }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 256,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn(`[group-broadcasts] Gemini API error ${response.status}: ${errText}`);
      return null;
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) return null;

    const parsed = JSON.parse(text) as {
      isEvent?: boolean;
      summary?: string | null;
      startAt?: string | null;
      endAt?: string | null;
    };

    return {
      isEvent: Boolean(parsed.isEvent),
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 200) : null,
      startAt: typeof parsed.startAt === "string" ? parsed.startAt : null,
      endAt: typeof parsed.endAt === "string" ? parsed.endAt : null,
    };
  } catch (err) {
    console.warn("[group-broadcasts] Gemini analysis failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
