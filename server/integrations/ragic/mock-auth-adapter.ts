import type { RagicAuthAdapter } from "./auth-adapter";
import { sourceOk, sourceUnavailable } from "../../shared/integrations/source-status";
import { facilityKeysFromRagicDepartments } from "@shared/domain/facilities";

const mockEmployees = [
  { employeeNumber: "1111", displayName: "全端測試開發", departments: ["新北高中", "三重商工", "松山國小", "三民高中"], title: "系統管理員", phone: "1111" },
  { employeeNumber: "A001", displayName: "新北值班人員", departments: ["新北高中"], title: "櫃台", phone: "0912000001" },
  { employeeNumber: "A002", displayName: "商工值班人員", departments: ["三重商工"], title: "櫃台", phone: "0912000002" },
  { employeeNumber: "A003", displayName: "松山值班人員", departments: ["松山國小"], title: "櫃台", phone: "0912000003" },
  { employeeNumber: "A004", displayName: "三民值班人員", departments: ["三民高中"], title: "櫃台", phone: "0912000004" },
];

export const mockRagicAuthAdapter: RagicAuthAdapter = {
  async verifyCredentials(username, password) {
    if (username !== "1111" || password !== "1111") {
      return sourceUnavailable("mock-ragic-auth", "開發測試帳密為 1111 / 1111", "INVALID_CREDENTIALS");
    }

    return sourceOk("mock-ragic-auth", {
      userId: "dev-fullstack-1111",
      displayName: "全端測試開發",
      employeeNumber: "1111",
      title: "系統管理員",
      departments: ["新北高中", "三重商工", "松山國小", "三民高中"],
      isSupervisor: true,
    });
  },

  async listActiveEmployees() {
    return sourceOk("mock-ragic-employees", mockEmployees.map((employee) => ({
      userId: employee.employeeNumber,
      employeeNumber: employee.employeeNumber,
      displayName: employee.displayName,
      phone: employee.phone,
      title: employee.title,
      departments: employee.departments,
      department: employee.departments.join(", "),
      status: "在職",
      isSupervisor: /主管|經理|組長|店長|館長|總監|協理|副理|副總|管理員/.test(employee.title),
      grantedFacilities: facilityKeysFromRagicDepartments(employee.departments),
    })));
  },
};
