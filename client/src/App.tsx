import { useEffect, useState } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Dashboard from "@/pages/dashboard";
import Analytics from "@/pages/analytics";
import Operations from "@/pages/operations";
import HrAudit from "@/pages/hr-audit";
import SystemHealth from "@/pages/system-health";
import AnomalyReports from "@/pages/anomaly-reports";
import Announcements from "@/pages/announcements";
import AnnouncementSummary from "@/pages/announcement-summary";
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
import EmployeeHomePage from "@/modules/employee/home/employee-home-page";
import EmployeeActivityPeriodsPage from "@/modules/employee/activity-periods/page";
import EmployeeAnnouncementsPage from "@/modules/employee/announcements/page";
import EmployeeDocumentsPage from "@/modules/employee/documents/page";
import EmployeeHandoverPage from "@/modules/employee/handover/page";
import EmployeeMorePage from "@/modules/employee/more/page";
import EmployeePersonalNotePage from "@/modules/employee/personal-note/page";
import EmployeeShiftPage from "@/modules/employee/shift/page";
import EmployeeTasksPage from "@/modules/employee/tasks/page";
import SupervisorDashboardPage from "@/modules/supervisor/dashboard-page";
import SupervisorAnnouncementsPage from "@/modules/supervisor/announcements/page";
import SupervisorAnomaliesPage from "@/modules/supervisor/anomalies/page";
import SupervisorPeoplePage from "@/modules/supervisor/people/page";
import SupervisorHandoverPage from "@/modules/supervisor/handover/page";
import SupervisorReportsPage from "@/modules/supervisor/reports/page";
import SupervisorSettingsPage from "@/modules/supervisor/settings/page";
import SupervisorTasksPage from "@/modules/supervisor/tasks/page";
import SystemDashboardPage from "@/modules/system/dashboard-page";
import SystemAlertsPage from "@/modules/system/alerts/page";
import SystemAuditPage from "@/modules/system/audit/page";
import SystemIntegrationsPage from "@/modules/system/integrations/page";
import SystemRawInspectorPage from "@/modules/system/raw-inspector/page";
import WorkbenchLoginPage from "@/modules/workbench/login-page";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { useAuthMe } from "@/shared/auth/session";
import { roleHomePath } from "@shared/auth/me";
import { usePortalAuth } from "@/hooks/use-bound-facility";
import { getFacilityConfig } from "@/config/facility-configs";
import { apiPost } from "@/shared/api/client";

const PAGE_TITLES: Record<string, string> = {
  "/": "營運戰情總覽",
  "/analytics": "決策與數據洞察",
  "/operations": "跨館資源監控",
  "/hr-audit": "HR 與權限稽核",
  "/system-health": "微服務健康監控",
  "/anomaly-reports": "打卡異常管理",
  "/announcements": "公告審核中心",
  "/announcements/summary": "公告分析總覽",
};

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/operations" component={Operations} />
      <Route path="/hr-audit" component={HrAudit} />
      <Route path="/system-health" component={SystemHealth} />
      <Route path="/anomaly-reports" component={AnomalyReports} />
      <Route path="/announcements/summary" component={AnnouncementSummary} />
      <Route path="/announcements" component={Announcements} />
      <Route component={NotFound} />
    </Switch>
  );
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
      <Route path="/supervisor/home" component={SupervisorDashboardPage} />
      <Route path="/supervisor/tasks">
        <SupervisorTasksPage />
      </Route>
      <Route path="/supervisor/announcements">
        <SupervisorAnnouncementsPage />
      </Route>
      <Route path="/supervisor/anomalies">
        <SupervisorAnomaliesPage />
      </Route>
      <Route path="/supervisor/people">
        <SupervisorPeoplePage />
      </Route>
      <Route path="/supervisor/handover">
        <SupervisorHandoverPage />
      </Route>
      <Route path="/supervisor/reports">
        <SupervisorReportsPage />
      </Route>
      <Route path="/supervisor/settings">
        <SupervisorSettingsPage />
      </Route>
      <Route path="/supervisor" component={SupervisorDashboardPage} />
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
      <Route path="/system/overview" component={SystemDashboardPage} />
      <Route path="/system" component={SystemDashboardPage} />
      <Route path="/employee/tasks">
        <EmployeeTasksPage />
      </Route>
      <Route path="/employee/announcements/:id">
        {(params) => <EmployeeAnnouncementsPage announcementId={params.id} />}
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
      <Route path="/employee/activity-periods">
        <EmployeeActivityPeriodsPage />
      </Route>
      <Route path="/employee/registration-courses">
        <EmployeeMorePage />
      </Route>
      <Route path="/employee/documents">
        <EmployeeDocumentsPage />
      </Route>
      <Route path="/employee/personal-note">
        <EmployeePersonalNotePage />
      </Route>
      <Route path="/employee/qna">
        <EmployeeMorePage />
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

function WorkbenchAuthGate() {
  const { data: session, isLoading, isError } = useAuthMe();

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

const sidebarStyle = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "3rem",
};

function HeaderTitle() {
  const [location] = useLocation();
  const title = PAGE_TITLES[location] || "駿斯 CMS";
  return <span className="text-[13px] font-medium text-muted-foreground" data-testid="text-page-title">{title}</span>;
}

function App() {
  const [location] = useLocation();
  const normalizedLocation = location.toLowerCase();
  const isPortal = location.startsWith("/portal");
  const isLogin = normalizedLocation === "/login";
  const isWorkbench =
    normalizedLocation === "/" ||
    normalizedLocation === "/employee" ||
    normalizedLocation.startsWith("/employee/") ||
    normalizedLocation === "/supervisor" ||
    normalizedLocation.startsWith("/supervisor/") ||
    normalizedLocation === "/system" ||
    normalizedLocation.startsWith("/system/");

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
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
          <div className="flex h-screen w-full bg-background">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <header className="flex items-center gap-2.5 px-4 h-12 border-b bg-background/80 backdrop-blur-md" style={{ boxShadow: "rgba(0,0,0,0.08) 0px 1px 0px" }}>
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="h-4 w-px bg-border" />
                <HeaderTitle />
              </header>
              <main className="flex-1 overflow-hidden">
                <AppRouter />
              </main>
            </div>
          </div>
        </SidebarProvider>
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
