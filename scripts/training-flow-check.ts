type AuthMeDto = {
  userId: string;
  displayName: string;
  activeRole: "employee" | "supervisor" | "system";
  activeFacility: string;
  grantedFacilities: string[];
};

type EmployeeResourceDto = {
  id: number;
  facilityKey: string;
  category: string;
  title: string;
  url?: string | null;
};

type EmployeeHomeDto = {
  training?: {
    data?: Array<{
      resourceId?: number;
      id: string;
      title: string;
    }>;
  };
};

type TrainingViewReportDto = {
  totalViews: number;
  byResource: Array<{
    resourceId: string;
    title: string;
    count: number;
  }>;
  latestViews: Array<{
    resourceId?: string;
    title?: string;
    userId?: string;
    correlationId?: string;
  }>;
};

const baseUrl = (process.env.TRAINING_FLOW_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const employeeCookie = process.env.TRAINING_FLOW_EMPLOYEE_COOKIE || process.env.TRAINING_FLOW_COOKIE;
const systemCookie = process.env.TRAINING_FLOW_SYSTEM_COOKIE || process.env.TRAINING_FLOW_COOKIE;
const requestedFacilityKey = process.env.TRAINING_FLOW_FACILITY;
const keepResource = process.env.TRAINING_FLOW_KEEP_RESOURCE === "1";
const skipSystemReport = process.env.TRAINING_FLOW_SKIP_SYSTEM_REPORT === "1";
const runId = `training-flow-${Date.now()}`;
const correlationId = `training-flow-${Date.now()}-${Math.random().toString(16).slice(2)}`;

if (!employeeCookie) {
  throw new Error("TRAINING_FLOW_COOKIE or TRAINING_FLOW_EMPLOYEE_COOKIE is required. Use a logged-in employee/supervisor cookie.");
}
if (!systemCookie && !skipSystemReport) {
  throw new Error("TRAINING_FLOW_SYSTEM_COOKIE or TRAINING_FLOW_COOKIE is required unless TRAINING_FLOW_SKIP_SYSTEM_REPORT=1.");
}

const headersFor = (cookie: string, extra?: Record<string, string>) => ({
  Accept: "application/json",
  Cookie: cookie,
  "X-Correlation-Id": correlationId,
  ...extra,
});

const readBody = async (response: Response) => {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const requestJson = async <T>(path: string, init: RequestInit & { cookie: string }): Promise<T> => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: headersFor(init.cookie, init.headers as Record<string, string> | undefined),
  });
  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${path} failed: status=${response.status} body=${JSON.stringify(body)}`);
  }
  return body as T;
};

const getJson = <T>(path: string, cookie: string) => requestJson<T>(path, { method: "GET", cookie });

const postJson = <T>(path: string, cookie: string, body: unknown) =>
  requestJson<T>(path, {
    method: "POST",
    cookie,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const deleteJson = <T>(path: string, cookie: string) => requestJson<T>(path, { method: "DELETE", cookie });

const expect = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

let created: EmployeeResourceDto | undefined;

try {
  const me = await getJson<AuthMeDto>("/api/auth/me", employeeCookie);
  const facilityKey = requestedFacilityKey || me.activeFacility;
  expect(Boolean(facilityKey), "No active facility available for training flow check.");
  expect(me.grantedFacilities.includes(facilityKey), `Facility ${facilityKey} is not granted to ${me.userId}.`);

  console.log("Training flow deployment check");
  console.log("==============================");
  console.log(`baseUrl: ${baseUrl}`);
  console.log(`actor: ${me.userId} (${me.activeRole})`);
  console.log(`facilityKey: ${facilityKey}`);

  created = await postJson<EmployeeResourceDto>("/api/portal/employee-resources", employeeCookie, {
    facilityKey,
    category: "training",
    subCategory: "流程",
    title: `[smoke] 教材閉環驗收 ${runId}`,
    content: "部署驗收用教材，腳本完成後會自動刪除。",
    url: "https://example.com/dreams-cms-training-smoke",
    sortOrder: 9999,
  });
  expect(created.category === "training", `Created resource category mismatch: ${created.category}`);
  console.log(`createdResourceId: ${created.id}`);

  const home = await getJson<EmployeeHomeDto>(`/api/bff/employee/home?facilityKey=${encodeURIComponent(facilityKey)}`, employeeCookie);
  const homeHasResource = (home.training?.data ?? []).some((item) => item.resourceId === created?.id || item.title === created?.title);
  expect(homeHasResource, "Employee home BFF did not include the newly created training resource.");
  console.log("employeeHomeTraining: ok");

  await postJson<{ accepted: boolean }>("/api/telemetry/ui-events", employeeCookie, {
    eventType: "TRAINING_VIEW",
    actionType: "TRAINING_VIEW",
    page: "/employee/training",
    componentId: "employee-training",
    correlationId,
    payload: {
      moduleId: "employee-training",
      resourceId: String(created.id),
      title: created.title,
      mediaType: "link",
      url: created.url,
    },
    occurredAt: new Date().toISOString(),
  });
  console.log("trainingViewEvent: accepted");

  if (!skipSystemReport) {
    const report = await getJson<TrainingViewReportDto>("/api/telemetry/training-views", systemCookie!);
    const resourceId = String(created.id);
    const foundInResourceRank = report.byResource.some((item) => item.resourceId === resourceId);
    const foundInLatestViews = report.latestViews.some((item) => item.resourceId === resourceId || item.correlationId === correlationId);
    expect(foundInResourceRank || foundInLatestViews, "System training view report did not include the TRAINING_VIEW event.");
    console.log(`systemTrainingViews: ok totalViews=${report.totalViews}`);
  } else {
    console.log("systemTrainingViews: skipped by TRAINING_FLOW_SKIP_SYSTEM_REPORT=1");
  }
} finally {
  if (created && !keepResource) {
    try {
      await deleteJson<{ ok: boolean }>(`/api/portal/employee-resources/${created.id}`, employeeCookie);
      console.log(`cleanup: deletedResourceId=${created.id}`);
    } catch (error) {
      console.error(`cleanup_failed: resourceId=${created.id}`);
      throw error;
    }
  } else if (created) {
    console.log(`cleanup: keptResourceId=${created.id}`);
  }
}

console.log("training flow check passed");
