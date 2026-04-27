import type { HomeCardDto, ModuleDescriptor, ModuleHealthDto, NavigationModuleDto } from "@shared/modules";
import { apiGet, apiPatch } from "@/shared/api/client";

export const fetchModuleRegistry = () =>
  apiGet<{ items: ModuleDescriptor[]; role: string; visibility: "technical" | "public" }>("/api/modules/registry");

export const fetchModuleNavigation = () =>
  apiGet<{ role: string; items: NavigationModuleDto[] }>("/api/modules/navigation");

export const fetchModuleHomeLayout = () =>
  apiGet<{ role: string; cards: HomeCardDto[] }>("/api/modules/home-layout");

export const fetchModuleHealth = () =>
  apiGet<{ role: string; items: ModuleHealthDto[] }>("/api/modules/health");

export const updateModuleSettings = (moduleId: string, input: unknown) =>
  apiPatch<{ accepted: boolean; moduleId: string; status: string; message: string }>(`/api/modules/${moduleId}/settings`, input);
