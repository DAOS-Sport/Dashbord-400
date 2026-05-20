import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type RuntimeEnvironment = "development" | "test" | "production";
export type DataSourceMode = "mock" | "test" | "real";
export type DatabaseProfile = "mock" | "local" | "test" | "neon";
export type AdapterMode = "mock" | "real";

const loadLocalEnv = () => {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
  content.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) return;

    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) return;

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
};

loadLocalEnv();

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
  databaseUrl: read("NEON_DATABASE_URL") || read("DATABASE_URL"),
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
  lineBotAdminToken: read("LINE_BOT_ADMIN_TOKEN") || null,
  internalApiToken: read("INTERNAL_API_TOKEN"),
  lineBotInternalToken: read("LINE_BOT_INTERNAL_TOKEN") || read("LINE_BOT_API_TOKEN") || read("REPLIT_DATA_API_TOKEN") || read("INTERNAL_API_TOKEN"),
  smartScheduleBaseUrl: read("SMART_SCHEDULE_BASE_URL") || "https://smart-schedule-manager.replit.app",
  smartScheduleApiToken: read("SMART_SCHEDULE_API_TOKEN") || read("SMART_SCHEDULE_INTERNAL_TOKEN") || read("INTERNAL_API_TOKEN"),
  swimSchedulerBaseUrl: read("SWIM_SCHEDULER_BASE_URL") || "https://swim-scheduler-ronchen2.replit.app",
  swimSchedulerAdminPassword: read("SWIM_SCHEDULER_ADMIN_PASSWORD"),
  externalApiTimeoutMs: Number(read("EXTERNAL_API_TIMEOUT_MS") || 10000),
  ragicApiKey: read("RAGIC_API_KEY"),
  ragicHost: read("RAGIC_HOST") || "ap7.ragic.com",
  ragicAccountPath: read("RAGIC_ACCOUNT_PATH") || "xinsheng",
  ragicEmployeeSheet: read("RAGIC_EMPLOYEE_SHEET") || "/ragicforms4/13",
  ragicFacilitySheet: read("RAGIC_FACILITY_SHEET") || "/ragicforms4/7",
  sessionCookieName: read("SESSION_COOKIE_NAME") || "workbench_sid",
  sessionTtlSeconds: Number(read("SESSION_TTL_SECONDS") || 60 * 60 * 8),
  googleApiKey: read("GOOGLE_API_KEY"),
  groupBroadcastGeminiModel: read("GROUP_BROADCAST_GEMINI_MODEL") || "gemini-2.0-flash",
} as const;

export const isProduction = env.nodeEnv === "production";
export const isRealDataMode = env.dataSourceMode === "real";
