export const LINE_FEATURES = [
  {
    key: "interview",
    label: "面試模組",
    description: "允許 400 LINE 官方帳號使用面試慎用查詢與授權流程。",
  },
  {
    key: "caution-query",
    label: "慎用查詢",
    description: "允許查詢 Ragic 慎用名單與相關人事風險資料。",
  },
  {
    key: "staff-lookup",
    label: "人員查詢",
    description: "允許查詢 Ragic 員工姓名、userid、電話與部門資訊。",
  },
  {
    key: "helper-admin",
    label: "小幫手管理",
    description: "允許操作 400 小幫手管理型指令與狀態查詢。",
  },
  {
    key: "ai-agent",
    label: "AI 智能客服",
    description: "允許使用 400 LINE 官方帳號安置AGENT智能客服功能。",
  },
] as const;

export type LineFeatureKey = typeof LINE_FEATURES[number]["key"];

export const defaultLineFeatureAccess = () =>
  Object.fromEntries(LINE_FEATURES.map((feature) => [feature.key, feature.key === "interview"])) as Record<LineFeatureKey, boolean>;

export const normalizeLineFeatureAccess = (value: Record<string, boolean> | null | undefined) =>
  Object.fromEntries(LINE_FEATURES.map((feature) => [feature.key, Boolean(value?.[feature.key])])) as Record<LineFeatureKey, boolean>;
