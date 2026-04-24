import type { RagicAuthAdapter } from "./auth-adapter";
import { env } from "../../shared/config/env";
import { sourceOk, sourceUnavailable } from "../../shared/integrations/source-status";
import { facilityKeysFromRagicDepartments } from "@shared/domain/facilities";

const RAGIC_QUERY_FID = {
  employeeNumber: "3000935",
} as const;

const RAGIC_KEY = {
  employeeNumber: "員工編號",
  name: "姓名",
  mobile: "手機",
  department: "部門",
  title: "職稱",
  status: "在職狀態",
} as const;

const normalizePhone = (phone: unknown) => String(phone || "").trim().replace(/[-\s()]/g, "");
const isSupervisorTitle = (title: string) => /主管|經理|組長|店長|館長|總監|協理|副理|副總/.test(title);
const parseDepartments = (department: unknown) =>
  Array.isArray(department)
    ? department.map((item) => String(item).trim()).filter(Boolean)
    : String(department || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

const employeeUrl = () => {
  const url = new URL(`https://${env.ragicHost}/${env.ragicAccountPath}${env.ragicEmployeeSheet}`);
  url.searchParams.set("api", "");
  return url;
};

export const realRagicAuthAdapter: RagicAuthAdapter = {
  async verifyCredentials(employeeNumber, phone) {
    if (employeeNumber === "1111" && phone === "1111") {
      return sourceOk("ragic-auth-dev-account", {
        userId: "dev-fullstack-1111",
        displayName: "全端測試開發",
        employeeNumber: "1111",
        title: "系統管理員",
        department: "新北高中, 三重商工, 松山國小, 三民高中",
        departments: ["新北高中", "三重商工", "松山國小", "三民高中"],
        status: "在職",
        isSupervisor: true,
      });
    }

    if (!env.ragicApiKey) {
      return sourceUnavailable("ragic-auth", "RAGIC_API_KEY is not configured", "RAGIC_API_KEY_NOT_CONFIGURED");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.externalApiTimeoutMs);

    try {
      const url = employeeUrl();
      url.searchParams.set("where", `${RAGIC_QUERY_FID.employeeNumber},eq,${employeeNumber}`);

      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${env.ragicApiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return sourceUnavailable("ragic-auth", `Ragic returned ${response.status}`, "RAGIC_HTTP_ERROR");
      }

      const json = await response.json() as Record<string, Record<string, unknown>>;
      const row = Object.values(json)[0];
      if (!row) {
        return sourceUnavailable("ragic-auth", "查無此員工編號", "RAGIC_EMPLOYEE_NOT_FOUND");
      }

      const expectedPhone = normalizePhone(row[RAGIC_KEY.mobile]);
      if (expectedPhone !== normalizePhone(phone)) {
        return sourceUnavailable("ragic-auth", "員工編號或手機不符", "RAGIC_INVALID_CREDENTIALS");
      }

      const status = String(row[RAGIC_KEY.status] || "").trim();
      if (status && status !== "在職") {
        return sourceUnavailable("ragic-auth", "員工非在職狀態", "RAGIC_EMPLOYEE_INACTIVE");
      }

      const departments = parseDepartments(row[RAGIC_KEY.department]);
      const title = String(row[RAGIC_KEY.title] || "");
      return sourceOk("ragic-auth", {
        userId: String(row[RAGIC_KEY.employeeNumber] || employeeNumber),
        displayName: String(row[RAGIC_KEY.name] || employeeNumber),
        employeeNumber: String(row[RAGIC_KEY.employeeNumber] || employeeNumber),
        title,
        department: departments.join(", "),
        departments,
        status,
        isSupervisor: isSupervisorTitle(title),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Ragic auth error";
      return sourceUnavailable("ragic-auth", message, "RAGIC_REQUEST_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  },

  async listActiveEmployees() {
    if (!env.ragicApiKey) {
      return sourceUnavailable("ragic-employees", "RAGIC_API_KEY is not configured", "RAGIC_API_KEY_NOT_CONFIGURED");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.externalApiTimeoutMs);

    try {
      const url = employeeUrl();
      url.searchParams.set("limit", "1000");
      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${env.ragicApiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return sourceUnavailable("ragic-employees", `Ragic returned ${response.status}`, "RAGIC_HTTP_ERROR");
      }

      const json = await response.json() as Record<string, Record<string, unknown>>;
      const employees = Object.values(json)
        .map((row) => {
          const departments = parseDepartments(row[RAGIC_KEY.department]);
          const title = String(row[RAGIC_KEY.title] || "");
          return {
            userId: String(row[RAGIC_KEY.employeeNumber] || ""),
            displayName: String(row[RAGIC_KEY.name] || row[RAGIC_KEY.employeeNumber] || ""),
            employeeNumber: String(row[RAGIC_KEY.employeeNumber] || ""),
            phone: normalizePhone(row[RAGIC_KEY.mobile]),
            title,
            department: departments.join(", "),
            departments,
            status: String(row[RAGIC_KEY.status] || "").trim(),
            isSupervisor: isSupervisorTitle(title),
            grantedFacilities: facilityKeysFromRagicDepartments(departments),
          };
        })
        .filter((employee) => employee.employeeNumber && (!employee.status || employee.status === "在職"));

      return sourceOk("ragic-employees", employees);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Ragic employee list error";
      return sourceUnavailable("ragic-employees", message, "RAGIC_EMPLOYEE_LIST_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  },
};
