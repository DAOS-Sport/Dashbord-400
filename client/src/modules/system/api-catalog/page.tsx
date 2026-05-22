import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Database, Filter, RefreshCw, Server } from "lucide-react";
import { Link } from "wouter";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import { fetchSystemApiCatalog } from "../control-center/api";

const methodClass: Record<string, string> = {
  GET: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  POST: "bg-blue-50 text-blue-700 ring-blue-600/20",
  PATCH: "bg-amber-50 text-amber-800 ring-amber-600/20",
  PUT: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  DELETE: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const allValue = "all";

export default function SystemApiCatalogPage() {
  const [projectFilter, setProjectFilter] = useState(allValue);
  const [roleFilter, setRoleFilter] = useState(allValue);
  const [featureFilter, setFeatureFilter] = useState(allValue);
  const [queryText, setQueryText] = useState("");
  const catalogQuery = useQuery({
    queryKey: ["/api/bff/system/api-catalog"],
    queryFn: fetchSystemApiCatalog,
    staleTime: 30_000,
    retry: 1,
  });

  const data = catalogQuery.data;
  const projects = useMemo(() => Object.keys(data?.summary.projects ?? {}).sort(), [data?.summary.projects]);
  const roles = useMemo(() => Object.keys(data?.summary.roles ?? {}).sort(), [data?.summary.roles]);
  const features = useMemo(() => Object.keys(data?.summary.features ?? {}).sort(), [data?.summary.features]);
  const filteredEntries = useMemo(() => {
    const needle = queryText.trim().toLowerCase();
    return (data?.entries ?? []).filter((entry) => {
      if (projectFilter !== allValue && entry.project !== projectFilter) return false;
      if (roleFilter !== allValue && entry.role !== roleFilter) return false;
      if (featureFilter !== allValue && entry.feature !== featureFilter) return false;
      if (!needle) return true;
      return [
        entry.method,
        entry.path,
        entry.handlerFile,
        entry.auth,
        entry.dataSource,
        entry.project,
        entry.feature,
        entry.role,
        ...entry.registryModules.map((module) => `${module.id} ${module.label}`),
      ].join(" ").toLowerCase().includes(needle);
    });
  }, [data?.entries, featureFilter, projectFilter, queryText, roleFilter]);

  const topModuleSources = useMemo(
    () => [...(data?.moduleSources ?? [])].sort((a, b) => b.apiCount - a.apiCount || a.label.localeCompare(b.label, "zh-TW")).slice(0, 12),
    [data?.moduleSources],
  );

  return (
    <RoleShell role="system" title="API Catalog" subtitle="ROUTES / MODULES / DATA SOURCES">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-5">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-[12px] font-black uppercase tracking-wide text-text-muted">System API Catalog</p>
            <h1 className="mt-2 text-[28px] font-black leading-tight text-text-strong">API / 模組 / 資料來源總表</h1>
            <p className="mt-2 max-w-4xl text-[14px] font-semibold leading-6 text-text-body">
              以 API hub route manifest 為完整路由來源，合併 MODULE_REGISTRY 的角色、模組、資料表與整合來源。
            </p>
          </div>
          <Link href="/system/project-overview" className="inline-flex min-h-10 w-fit items-center gap-2 rounded-[8px] border border-border-subtle bg-surface-solid px-3 text-[12px] font-black text-text-strong hover:bg-surface-soft">
            回控制中心
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "API routes", value: data?.summary.totalApis ?? 0, hint: data?.source.routeManifest ?? "route manifest" },
            { label: "Modules", value: data?.summary.registeredModules ?? 0, hint: data?.source.moduleRegistry ?? "module registry" },
            { label: "Unmapped", value: data?.summary.unmappedApis ?? 0, hint: `${data?.summary.inferredModuleMatches ?? 0} 筆以 handler/feature 推論模組` },
            { label: "Visible rows", value: filteredEntries.length, hint: catalogQuery.isFetching ? "篩選中" : "目前表格筆數" },
          ].map((item) => (
            <WorkbenchCard key={item.label} className="min-h-[126px] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wide text-text-muted">{item.label}</p>
                  <p className="mt-3 text-[30px] font-black leading-none text-text-strong">{item.value}</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-surface-soft text-text-strong ring-1 ring-border-subtle">
                  {item.label === "Modules" ? <Database className="h-5 w-5" /> : <Server className="h-5 w-5" />}
                </span>
              </div>
              <p className="mt-3 truncate text-[12px] font-semibold text-text-body">{item.hint}</p>
            </WorkbenchCard>
          ))}
        </div>

        <WorkbenchCard className="p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="min-w-0 flex-1">
              <label className="text-[11px] font-black uppercase tracking-wide text-text-muted" htmlFor="api-catalog-search">
                Search
              </label>
              <input
                id="api-catalog-search"
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
                className="mt-1 h-10 w-full rounded-[8px] border border-border-subtle bg-surface-solid px-3 text-[13px] font-semibold text-text-strong outline-none focus:border-border-emphasis"
                placeholder="path / module / handler / source"
              />
            </div>
            {[
              { label: "Project", value: projectFilter, onChange: setProjectFilter, options: projects },
              { label: "Role", value: roleFilter, onChange: setRoleFilter, options: roles },
              { label: "Feature", value: featureFilter, onChange: setFeatureFilter, options: features },
            ].map((filter) => (
              <div key={filter.label} className="min-w-[180px]">
                <label className="text-[11px] font-black uppercase tracking-wide text-text-muted">{filter.label}</label>
                <select
                  value={filter.value}
                  onChange={(event) => filter.onChange(event.target.value)}
                  className="mt-1 h-10 w-full rounded-[8px] border border-border-subtle bg-surface-solid px-3 text-[13px] font-bold text-text-strong outline-none focus:border-border-emphasis"
                >
                  <option value={allValue}>全部</option>
                  {filter.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            ))}
            <div className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-surface-soft px-3 text-[12px] font-black text-text-body">
              <Filter className="h-4 w-4" />
              {filteredEntries.length}
            </div>
          </div>
        </WorkbenchCard>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <WorkbenchCard className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <div>
                <h2 className="text-[15px] font-black text-text-strong">完整 API 路由</h2>
                <p className="mt-1 text-[12px] font-semibold text-text-body">每筆都是 API hub manifest 中的 Express route。</p>
              </div>
              <RefreshCw className={cn("h-4 w-4 text-text-muted", catalogQuery.isFetching ? "animate-spin" : "")} />
            </div>
            <div className="max-h-[760px] overflow-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-surface-soft text-[11px] font-black uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Path</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Feature</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Module</th>
                    <th className="px-4 py-3">Data Source</th>
                    <th className="px-4 py-3">Handler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-[12px]">
                  {filteredEntries.map((entry) => (
                    <tr key={`${entry.method}-${entry.path}-${entry.handlerFile}`} className="align-top hover:bg-surface-soft/70">
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 font-black ring-1 ring-inset", methodClass[entry.method] ?? "bg-surface-soft text-text-body ring-border-subtle")}>
                          {entry.method}
                        </span>
                      </td>
                      <td className="max-w-[280px] px-4 py-3 font-mono font-semibold text-text-strong">{entry.path}</td>
                      <td className="px-4 py-3 font-bold text-text-body">{entry.project}</td>
                      <td className="px-4 py-3 font-bold text-text-body">{entry.feature}</td>
                      <td className="px-4 py-3 font-bold text-text-body">{entry.role}</td>
                      <td className="max-w-[180px] px-4 py-3">
                        {entry.registryModules.length ? (
                          <div className="space-y-1">
                            {entry.registryModules.slice(0, 2).map((module) => (
                              <p key={module.id} className="truncate font-bold text-text-strong">
                                {module.label}
                                {module.match === "inferred" ? <span className="ml-1 text-text-muted">(inferred)</span> : null}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <span className="font-semibold text-text-muted">unmapped</span>
                        )}
                      </td>
                      <td className="max-w-[260px] px-4 py-3 font-semibold text-text-body">{entry.dataSource}</td>
                      <td className="max-w-[240px] px-4 py-3 font-mono text-[11px] font-semibold text-text-muted">{entry.handlerFile}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </WorkbenchCard>

          <div className="space-y-4">
            <WorkbenchCard className="p-4">
              <h2 className="text-[15px] font-black text-text-strong">模組資料來源</h2>
              <p className="mt-1 text-[12px] font-semibold text-text-body">依 API 數量排序，協助接手時先看高影響模組。</p>
              <div className="mt-4 space-y-3">
                {topModuleSources.map((module) => (
                  <div key={module.moduleId} className="rounded-[8px] border border-border-subtle bg-surface-solid p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-black text-text-strong">{module.label}</p>
                        <p className="mt-1 truncate text-[11px] font-semibold text-text-muted">{module.moduleId} / {module.sourceOfTruth}</p>
                      </div>
                      <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-black text-text-body">{module.apiCount}</span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {(module.dataSources.length ? module.dataSources : [{ source: module.sourceOfTruth, entity: "module source", status: module.status }]).slice(0, 3).map((source, index) => (
                        <p key={`${module.moduleId}-${index}`} className="truncate text-[11px] font-semibold text-text-body">
                          {source.table ?? source.entity ?? source.source} · {source.source}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </WorkbenchCard>
          </div>
        </section>
      </div>
    </RoleShell>
  );
}
