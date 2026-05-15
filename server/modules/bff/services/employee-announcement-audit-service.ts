import { findFacilityLineGroup } from "@shared/domain/facilities";
import type { EmployeeHomeDto } from "@shared/domain/workbench";
import type { Request } from "express";
import type { AppContainer } from "../../../app/container";
import { storage } from "../../../storage";

export const attachAnnouncementAcknowledgements = async (
  dto: EmployeeHomeDto,
  facilityKey: string,
  userId?: string,
): Promise<EmployeeHomeDto> => {
  if (!userId || !dto.announcements.data?.length) return dto;
  const normalizedFacilityKey =
    findFacilityLineGroup(facilityKey)?.facilityKey ?? facilityKey;
  const acknowledgements = await storage
    .listAnnouncementAcknowledgements({
      facilityKey: normalizedFacilityKey,
      userId,
    })
    .catch(() => []);
  if (!acknowledgements.length) {
    return {
      ...dto,
      announcements: {
        ...dto.announcements,
        data: dto.announcements.data.map((item) => ({
          ...item,
          isAcknowledged: false,
        })),
      },
    };
  }
  const acknowledgementById = new Map(
    acknowledgements.map((item) => [item.announcementId, item]),
  );
  return {
    ...dto,
    announcements: {
      ...dto.announcements,
      data: dto.announcements.data.map((item) => {
        const acknowledgement = acknowledgementById.get(item.id);
        return {
          ...item,
          isAcknowledged: Boolean(acknowledgement),
          acknowledgedAt: acknowledgement?.acknowledgedAt?.toISOString(),
        };
      }),
    },
  };
};

export const auditEmployeeAnnouncementPreview = async (
  container: AppContainer,
  req: Request,
  facilityKey: string,
  dto: EmployeeHomeDto,
  action = "EMPLOYEE_ANNOUNCEMENTS_PREVIEWED",
) => {
  try {
    await container.repositories.telemetry.recordAudit({
      actorId: req.workbenchSession?.userId ?? "unknown",
      role: req.workbenchSession?.activeRole ?? "employee",
      facilityKey,
      action,
      resource: "announcements",
      payload: {
        count: dto.announcements.data?.length ?? 0,
        status: dto.announcements.status,
        errorCode: dto.announcements.meta.errorCode,
      },
      correlationId:
        typeof req.headers["x-correlation-id"] === "string"
          ? req.headers["x-correlation-id"]
          : undefined,
      resultStatus: "success",
    });
  } catch (error) {
    console.warn("[bff] announcement preview audit failed:", error);
  }
};
