import { desc } from "drizzle-orm";
import { db } from "../../db";
import { lineFeatureWhitelist } from "@shared/schema";
import { normalizeLineFeatureAccess } from "@shared/system/line-feature-whitelist";

export const toNullableDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

export const lineWhitelistDto = (row: typeof lineFeatureWhitelist.$inferSelect) => ({
  id: row.id,
  lineUserId: row.lineUserId,
  employeeNumber: row.employeeNumber,
  displayName: row.displayName,
  phone: row.phone,
  department: row.department,
  status: row.status as "active" | "disabled",
  featureAccess: normalizeLineFeatureAccess(row.featureAccess),
  startsAt: row.startsAt ? row.startsAt.toISOString() : null,
  endsAt: row.endsAt ? row.endsAt.toISOString() : null,
  unlimited: row.unlimited,
  notes: row.notes,
  source: row.source,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const isMissingWhitelistTable = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
    ("code" in error ? (error as { code?: string }).code === "42P01" : /line_feature_whitelist/i.test(error instanceof Error ? error.message : String(error)));

export const isMissingCautionTable = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  ("code" in error
    ? (error as { code?: string }).code === "42P01"
    : /caution_query_permissions|caution_query_permission_audit/i.test(error instanceof Error ? error.message : String(error)));

export const listLineWhitelist = async () => {
  try {
    const rows = await db
      .select()
      .from(lineFeatureWhitelist)
      .orderBy(desc(lineFeatureWhitelist.updatedAt), desc(lineFeatureWhitelist.id));
    return {
      storageStatus: "ready" as const,
      items: rows.map(lineWhitelistDto),
      error: null,
    };
  } catch (error) {
    if (isMissingWhitelistTable(error)) {
      return {
        storageStatus: "schema_pending" as const,
        items: [],
        error: "line_feature_whitelist table is not created yet. Run migration 0011_line_feature_whitelist.sql or npm run db:push.",
      };
    }
    throw error;
  }
};

export const activeForFeature = (
  row: typeof lineFeatureWhitelist.$inferSelect,
  featureKey: string,
  now = new Date(),
) => {
  const access = normalizeLineFeatureAccess(row.featureAccess);
  if (row.status !== "active" || !access[featureKey as keyof typeof access]) return false;
  if (row.startsAt && row.startsAt.getTime() > now.getTime()) return false;
  if (!row.unlimited && row.endsAt && row.endsAt.getTime() < now.getTime()) return false;
  return true;
};
