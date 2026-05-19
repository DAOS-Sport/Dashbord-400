import { apiGet, apiPost } from "@/shared/api/client";
import type {
  LinebotManagementFacilitiesDto,
  LinebotManagementOverviewDto,
  LinebotManagementPipelineDto,
  LinebotManagementServicesDto,
  LinebotManagementWhitelistDto,
  LinebotWhitelistSyncResult,
} from "@shared/system/linebot-management-contract";

export const fetchLinebotManagementOverview = () =>
  apiGet<LinebotManagementOverviewDto>("/api/bff/system/linebot-management/overview");

export const fetchLinebotManagementServices = () =>
  apiGet<LinebotManagementServicesDto>("/api/bff/system/linebot-management/services");

export const fetchLinebotManagementFacilities = () =>
  apiGet<LinebotManagementFacilitiesDto>("/api/bff/system/linebot-management/facilities");

export const fetchLinebotManagementWhitelist = () =>
  apiGet<LinebotManagementWhitelistDto>("/api/bff/system/linebot-management/whitelist-comparison");

export const fetchLinebotManagementPipeline = () =>
  apiGet<LinebotManagementPipelineDto>("/api/bff/system/linebot-management/announcement-pipeline");

export const syncLinebotWhitelistShadow = (lineUserIds?: string[]) =>
  apiPost<LinebotWhitelistSyncResult>("/api/bff/system/linebot-management/whitelist-sync-shadow", lineUserIds ? { lineUserIds } : {});
