import type { Express } from "express";
import { helperEndpoints, helperEnvGroups, helperExternalServices, helperResilienceRules } from "@shared/system/helper-status";
import { requireRole, requireSession } from "../auth/context";

const isEnvConfigured = (key: string) => Boolean(process.env[key]?.trim());

export const buildHelperServiceStatus = () => {
  const services = helperExternalServices.map((service) => {
    const configuredKeys = service.credentialKeys.filter(isEnvConfigured);
    const configured = service.credentialKeys.length === 0 || configuredKeys.length === service.credentialKeys.length;
    return {
      ...service,
      configured,
      status: configured ? "ready" as const : "not_connected" as const,
      missingCredentialKeys: service.credentialKeys.filter((key) => !configuredKeys.includes(key)),
    };
  });
  const envGroups = helperEnvGroups.map((group) => ({
    ...group,
    variables: group.variables.map((variable) => ({
      ...variable,
      configured: isEnvConfigured(variable.name),
      status: isEnvConfigured(variable.name) || variable.defaultValue ? "ready" as const : variable.required ? "missing_required" as const : "not_connected" as const,
    })),
  }));
  const missingRequiredEnv = envGroups
    .flatMap((group) => group.variables)
    .filter((variable) => variable.required && !variable.configured)
    .map((variable) => variable.name);
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      externalServices: services.length,
      readyServices: services.filter((service) => service.status === "ready").length,
      exposedEndpoints: helperEndpoints.length,
      missingRequiredEnv,
    },
    services,
    endpoints: helperEndpoints,
    envGroups,
    resilience: helperResilienceRules,
  };
};

export const registerHelperStatusRoutes = (app: Express) => {
  app.get("/api/bff/system/helper-status", requireSession, requireRole("system"), (_req, res) => {
    return res.json(buildHelperServiceStatus());
  });
};
