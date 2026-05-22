import { Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { SupervisorModuleShell } from "@/modules/supervisor/module-shell";
import { ErrorState } from "@/design-system/components";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { useAuthMe, useSwitchRole } from "@/shared/auth/session";
import { roleHomePath, type AuthMeDto, type WorkbenchRole } from "@shared/auth/me";
import { usePortalAuth } from "@/hooks/use-bound-facility";
import { getFacilityConfig } from "@/config/facility-configs";
import { apiPost } from "@/shared/api/client";
import { getCorrelationId } from "@/shared/telemetry/correlation";
import { getRedirectForLegacyPath } from "@shared/navigation/workbench-routes";

const AdminLaneRentals = lazy(() => import("@/pages/admin/lane-rentals"));
const AdminParkingDashboard = lazy(() => import("@/pages/admin/parking/dashboard"));
const AdminParkingVehicles = lazy(() => import("@/pages/admin/parking/vehicles"));
const AdminParkingPlans = lazy(() => import("@/pages/admin/parking/plans"));
const AdminParkingContracts = lazy(() => import("@/pages/admin/parking/contracts"));
const AdminParkingPayments = lazy(() => import("@/pages/admin/parking/payments"));
const ParkingSignPage = lazy(() => import("@/pages/parking/sign"));
const CourtsCalendarPage = lazy(() => import("@/pages/courts/calendar"));
const CourtsWeekPage = lazy(() => import("@/pages/courts/week"));
const CourtsMonthPage = lazy(() => import("@/pages/courts/month"));
const CourtsSearchPage = lazy(() => import("@/pages/courts/search"));
const CourtsAdminPage = lazy(() => import("@/pages/courts/admin"));
const NotFound = lazy(() => import("@/pages/not-found"));
const EmployeeCollabCoursesFrame = lazy(() => import("@/pages/collab-courses/page").then((module) => ({ default: module.EmployeeCollabCoursesFrame })));
const SupervisorCollabCoursesFrame = lazy(() => import("@/pages/collab-courses/page").then((module) => ({ default: module.SupervisorCollabCoursesFrame })));
const PortalLogin = lazy(() => import("@/pages/portal/portal-login"));
const PortalHome = lazy(() => import("@/pages/portal/portal-home"));
const PortalSetup = lazy(() => import("@/pages/portal/portal-setup"));
const PortalAnnouncements = lazy(() => import("@/pages/portal/portal-announcements"));
const PortalHandover = lazy(() => import("@/pages/portal/portal-handover"));
const PortalCampaigns = lazy(() => import("@/pages/portal/portal-campaigns"));
const PortalShift = lazy(() => import("@/pages/portal/portal-shift"));
const PortalAnnouncementDetail = lazy(() => import("@/pages/portal/portal-announcement-detail"));
const PortalManage = lazy(() => import("@/pages/portal/portal-manage"));
const PortalAnalytics = lazy(() => import("@/pages/portal/portal-analytics"));
const PortalReview = lazy(() => import("@/pages/portal/portal-review"));
const PortalWorkLog = lazy(() => import("@/pages/portal/portal-work-log"));
const EmployeeHomePage = lazy(() => import("@/modules/employee/home/employee-home-page"));
const EmployeeActivityPeriodsPage = lazy(() => import("@/modules/employee/activity-periods/page"));
const EmployeeAnnouncementsPage = lazy(() => import("@/modules/employee/announcements/page"));
const EmployeeDocumentsPage = lazy(() => import("@/modules/employee/documents/page"));
const EmployeeHandoverPage = lazy(() => import("@/modules/employee/handover/page"));
const LifeguardHandoverPage = lazy(() => import("@/modules/employee/handover/page").then((module) => ({ default: module.LifeguardHandoverPage })));
const EmployeeMorePage = lazy(() => import("@/modules/employee/more/page"));
const EmployeeQnaPage = lazy(() => import("@/modules/employee/qna/page"));
const EmployeeShiftPage = lazy(() => import("@/modules/employee/shift/page"));
const EmployeeSettingsPage = lazy(() => import("@/modules/employee/settings/page"));
const EmployeeTrainingPage = lazy(() => import("@/modules/employee/training/page"));
const LifeguardHomePage = lazy(() => import("@/modules/lifeguard/home/page"));
const EmployeeLostAndFoundPage = lazy(() => import("@/modules/lifeguard/operation-detail-page").then((module) => ({ default: module.EmployeeLostAndFoundPage })));
const LifeguardOperationDetailPage = lazy(() => import("@/modules/lifeguard/operation-detail-page").then((module) => ({ default: module.LifeguardOperationDetailPage })));
const SupervisorDashboardPage = lazy(() => import("@/modules/supervisor/dashboard-page"));
const SupervisorAnnouncementGroupsPage = lazy(() => import("@/modules/supervisor/announcement-groups/page"));
const SupervisorGroupBroadcastsPage = lazy(() => import("@/modules/supervisor/group-broadcasts/page"));
const SupervisorAnnouncementsPage = lazy(() => import("@/modules/supervisor/announcements/page"));
const SupervisorPeoplePage = lazy(() => import("@/modules/supervisor/people/page"));
const SupervisorHandoverPage = lazy(() => import("@/modules/supervisor/handover/page"));
const SupervisorQnaReviewPage = lazy(() => import("@/modules/supervisor/qna-review/page"));
const SupervisorTrainingPage = lazy(() => import("@/modules/supervisor/training/page"));
const SupervisorReportsPage = lazy(() => import("@/modules/supervisor/reports/page"));
const SystemDashboardPage = lazy(() => import("@/modules/system/dashboard-page"));
const SystemInsightsPage = lazy(() => import("@/modules/system/insights/page"));
const SystemOperationsPage = lazy(() => import("@/modules/system/operations/page"));
const SystemCmsMonitoringPage = lazy(() => import("@/modules/system/cms-monitoring/page"));
const SystemProjectOverviewPage = lazy(() => import("@/modules/system/project-overview/page"));
const SystemProjectMonitoringPage = lazy(() => import("@/modules/system/project-monitoring/page"));
const SystemControlCenterPage = lazy(() => import("@/modules/system/control-center/page"));
const SystemGovernancePage = lazy(() => import("@/modules/system/governance/page"));
const SystemAuditPage = lazy(() => import("@/modules/system/audit/page"));
const SystemApiCatalogPage = lazy(() => import("@/modules/system/api-catalog/page"));
const SystemApiMonitoringPage = lazy(() => import("@/modules/system/api-monitoring/page"));
const SystemTrainingViewsPage = lazy(() => import("@/modules/system/training-views/page"));
const SystemWatchdogPage = lazy(() => import("@/modules/system/watchdog/page"));
const SystemFunctionRelationsPage = lazy(() => import("@/modules/system/function-relations/page"));
const WorkbenchLoginPage = lazy(() => import("@/modules/workbench/login-page"));
const DesignSystemShowcase = lazy(() => import("@/design-system/__demo__/showcase"));

class RouteErrorBoundary extends Component<
  { children: ReactNode; scope: "workbench" | "portal" },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.scope}:route-error]`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center bg-surface-base p-6">
        <ErrorState
          title={this.props.scope === "portal" ? "員工入口暫時無法顯示" : "工作台暫時無法顯示"}
          description={this.state.error.message || "畫面載入時發生錯誤，請重新整理後再試。"}
          action={
            <button
              type="button"
              className="rounded-ds-sm bg-surface-base px-3 py-2 text-label-sm font-bold text-text-strong ring-1 ring-border-subtle"
              onClick={() => window.location.reload()}
            >
              重新整理
            </button>
          }
        />
      </div>
    );
  }
}

function RouteSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center bg-surface-base">
          <DreamLoader label="頁面載入中" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function DevRouteThrow({ scope }: { scope: "workbench" | "portal" }) {
  if (!import.meta.env.DEV) return null;
  if (new URLSearchParams(window.location.search).get("throwBoundary") !== scope) return null;
  throw new Error(`${scope} boundary verification`);
}

function PortalAuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = usePortalAuth();
  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-stitch-surface">
        <DreamLoader label="員工登入狀態載入中" />
      </div>
    );
  }
  if (!isLoggedIn) {
    return <Redirect to="/portal/login" />;
  }
  return <>{children}</>;
}

function GuardedPortalPage({ children }: { children: React.ReactNode }) {
  return <PortalAuthGuard>{children}</PortalAuthGuard>;
}

function PortalIndexPage() {
  const { isLoggedIn, isLoading } = usePortalAuth();
  const { data: session } = useAuthMe();
  const facilityKey = session?.activeFacility ?? null;
  const validFacility = facilityKey ? getFacilityConfig(facilityKey) : null;

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-stitch-surface">
        <DreamLoader label="員工入口載入中" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Redirect to="/portal/login" />;
  }

  if (validFacility && facilityKey) {
    return <Redirect to={`/portal/${facilityKey}`} />;
  }

  return <PortalSetup />;
}

function PortalRouter() {
  return (
    <RouteSuspense>
      <Switch>
        <Route path="/portal/login" component={PortalLogin} />
        <Route path="/portal/:facilityKey/announcements/:id">
          {(params) => (
            <GuardedPortalPage>
              <PortalAnnouncementDetail facilityKey={params.facilityKey} announcementId={params.id} />
            </GuardedPortalPage>
          )}
        </Route>
      <Route path="/portal/:facilityKey/announcements">
        {(params) => (
          <GuardedPortalPage>
            <PortalAnnouncements facilityKey={params.facilityKey} />
          </GuardedPortalPage>
        )}
      </Route>
      <Route path="/portal/:facilityKey/handover">
        {(params) => (
          <GuardedPortalPage>
            <PortalHandover facilityKey={params.facilityKey} />
          </GuardedPortalPage>
        )}
      </Route>
      <Route path="/portal/:facilityKey/work-log">
        {(params) => (
          <GuardedPortalPage>
            <PortalWorkLog facilityKey={params.facilityKey} />
          </GuardedPortalPage>
        )}
      </Route>
      <Route path="/portal/:facilityKey/campaigns">
        {(params) => (
          <GuardedPortalPage>
            <PortalCampaigns facilityKey={params.facilityKey} />
          </GuardedPortalPage>
        )}
      </Route>
      <Route path="/portal/:facilityKey/shift">
        {(params) => (
          <GuardedPortalPage>
            <PortalShift facilityKey={params.facilityKey} />
          </GuardedPortalPage>
        )}
      </Route>
      <Route path="/portal/:facilityKey/manage">
        {(params) => (
          <GuardedPortalPage>
            <PortalManage facilityKey={params.facilityKey} />
          </GuardedPortalPage>
        )}
      </Route>
      <Route path="/portal/:facilityKey/review">
        {(params) => (
          <GuardedPortalPage>
            <PortalReview facilityKey={params.facilityKey} />
          </GuardedPortalPage>
        )}
      </Route>
      <Route path="/portal/:facilityKey/analytics">
        {(params) => (
          <GuardedPortalPage>
            <PortalAnalytics facilityKey={params.facilityKey} />
          </GuardedPortalPage>
        )}
      </Route>
      <Route path="/portal/:facilityKey">
        {(params) => (
          <GuardedPortalPage>
            <PortalHome facilityKey={params.facilityKey} />
          </GuardedPortalPage>
        )}
      </Route>
        <Route path="/portal" component={PortalIndexPage} />
      </Switch>
    </RouteSuspense>
  );
}

function WorkbenchRouter() {
  return (
    <RouteSuspense>
      <Switch>
      <Route path="/">
        <Redirect to="/system/project-overview" />
      </Route>
      <Route path="/SYSTEM">
        <Redirect to="/system/project-overview" />
      </Route>
      <Route path="/SUPERVISOR" component={SupervisorDashboardPage} />
      <Route path="/EMPLOYEE" component={EmployeeHomePage} />
      <Route path="/LIFEGUARD" component={LifeguardHomePage} />
      <Route path="/supervisor/home" component={SupervisorDashboardPage} />
      <Route path="/supervisor/parking/vehicles" component={AdminParkingVehicles} />
      <Route path="/supervisor/parking/plans" component={AdminParkingPlans} />
      <Route path="/supervisor/parking/contracts" component={AdminParkingContracts} />
      <Route path="/supervisor/parking/payments" component={AdminParkingPayments} />
      <Route path="/supervisor/parking/event-days">
        <Redirect to="/supervisor/parking" />
      </Route>
      <Route path="/supervisor/parking" component={AdminParkingDashboard} />
      <Route path="/supervisor/lane-rentals" component={AdminLaneRentals} />
      <Route path="/supervisor/courts/:school/week">
        <SupervisorCourtsFrame>
          <CourtsWeekPage />
        </SupervisorCourtsFrame>
      </Route>
      <Route path="/supervisor/courts/:school/month">
        <SupervisorCourtsFrame>
          <CourtsMonthPage />
        </SupervisorCourtsFrame>
      </Route>
      <Route path="/supervisor/courts/:school/search">
        <SupervisorCourtsFrame>
          <CourtsSearchPage />
        </SupervisorCourtsFrame>
      </Route>
      <Route path="/supervisor/courts/:school/admin">
        <SupervisorCourtsFrame>
          <CourtsAdminPage />
        </SupervisorCourtsFrame>
      </Route>
      <Route path="/supervisor/courts/:school">
        <SupervisorCourtsFrame>
          <CourtsCalendarPage />
        </SupervisorCourtsFrame>
      </Route>
      <Route path="/supervisor/courts">
        <Redirect to="/supervisor/courts/xinbei" />
      </Route>
      <Route path="/courts/:school/week">
        {(params) => <Redirect to={`/supervisor/courts/${params.school}/week`} />}
      </Route>
      <Route path="/courts/:school/month">
        {(params) => <Redirect to={`/supervisor/courts/${params.school}/month`} />}
      </Route>
      <Route path="/courts/:school/search">
        {(params) => <Redirect to={`/supervisor/courts/${params.school}/search`} />}
      </Route>
      <Route path="/courts/:school/admin">
        {(params) => <Redirect to={`/supervisor/courts/${params.school}/admin`} />}
      </Route>
      <Route path="/courts/:school">
        {(params) => <Redirect to={`/supervisor/courts/${params.school}`} />}
      </Route>
      <Route path="/courts">
        <Redirect to="/supervisor/courts/xinbei" />
      </Route>
      <Route path="/supervisor/announcements">
        <SupervisorAnnouncementsPage />
      </Route>
      <Route path="/supervisor/announcement-groups">
        <SupervisorAnnouncementGroupsPage />
      </Route>
      <Route path="/supervisor/group-broadcasts">
        <SupervisorGroupBroadcastsPage />
      </Route>
      <Route path="/supervisor/people">
        <SupervisorPeoplePage />
      </Route>
      <Route path="/supervisor/facilities/:facilityKey">
        {(params) => <SupervisorPeoplePage facilityKey={params.facilityKey} />}
      </Route>
      <Route path="/supervisor/facilities">
        <SupervisorPeoplePage />
      </Route>
      <Route path="/supervisor/handover">
        <SupervisorHandoverPage />
      </Route>
      <Route path="/supervisor/settings">
        <Redirect to="/supervisor" />
      </Route>
      <Route path="/supervisor/training">
        <SupervisorTrainingPage />
      </Route>
      <Route path="/supervisor/qna-review">
        <SupervisorQnaReviewPage />
      </Route>
      <Route path="/supervisor/reports">
        <SupervisorReportsPage />
      </Route>
      <Route path="/supervisor" component={SupervisorDashboardPage} />
      <Route path="/lifeguard/handover">
        <LifeguardHandoverPage />
      </Route>
      <Route path="/lifeguard/water-quality">
        <LifeguardOperationDetailPage moduleId="water-quality" />
      </Route>
      <Route path="/lifeguard/coach-dive">
        <LifeguardOperationDetailPage moduleId="coach-dive" />
      </Route>
      <Route path="/lifeguard/cleanup">
        <LifeguardOperationDetailPage moduleId="cleanup" />
      </Route>
      <Route path="/lifeguard/lane-issues">
        <LifeguardOperationDetailPage moduleId="lane-issues" />
      </Route>
      <Route path="/lifeguard/lane-rentals">
        <LifeguardOperationDetailPage moduleId="lane-rentals" />
      </Route>
      <Route path="/lifeguard/water-quality-photo">
        <Redirect to="/lifeguard/water-quality" />
      </Route>
      <Route path="/lifeguard/coach-water-photo">
        <Redirect to="/lifeguard/coach-dive" />
      </Route>
      <Route path="/lifeguard/closing-cleanup-photo">
        <Redirect to="/lifeguard/cleanup" />
      </Route>
      <Route path="/lifeguard/lane-notes">
        <Redirect to="/lifeguard/lane-issues" />
      </Route>
      <Route path="/lifeguard/lost-and-found">
        <LifeguardOperationDetailPage moduleId="lost-and-found" />
      </Route>
      <Route path="/employee/lost-and-found">
        <EmployeeLostAndFoundPage />
      </Route>
      <Route path="/lifeguard/home" component={LifeguardHomePage} />
      <Route path="/lifeguard" component={LifeguardHomePage} />
      <Route path="/system/watchdog" component={SystemWatchdogPage} />
      <Route path="/system/cms-monitoring" component={SystemCmsMonitoringPage} />
      <Route path="/system/operations" component={SystemOperationsPage} />
      <Route path="/system/insights" component={SystemInsightsPage} />
      <Route path="/system/governance" component={SystemGovernancePage} />
      <Route path="/system/linebot-management">
        <Redirect to="/system/monitoring/400line" />
      </Route>
      <Route path="/system/helper-status">
        <Redirect to="/system/monitoring/400line" />
      </Route>
      <Route path="/system/lineXBS-status">
        <Redirect to="/system/monitoring/400line" />
      </Route>
      <Route path="/system/monitoring">
        <SystemApiMonitoringPage projectKey="all" />
      </Route>
      <Route path="/system/monitoring/400cms">
        <SystemApiMonitoringPage projectKey="400cms" />
      </Route>
      <Route path="/system/monitoring/400line">
        <SystemApiMonitoringPage projectKey="400line" />
      </Route>
      <Route path="/system/monitoring/schedule">
        <SystemApiMonitoringPage projectKey="schedule" />
      </Route>
      <Route path="/system/monitoring/collab-course">
        <SystemApiMonitoringPage projectKey="collab-course" />
      </Route>
      <Route path="/system/api-catalog" component={SystemApiCatalogPage} />
      <Route path="/system/line-whitelist">
        <Redirect to="/system/monitoring/400line?tab=whitelist" />
      </Route>
      <Route path="/system/400cms/status">
        <SystemProjectMonitoringPage projectKey="400cms" mode="status" />
      </Route>
      <Route path="/system/schedule/status">
        <SystemProjectMonitoringPage projectKey="schedule" mode="status" />
      </Route>
      <Route path="/system/schedule">
        <SystemProjectMonitoringPage projectKey="schedule" mode="control" />
      </Route>
      <Route path="/system/collab-course/status">
        <SystemProjectMonitoringPage projectKey="collab-course" mode="status" />
      </Route>
      <Route path="/system/collab-course">
        <SystemProjectMonitoringPage projectKey="collab-course" mode="control" />
      </Route>
      <Route path="/system/health" component={SystemDashboardPage} />
      <Route path="/system/function-relations">
        <SystemFunctionRelationsPage />
      </Route>
      <Route path="/system/alerts">
        <Redirect to="/system/watchdog?tab=alerts" />
      </Route>
      <Route path="/system/integrations">
        <Redirect to="/system/watchdog?tab=integrations" />
      </Route>
      <Route path="/system/audit">
        <SystemAuditPage />
      </Route>
      <Route path="/system/training-views">
        <SystemTrainingViewsPage />
      </Route>
      <Route path="/system/control-center/cms-monitoring">
        <Redirect to="/system/cms-monitoring" />
      </Route>
      <Route path="/system/control-center" component={SystemControlCenterPage} />
      <Route path="/system/project-overview" component={SystemProjectOverviewPage} />
      <Route path="/system/overview">
        <Redirect to="/system/project-overview" />
      </Route>
      <Route path="/system">
        <Redirect to="/system/project-overview" />
      </Route>
      <Route path="/employee/courts/:school/week">
        <EmployeeCourtsFrame>
          <CourtsWeekPage />
        </EmployeeCourtsFrame>
      </Route>
      <Route path="/employee/courts/:school/month">
        <EmployeeCourtsFrame>
          <CourtsMonthPage />
        </EmployeeCourtsFrame>
      </Route>
      <Route path="/employee/courts/:school/search">
        <EmployeeCourtsFrame>
          <CourtsSearchPage />
        </EmployeeCourtsFrame>
      </Route>
      <Route path="/employee/courts/:school/admin">
        <EmployeeCourtsFrame>
          <CourtsAdminPage />
        </EmployeeCourtsFrame>
      </Route>
      <Route path="/employee/courts/:school">
        <EmployeeCourtsFrame>
          <CourtsCalendarPage />
        </EmployeeCourtsFrame>
      </Route>
      <Route path="/employee/courts">
        <Redirect to="/employee/courts/xinbei" />
      </Route>
      <Route path="/employee/announcements">
        <EmployeeAnnouncementsPage />
      </Route>
      <Route path="/employee/handover">
        <EmployeeHandoverPage />
      </Route>
      <Route path="/employee/shift">
        <EmployeeShiftPage />
      </Route>
      <Route path="/employee/activity-periods/:id">
        {(params) => <EmployeeActivityPeriodsPage activityId={params.id} />}
      </Route>
      <Route path="/employee/activity-periods">
        <EmployeeActivityPeriodsPage />
      </Route>
      <Route path="/employee/registration-courses">
        <EmployeeMorePage />
      </Route>
      <Route path="/employee/documents">
        <EmployeeDocumentsPage />
      </Route>
      <Route path="/employee/training">
        <EmployeeTrainingPage />
      </Route>
      <Route path="/employee/qna">
        <EmployeeQnaPage />
      </Route>
      <Route path="/employee/settings">
        <EmployeeSettingsPage />
      </Route>
      <Route path="/employee/more">
        <EmployeeMorePage />
      </Route>
      <Route path="/employee/collab-courses">
        <EmployeeCollabCoursesFrame />
      </Route>
      <Route path="/supervisor/collab-courses">
        <SupervisorCollabCoursesFrame />
      </Route>
      <Route path="/employee/home" component={EmployeeHomePage} />
      <Route path="/employee" component={EmployeeHomePage} />
        <Route component={NotFound} />
      </Switch>
    </RouteSuspense>
  );
}

function SupervisorCourtsFrame({ children }: { children: React.ReactNode }) {
  return (
    <SupervisorModuleShell
      moduleId="courts"
      title="場地預約"
      eyebrow="COURT RESERVATIONS"
      description="新北高中與三重商工場地排程、搜尋、匯入與 Google Calendar 同步。"
      layoutMode="schedule"
    >
      {children}
    </SupervisorModuleShell>
  );
}

function EmployeeCourtsFrame({ children }: { children: React.ReactNode }) {
  return (
    <EmployeeShell
      title="場租查看"
      subtitle="查看新北高中與三重商工場租排程，並依場館切換單日、週、月、搜尋與管理檢視。"
    >
      {children}
    </EmployeeShell>
  );
}

const routeRoleFromLocation = (location: string): WorkbenchRole | null => {
  const normalized = location.toLowerCase();
  if (normalized === "/employee" || normalized.startsWith("/employee/") || normalized === "/employee/home" || normalized === "/employee".toLowerCase()) return "employee";
  if (normalized === "/lifeguard" || normalized.startsWith("/lifeguard/")) return "lifeguard";
  if (normalized === "/supervisor" || normalized.startsWith("/supervisor/")) return "supervisor";
  if (normalized === "/system" || normalized.startsWith("/system/")) return "system";
  if (normalized === "/employee" || normalized === "/supervisor" || normalized === "/system") return normalized.slice(1) as WorkbenchRole;
  return null;
};

const canAccessWorkbenchRole = (session: AuthMeDto, role: WorkbenchRole) => {
  if (role === "system") return session.grantedRoles.includes("system");
  if (role === "supervisor") return session.grantedRoles.includes("supervisor") || session.grantedRoles.includes("system");
  if (role === "lifeguard") return session.grantedRoles.includes("lifeguard") || session.grantedRoles.includes("system");
  return session.grantedRoles.includes("employee") || session.grantedRoles.includes("supervisor") || session.grantedRoles.includes("system");
};

const firstAllowedWorkbenchPath = (session: AuthMeDto) => {
  if (session.grantedRoles.includes("system")) return roleHomePath.system;
  if (session.grantedRoles.includes("supervisor")) return roleHomePath.supervisor;
  if (session.grantedRoles.includes("lifeguard")) return roleHomePath.lifeguard;
  return roleHomePath.employee;
};

function WorkbenchAuthGate() {
  const { data: session, isLoading, isError } = useAuthMe();
  const [location] = useLocation();
  const switchRole = useSwitchRole();
  const routeRole = session ? routeRoleFromLocation(location) : null;

  useEffect(() => {
    if (!session || !routeRole) return;
    if (!canAccessWorkbenchRole(session, routeRole)) return;
    if (session.activeRole === routeRole) return;
    if (!session.grantedRoles.includes(routeRole)) return;
    if (switchRole.isPending) return;
    switchRole.mutate(routeRole);
  }, [location, routeRole, session, switchRole]);

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f4f7fb]">
        <DreamLoader label="Dreams 登入狀態確認中" />
      </div>
    );
  }

  if (isError || !session) {
    return <Redirect to="/login" />;
  }

  if (routeRole && !canAccessWorkbenchRole(session, routeRole)) {
    return <Redirect to={firstAllowedWorkbenchPath(session)} />;
  }

  return (
    <RouteErrorBoundary scope="workbench">
      <DevRouteThrow scope="workbench" />
      <WorkbenchRouter />
    </RouteErrorBoundary>
  );
}

function WidgetTelemetryCapture() {
  const [location] = useLocation();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const clickable = target?.closest<HTMLElement>("[data-widget-id], a, button");
      if (!clickable) return;
      const componentId = clickable.dataset.widgetId || clickable.getAttribute("href") || clickable.getAttribute("aria-label") || clickable.textContent?.trim().slice(0, 40);
      if (!componentId) return;
      apiPost("/api/telemetry/ui-events", {
        eventType: "CARD_CLICK",
        correlationId: getCorrelationId(),
        page: location,
        componentId,
        actionType: "click",
        payload: { tagName: clickable.tagName.toLowerCase() },
        occurredAt: new Date().toISOString(),
      }).catch(() => undefined);
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [location]);

  return null;
}

function DebugDreamLoaderOverlay() {
  const [location] = useLocation();
  const [visible, setVisible] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD) return;
    const params = new URLSearchParams(window.location.search);
    const queryValue = params.get("debugLoader");
    if (queryValue === "off") {
      window.sessionStorage.removeItem("dreams.debugLoader");
      setVisible(false);
      setPinned(false);
      return;
    }
    if (queryValue) {
      window.sessionStorage.setItem("dreams.debugLoader", queryValue);
    }
    const value = queryValue || window.sessionStorage.getItem("dreams.debugLoader");
    if (!value) {
      setVisible(false);
      setPinned(false);
      return;
    }

    const isPinned = value === "always";
    const duration = Math.min(Math.max(Number(params.get("debugLoaderMs") ?? 1600), 300), 10000);
    setVisible(true);
    setPinned(isPinned);
    if (isPinned) return;

    const timer = window.setTimeout(() => {
      setVisible(false);
      window.sessionStorage.removeItem("dreams.debugLoader");
    }, duration);
    return () => window.clearTimeout(timer);
  }, [location]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] grid place-items-center bg-[#f3f6fb]/90 backdrop-blur-sm">
      <div className="rounded-[18px] border border-white/70 bg-white/80 px-8 py-7 shadow-[0_28px_80px_-36px_rgba(13,42,80,0.85)]">
        <DreamLoader compact label={pinned ? "DreamLoader 預覽模式" : "Dreams 緩衝動畫預覽"} />
        <p className="mt-2 text-center text-[11px] font-bold text-[#8b9aae]">
          DEV only · {pinned ? "debugLoader=always" : "debugLoader=1"}
        </p>
      </div>
    </div>
  );
}

function App() {
  const [location] = useLocation();
  const normalizedLocation = location.toLowerCase();
  const legacyRedirect = getRedirectForLegacyPath(location);
  const isPortal = location.startsWith("/portal");
  const isLogin = normalizedLocation === "/login";
  const isDesignSystemShowcase = import.meta.env.DEV && normalizedLocation === "/design-system/showcase";
  const isParkingSign = normalizedLocation.startsWith("/parking/sign/");
  const isWorkbench =
    normalizedLocation === "/" ||
    normalizedLocation === "/employee" ||
    normalizedLocation.startsWith("/employee/") ||
    normalizedLocation === "/lifeguard" ||
    normalizedLocation.startsWith("/lifeguard/") ||
    normalizedLocation === "/supervisor" ||
    normalizedLocation.startsWith("/supervisor/") ||
    normalizedLocation === "/system" ||
    normalizedLocation.startsWith("/system/");

  // Public customer-facing parking-sign page: no admin shell, no auth, mobile-first.
  if (isParkingSign) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Switch>
            <Route path="/parking/sign/:token">
              <RouteSuspense>
                <ParkingSignPage />
              </RouteSuspense>
            </Route>
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (legacyRedirect) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Redirect to={legacyRedirect} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (isDesignSystemShowcase) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouteSuspense>
            <DesignSystemShowcase />
          </RouteSuspense>
          <DebugDreamLoaderOverlay />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  if (isPortal || isWorkbench || isLogin) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {isWorkbench ? <WidgetTelemetryCapture /> : null}
          {isLogin ? <LoginRedirector /> : isWorkbench ? <WorkbenchAuthGate /> : (
            <RouteErrorBoundary scope="portal">
              <DevRouteThrow scope="portal" />
              <PortalRouter />
            </RouteErrorBoundary>
          )}
          <DebugDreamLoaderOverlay />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
        <RouteSuspense>
          <NotFound />
        </RouteSuspense>
        <DebugDreamLoaderOverlay />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function LoginRedirector() {
  return (
    <RouteSuspense>
      <WorkbenchLoginPage />
    </RouteSuspense>
  );
}

export default App;
