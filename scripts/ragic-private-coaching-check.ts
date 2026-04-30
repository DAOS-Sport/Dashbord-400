type RagicFormConfig = {
  id: string;
  label: string;
  path: string;
};

type RagicCheckResult = RagicFormConfig & {
  ok: boolean;
  status: number;
  count: number;
  sampleKeys?: string[];
  error?: string;
};

const apiKey = process.env.RAGIC_API_KEY?.trim();

if (!apiKey) {
  throw new Error("RAGIC_API_KEY is required. Do not commit API keys; pass it through the environment.");
}

const forms: RagicFormConfig[] = [
  { id: "coach-employment-h01", label: "教練在職狀態 H01", path: "/xinsheng/ragicforms4/20004" },
  { id: "facilities-bank-h05", label: "場館清單與銀行 H05", path: "/xinsheng/ragicforms4/7" },
  { id: "parent-accounts-z01", label: "家長帳號 Z01", path: "/xinsheng/general-information/6" },
  { id: "student-data-z02", label: "學員資料 Z02", path: "/xinsheng/general-information/11" },
];

const limit = Number(process.env.RAGIC_CHECK_LIMIT || 1000);
const maxPages = Number(process.env.RAGIC_CHECK_MAX_PAGES || 20);

const countRows = async (form: RagicFormConfig): Promise<RagicCheckResult> => {
  let count = 0;
  let firstStatus = 0;
  let sampleKeys: string[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`https://ap7.ragic.com${form.path}`);
    url.searchParams.set("api", "");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(page * limit));

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (page === 0) firstStatus = response.status;
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ...form,
        ok: false,
        status: response.status,
        count,
        error: body.slice(0, 160),
      };
    }

    const json = await response.json() as Record<string, unknown>;
    const rows = Object.values(json).filter((row) => row && typeof row === "object");
    if (page === 0 && rows[0]) sampleKeys = Object.keys(rows[0] as Record<string, unknown>).slice(0, 10);
    count += rows.length;
    if (rows.length < limit) break;
  }

  return {
    ...form,
    ok: true,
    status: firstStatus,
    count,
    sampleKeys,
  };
};

const results = await Promise.all(forms.map(countRows));

console.log("Ragic private coaching API check");
console.log("================================");
for (const result of results) {
  console.log(`${result.ok ? "OK" : "FAIL"} ${result.label}: status=${result.status}, count=${result.count}`);
  if (result.sampleKeys?.length) console.log(`  sampleKeys=${result.sampleKeys.join(", ")}`);
  if (result.error) console.log(`  error=${result.error}`);
}
