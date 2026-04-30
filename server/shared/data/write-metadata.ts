import type { WorkbenchRole } from "@shared/auth/me";

export type MetadataSource = "manual" | "agent" | "webhook" | "system" | "migration" | "external" | "external-checkin-system";

export interface ActorContext {
  userId: string;
  role: WorkbenchRole;
  facilityKey?: string;
  source?: MetadataSource;
}

export const withCreateMetadata = <T extends Record<string, unknown>>(
  data: T,
  actor: ActorContext,
): T & {
  createdBy: string;
  createdByRole: WorkbenchRole;
  source: MetadataSource;
  updatedAt: Date;
  facilityKey?: string;
} => ({
  ...data,
  createdBy: actor.userId,
  createdByRole: actor.role,
  source: actor.source ?? "manual",
  updatedAt: new Date(),
  facilityKey: (data.facilityKey as string | undefined) ?? actor.facilityKey,
});

export const withEmployeeCreateMetadata = <T extends Record<string, unknown>>(
  data: T,
  actor: ActorContext,
  displayName?: string,
): T & {
  createdByEmployeeNumber: string;
  createdByName?: string;
  createdByRole: WorkbenchRole;
  source: MetadataSource;
  updatedAt: Date;
  facilityKey?: string;
} => ({
  ...data,
  createdByEmployeeNumber: actor.userId,
  ...(displayName ? { createdByName: displayName } : {}),
  createdByRole: actor.role,
  source: actor.source ?? "manual",
  updatedAt: new Date(),
  facilityKey: (data.facilityKey as string | undefined) ?? actor.facilityKey,
});

export const withTaskCreateMetadata = <T extends Record<string, unknown>>(
  data: T,
  actor: ActorContext,
  displayName: string,
): T & {
  source: WorkbenchRole;
  inputSource: MetadataSource;
  createdByUserId: string;
  createdByName: string;
  createdByRole: WorkbenchRole;
  updatedAt: Date;
  facilityKey?: string;
} => ({
  ...data,
  source: actor.role,
  inputSource: actor.source ?? "manual",
  createdByUserId: actor.userId,
  createdByName: displayName,
  createdByRole: actor.role,
  updatedAt: new Date(),
  facilityKey: (data.facilityKey as string | undefined) ?? actor.facilityKey,
});

export const withUpdateMetadata = <T extends Record<string, unknown>>(
  data: T,
  actor: ActorContext,
): T & {
  updatedBy: string;
  updatedAt: Date;
} => ({
  ...data,
  updatedBy: actor.userId,
  updatedAt: new Date(),
});
