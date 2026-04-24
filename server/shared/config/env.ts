export type RuntimeEnvironment = "development" | "test" | "production";
export type DataSourceMode = "mock" | "test" | "real";
export type DatabaseProfile = "mock" | "local" | "test" | "neon";
export type AdapterMode = "mock" | "real";

const read = (key: string) => process.env[key]?.trim();

const parseList = (value: string | undefined): string[] =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const pick = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

export const env = {
  nodeEnv: pick(read("NODE_ENV"), ["development", "test", "production"] as const, "development"),
  port: Number(read("PORT") || 5000),
  dataSourceMode: pick(read("DATA_SOURCE_MODE"), ["mock", "test", "real"] as const, "mock"),
  databaseProfile: pick(read("DATABASE_PROFILE"), ["mock", "local", "test", "neon"] as const, "mock"),
  databaseUrl: read("DATABASE_URL"),
  redisUrl: read("REDIS_URL"),
  allowedOrigins: parseList(read("ALLOWED_ORIGINS")),
  scheduleAdapterMode: pick(read("SCHEDULE_ADAPTER_MODE"), ["mock", "real"] as const, "mock"),
  bookingAdapterMode: pick(read("BOOKING_ADAPTER_MODE"), ["mock", "real"] as const, "mock"),
  ragicAdapterMode: pick(read("RAGIC_ADAPTER_MODE"), ["mock", "real"] as const, "mock"),
  storageAdapterMode: pick(read("STORAGE_ADAPTER_MODE"), ["mock", "real"] as const, "mock"),
  replitDataAdapterMode: pick(read("REPLIT_DATA_ADAPTER_MODE"), ["mock", "real"] as const, "mock"),
  replitDataBaseUrl: read("REPLIT_DATA_BASE_URL"),
  replitDataApiToken: read("REPLIT_DATA_API_TOKEN"),
  replitDataTimeoutMs: Number(read("REPLIT_DATA_TIMEOUT_MS") || 8000),
  lineBotBaseUrl: read("LINE_BOT_BASE_URL") || "https://line-bot-assistant-ronchen2.replit.app",
  internalApiToken: read("INTERNAL_API_TOKEN"),
  lineBotInternalToken: read("LINE_BOT_INTERNAL_TOKEN") || read("LINE_BOT_API_TOKEN") || read("REPLIT_DATA_API_TOKEN") || read("INTERNAL_API_TOKEN"),
  smartScheduleBaseUrl: read("SMART_SCHEDULE_BASE_URL") || "https://smart-schedule-manager.replit.app",
  smartScheduleApiToken: read("SMART_SCHEDULE_API_TOKEN") || read("SMART_SCHEDULE_INTERNAL_TOKEN") || read("INTERNAL_API_TOKEN"),
  externalApiTimeoutMs: Number(read("EXTERNAL_API_TIMEOUT_MS") || 10000),
  ragicApiKey: read("RAGIC_API_KEY"),
  ragicHost: read("RAGIC_HOST") || "ap7.ragic.com",
  ragicAccountPath: read("RAGIC_ACCOUNT_PATH") || "xinsheng",
  ragicEmployeeSheet: read("RAGIC_EMPLOYEE_SHEET") || "/ragicforms4/13",
  sessionCookieName: read("SESSION_COOKIE_NAME") || "workbench_sid",
  sessionTtlSeconds: Number(read("SESSION_TTL_SECONDS") || 60 * 60 * 8),
} as const;

export const isProduction = env.nodeEnv === "production";
export const isRealDataMode = env.dataSourceMode === "real";
