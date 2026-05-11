import { useEffect, useState } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AdminWorkLogDailyTemplates from "@/pages/admin/work-logs/daily-templates";
import AdminWorkLogAssignedTasks from "@/pages/admin/work-logs/assigned-tasks";
import AdminWorkLogRecurringTemplates from "@/pages/admin/work-logs/recurring-templates";
import AdminWorkLogWaterSchedules from "@/pages/admin/work-logs/water-schedules";
import AdminWorkLogWaterStandards from "@/pages/admin/work-logs/water-standards";
import AdminWorkLogSubmissions from "@/pages/admin/work-logs/submissions";
import AdminLaneRentals from "@/pages/admin/lane-rentals";
import AdminParkingDashboard from "@/pages/admin/parking/dashboard";
import AdminParkingVehicles from "@/pages/admin/parking/vehicles";
import AdminParkingPlans from "@/pages/admin/parking/plans";
import AdminParkingContracts from "@/pages/admin/parking/contracts";
import AdminParkingPayments from "@/pages/admin/parking/payments";
import ParkingSignPage from "@/pages/parking/sign";
import SystemTopology from "@/pages/system-topology";
import CourtsCalendarPage from "@/pages/courts/calendar";
import CourtsWeekPage from "@/pages/courts/week";
import CourtsMonthPage from "@/pages/courts/month";
import CourtsSearchPage from "@/pages/courts/search";
import CourtsAdminPage from "@/pages/courts/admin";
import NotFound from "@/pages/not-found";
import PortalLogin from "@/pages/portal/portal-login";
import PortalHome from "@/pages/portal/portal-home";
import PortalSetup from "@/pages/portal/portal-setup";
import PortalAnnouncements from "@/pages/portal/portal-announcements";
import PortalHandover from "@/pages/portal/portal-handover";
import PortalCampaigns from "@/pages/portal/portal-campaigns";
import PortalShift from "@/pages/portal/portal-shift";
import PortalAnnouncementDetail from "@/pages/portal/portal-announcement-detail";
import PortalManage from "@/pages/portal/portal-manage";
import PortalAnalytics from "@/pages/portal/portal-analytics";
import PortalReview from "@/pages/portal/portal-review";
import PortalWorkLog from "@/pages/portal/portal-work-log";
import EmployeeHomePage from "@/modules/employee/home/employee-home-page";
import EmployeeActivityPeriodsPage from "@/modules/employee/activity-periods/page";
import EmployeeAnnouncementsPage from "@/modules/employee/announcements/page";
import EmployeeDocumentsPage from "@/modules/employee/documents/page";
import EmployeeHandoverPage from "@/modules/employee/handover/page";
import EmployeeMorePage from "@/modules/employee/more/page";
import EmployeePersonalNotePage from "@/modules/employee/personal-note/page";
import EmployeeQnaPage from "@/modules/employee/qna/page";
import EmployeeShiftPage from "@/modules/employee/shift/page";
import EmployeeSettingsPage from "@/modules/employee/settings/page";
import EmployeeTasksPage from "@/modules/employee/tasks/page";
import EmployeeTrainingPage from "@/modules/employee/training/page";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import LifeguardHomePage from "@/modules/lifeguard/home/page";
import LifeguardLogPage from "@/modules/lifeguard/log/page";
import { LifeguardOperationDetailPage } from "@/modules/lifeguard/operation-detail-page";
import SupervisorDashboardPage from "@/modules/supervisor/dashboard-page";
import SupervisorAnnouncementGroupsPage from "@/modules/supervisor/announcement-groups/page";
import SupervisorAnnouncementsPage from "@/modules/supervisor/announcements/page";
import SupervisorAnomaliesPage from "@/modules/supervisor/anomalies/page";
import SupervisorPeoplePage from "@/modules/supervisor/people/page";
import SupervisorHandoverPage from "@/modules/supervisor/handover/page";
import SupervisorQnaReviewPage from "@/modules/supervisor/qna-review/page";
import SupervisorReportsPage from "@/modules/supervisor/reports/page";
import SupervisorTasksPage from "@/modules/supervisor/tasks/page";
import SupervisorTrainingPage from "@/modules/supervisor/training/page";
import { SupervisorModuleShell } from "@/modules/supervisor/module-shell";
import SystemDashboardPage from "@/modules/system/dashboard-page";
import SystemAlertsPage from "@/modules/system/alerts/page";
import SystemAuditPage from "@/modules/system/audit/page";
import SystemIntegrationsPage from "@/modules/system/integrations/page";
import SystemRawInspectorPage from "@/modules/system/raw-inspector/page";
import SystemTrainingViewsPage from "@/modules/system/training-views/page";
import WorkbenchLoginPage from "@/modules/workbench/login-page";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { useAuthMe, useSwitchRole } from "@/shared/auth/session";
import { roleHomePath, type AuthMeDto, type WorkbenchRole } from "@shared/auth/me";
import { usePortalAuth } from "@/hooks/use-bound-facility";
import { getFacilityConfig } from "@/config/facility-configs";
import { apiPost } from "@/shared/api/client";
import { getCorrelationId } from "@/shared/telemetry/correlation";
import { getRedirectForLegacyPath } from "@shared/navigation/workbench-routes";

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
  );
}

function WorkbenchRouter() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/system" />
      </Route>
      <Route path="/SYSTEM" component={SystemDashboardPage} />
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
      <Route path="/supervisor/counter-log/daily-templates" component={AdminWorkLogDailyTemplates} />
      <Route path="/supervisor/counter-log/assigned-tasks" component={AdminWorkLogAssignedTasks} />
      <Route path="/supervisor/counter-log/recurring-templates" component={AdminWorkLogRecurringTemplates} />
      <Route path="/supervisor/counter-log/submissions" component={AdminWorkLogSubmissions} />
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
      <Route path="/supervisor/tasks">
        <SupervisorTasksPage />
      </Route>
      <Route path="/supervisor/announcements">
        <SupervisorAnnouncementsPage />
      </Route>
      <Route path="/supervisor/announcement-groups">
        <SupervisorAnnouncementGroupsPage />
      </Route>
      <Route path="/supervisor/anomalies">
        <SupervisorAnomaliesPage />
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
      <Route path="/supervisor/reports">
        <SupervisorReportsPage />
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
      <Route path="/supervisor" component={SupervisorDashboardPage} />
      <Route path="/lifeguard/log">
        <LifeguardLogPage />
      </Route>
      <Route path="/lifeguard/water-quality-photo">
        <LifeguardOperationDetailPage moduleId="water-quality-photo" />
      </Route>
      <Route path="/lifeguard/coach-water-photo">
        <LifeguardOperationDetailPage moduleId="coach-water-photo" />
      </Route>
      <Route path="/lifeguard/closing-cleanup-photo">
        <LifeguardOperationDetailPage moduleId="closing-cleanup-photo" />
      </Route>
      <Route path="/lifeguard/lane-notes">
        <LifeguardOperationDetailPage moduleId="lane-notes" />
      </Route>
      <Route path="/lifeguard/lost-and-found">
        <LifeguardOperationDetailPage moduleId="lost-and-found" />
      </Route>
      <Route path="/lifeguard/home" component={LifeguardHomePage} />
      <Route path="/lifeguard" component={LifeguardHomePage} />
      <Route path="/system/health" component={SystemDashboardPage} />
      <Route path="/system/alerts">
        <SystemAlertsPage />
      </Route>
      <Route path="/system/integrations">
        <SystemIntegrationsPage />
      </Route>
      <Route path="/system/audit">
        <SystemAuditPage />
      </Route>
      <Route path="/system/raw-inspector">
        <SystemRawInspectorPage />
      </Route>
      <Route path="/system/training-views">
        <SystemTrainingViewsPage />
      </Route>
      <Route path="/system/topology" component={SystemTopology} />
      <Route path="/system/overview" component={SystemDashboardPage} />
      <Route path="/system" component={SystemDashboardPage} />
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
      <Route path="/employee/tasks">
        <EmployeeTasksPage />
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
      <Route path="/employee/personal-note">
        <EmployeePersonalNotePage />
      </Route>
      <Route path="/employee/qna">
        <EmployeeQnaPage />
      </Route>
      <Route path="/employee/settings">
        <EmployeeSettingsPage />
      </Route>
      <Route path="/employee/checkins">
        <EmployeeMorePage />
      </Route>
      <Route path="/employee/more">
        <EmployeeMorePage />
      </Route>
      <Route path="/employee/home" component={EmployeeHomePage} />
      <Route path="/employee" component={EmployeeHomePage} />
      <Route component={SystemDashboardPage} />
    </Switch>
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

  return <WorkbenchRouter />;
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
            <Route path="/parking/sign/:token" component={ParkingSignPage} />
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

  if (isPortal || isWorkbench || isLogin) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {isWorkbench ? <WidgetTelemetryCapture /> : null}
          {isLogin ? <LoginRedirector /> : isWorkbench ? <WorkbenchAuthGate /> : <PortalRouter />}
          <DebugDreamLoaderOverlay />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NotFound />
        <DebugDreamLoaderOverlay />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function LoginRedirector() {
  const { data: session, isLoading } = useAuthMe();

  if (isLoading) {
    return <WorkbenchLoginPage />;
  }

  if (session) {
    return <Redirect to={roleHomePath[session.activeRole]} />;
  }

  return <WorkbenchLoginPage />;
}

export default App;
