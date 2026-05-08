import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { facilityLineGroups } from "@shared/domain/facilities";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/shared/api/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  SupervisorEmptyState,
  SupervisorErrorState,
  SupervisorInlineLoading,
  SupervisorLoadingState,
  SupervisorModuleShell,
  SupervisorPanel,
} from "../module-shell";

interface AnnouncementGroup {
  id: number;
  facilityKey: string;
  lineGroupId: string;
  label: string;
  isActive: boolean;
  lookbackHours: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AnnouncementGroupsResponse {
  items: AnnouncementGroup[];
  sourceStatus: {
    connected: boolean;
    errorMessage: string | null;
  };
}

interface AnnouncementGroupInput {
  facilityKey: string;
  lineGroupId: string;
  label: string;
  isActive: boolean;
  lookbackHours: number;
  notes: string | null;
}

const emptyInput: AnnouncementGroupInput = {
  facilityKey: "xinbei_pool",
  lineGroupId: "",
  label: "",
  isActive: true,
  lookbackHours: 24,
  notes: "",
};

const GROUP_ID_RE = /^C[0-9a-f]{32}$/;

const compactGroupId = (value: string) =>
  value.length > 12 ? `${value.slice(0, 7)}...${value.slice(-5)}` : value;

const facilityName = (facilityKey: string) =>
  facilityLineGroups.find((facility) => facility.facilityKey === facilityKey)?.fullName ?? facilityKey;

const listAnnouncementGroups = () =>
  apiGet<AnnouncementGroupsResponse>("/api/admin/announcement-groups");

function toFormInput(group: AnnouncementGroup): AnnouncementGroupInput {
  return {
    facilityKey: group.facilityKey,
    lineGroupId: group.lineGroupId,
    label: group.label,
    isActive: group.isActive,
    lookbackHours: group.lookbackHours,
    notes: group.notes ?? "",
  };
}

export default function SupervisorAnnouncementGroupsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AnnouncementGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<AnnouncementGroupInput>(emptyInput);
  const [deleting, setDeleting] = useState<AnnouncementGroup | null>(null);

  const query = useQuery({
    queryKey: ["/api/admin/announcement-groups"],
    queryFn: listAnnouncementGroups,
  });

  const items = query.data?.items ?? [];
  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.isActive).length,
    facilities: new Set(items.map((item) => item.facilityKey)).size,
  }), [items]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/announcement-groups"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home", "announcements"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        label: form.label.trim(),
        lineGroupId: form.lineGroupId.trim(),
        notes: form.notes?.trim() || null,
        lookbackHours: Number(form.lookbackHours),
      };
      if (editing) {
        return apiPatch<AnnouncementGroup>(`/api/admin/announcement-groups/${editing.id}`, payload);
      }
      return apiPost<AnnouncementGroup>("/api/admin/announcement-groups", payload);
    },
    onSuccess: (saved) => {
      invalidate();
      setCreating(false);
      setEditing(null);
      setForm(emptyInput);
      toast({ title: editing ? "已更新公告群組綁定" : "已新增公告群組綁定", description: saved.label });
    },
    onError: (error: Error) => {
      toast({ title: "儲存失敗", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete<{ ok: true }>(`/api/admin/announcement-groups/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast({ title: "已刪除公告群組綁定" });
    },
    onError: (error: Error) => toast({ title: "刪除失敗", description: error.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: (id: number) => apiPost<{
      ok: boolean;
      sampleCount: number;
      latestMessage: { displayName: string; text: string | null; timestamp: string } | null;
      errorMessage: string | null;
    }>(`/api/admin/announcement-groups/${id}/test-fetch`),
    onSuccess: (result) => {
      const preview = result.latestMessage?.text ? `，最新一則：${result.latestMessage.text.slice(0, 40)}` : "";
      toast({ title: "測試拉取完成", description: `拉到 ${result.sampleCount} 筆訊息${preview}` });
    },
    onError: (error: Error) => toast({ title: "測試拉取失敗", description: error.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setForm(emptyInput);
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (group: AnnouncementGroup) => {
    setForm(toFormInput(group));
    setEditing(group);
    setCreating(false);
  };

  const formError = !form.label.trim()
    ? "請輸入標籤"
    : !GROUP_ID_RE.test(form.lineGroupId.trim())
      ? "LINE Group ID 格式需為 C + 32 位小寫 hex"
      : form.lookbackHours < 1 || form.lookbackHours > 168
        ? "回溯小時需介於 1 到 168"
        : null;

  return (
    <SupervisorModuleShell
      moduleId="announcement-groups"
      title="公告群組綁定"
      eyebrow="ANNOUNCEMENT GROUPS"
      description="管理每個場館對應的 LINE 群組，員工首頁會依目前場館自動顯示群組重要公告。"
      actions={
        <Button type="button" onClick={openCreate} data-testid="button-add-announcement-group" className="rounded-[8px] bg-[#15935d] text-white hover:bg-[#117a4e]">
          <Plus className="mr-2 h-4 w-4" />
          新增綁定
        </Button>
      }
    >
      {!query.data?.sourceStatus.connected ? (
        <div className="mb-4 flex items-center gap-2 rounded-[8px] border border-[#f2c66d] bg-[#fff8e8] px-4 py-3 text-[13px] font-bold text-[#9a6200]">
          <AlertTriangle className="h-4 w-4" />
          {query.data?.sourceStatus.errorMessage ?? "LINE_BOT_ADMIN_TOKEN 未設定，CRUD 可用但無法測試拉取訊息。"}
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Metric label="綁定總數" value={stats.total} />
        <Metric label="啟用中" value={stats.active} tone="green" />
        <Metric label="已設定場館" value={stats.facilities} tone="blue" />
      </div>

      <SupervisorPanel className="overflow-hidden">
        {query.isLoading ? <SupervisorLoadingState label="公告群組綁定載入中" /> : null}
        {query.isError ? <SupervisorErrorState message={(query.error as Error).message || "公告群組綁定載入失敗"} /> : null}
        {!query.isLoading && !query.isError && !items.length ? (
          <div className="p-4">
            <SupervisorEmptyState message="尚未建立公告群組綁定。" />
          </div>
        ) : null}
        {!query.isLoading && !query.isError && items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
              <thead className="bg-[#f7f9fb] text-[11px] font-black uppercase tracking-[0.08em] text-[#637185]">
                <tr>
                  <th className="px-4 py-3">場館</th>
                  <th className="px-4 py-3">群組 ID</th>
                  <th className="px-4 py-3">標籤</th>
                  <th className="px-4 py-3">回溯</th>
                  <th className="px-4 py-3">狀態</th>
                  <th className="px-4 py-3 text-right">動作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6edf4]">
                {items.map((group) => (
                  <tr key={group.id} data-testid={`row-announcement-group-${group.id}`} className="bg-white">
                    <td className="px-4 py-3 font-black text-[#102940]">{facilityName(group.facilityKey)}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#536175]">{compactGroupId(group.lineGroupId)}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#102940]">{group.label}</p>
                      {group.notes ? <p className="mt-1 line-clamp-1 text-[11px] text-[#7c8998]">{group.notes}</p> : null}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">{group.lookbackHours}h</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-1 text-[11px] font-black", group.isActive ? "bg-[#eaf8ef] text-[#15935d]" : "bg-[#eef2f6] text-[#637185]")}>
                        {group.isActive ? "啟用" : "停用"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => testMutation.mutate(group.id)} disabled={testMutation.isPending} data-testid={`button-test-${group.id}`}>
                          {testMutation.isPending ? <SupervisorInlineLoading label="測試" /> : <><RefreshCw className="mr-1 h-3.5 w-3.5" />測試</>}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => openEdit(group)} data-testid={`button-edit-${group.id}`}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          編輯
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setDeleting(group)} data-testid={`button-delete-${group.id}`} className="text-[#e45363] hover:text-[#e45363]">
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          刪除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SupervisorPanel>

      <GroupDialog
        open={creating || Boolean(editing)}
        title={editing ? "編輯公告群組綁定" : "新增公告群組綁定"}
        form={form}
        setForm={setForm}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSubmit={() => saveMutation.mutate()}
        disabled={Boolean(formError) || saveMutation.isPending}
        error={formError}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除公告群組綁定？</AlertDialogTitle>
            <AlertDialogDescription>
              這會直接刪除「{deleting?.label}」綁定；若只是暫停使用，請改用編輯並關閉啟用狀態。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting.id)} className="bg-[#e45363] text-white hover:bg-[#c93d4c]">
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SupervisorModuleShell>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "green" | "blue" }) {
  const color = tone === "green" ? "text-[#15935d]" : tone === "blue" ? "text-[#2f6fe8]" : "text-[#102940]";
  return (
    <div className="rounded-[8px] border border-[var(--supervisor-border)] bg-white px-4 py-3 shadow-[var(--supervisor-shadow-sm)]">
      <p className="text-[11px] font-bold text-[#536175]">{label}</p>
      <p className={cn("mt-2 font-mono text-[26px] font-black leading-none tabular-nums", color)}>{value}</p>
    </div>
  );
}

function GroupDialog({
  open,
  title,
  form,
  setForm,
  onClose,
  onSubmit,
  disabled,
  error,
}: {
  open: boolean;
  title: string;
  form: AnnouncementGroupInput;
  setForm: (input: AnnouncementGroupInput) => void;
  onClose: () => void;
  onSubmit: () => void;
  disabled: boolean;
  error: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <label className="grid gap-1 text-[12px] font-black text-[#102940]">
            場館
            <Select value={form.facilityKey} onValueChange={(facilityKey) => setForm({ ...form, facilityKey })}>
              <SelectTrigger data-testid="select-facility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {facilityLineGroups.map((facility) => (
                  <SelectItem key={facility.facilityKey} value={facility.facilityKey}>
                    {facility.shortName} · {facility.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1 text-[12px] font-black text-[#102940]">
            LINE Group ID
            <input
              value={form.lineGroupId}
              onChange={(event) => setForm({ ...form, lineGroupId: event.target.value.trim() })}
              data-testid="input-line-group-id"
              className="min-h-10 rounded-[8px] border border-[#dfe7ef] px-3 font-mono text-[13px] outline-none focus:border-[#2f6fe8]"
              placeholder="C66a4b3bb3fbc3dcf52d42626ec512484"
            />
          </label>
          <label className="grid gap-1 text-[12px] font-black text-[#102940]">
            標籤
            <input
              value={form.label}
              onChange={(event) => setForm({ ...form, label: event.target.value })}
              className="min-h-10 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] outline-none focus:border-[#2f6fe8]"
              placeholder="新北重要公告"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="grid gap-1 text-[12px] font-black text-[#102940]">
              回溯小時
              <input
                type="number"
                min={1}
                max={168}
                value={form.lookbackHours}
                onChange={(event) => setForm({ ...form, lookbackHours: Number(event.target.value) })}
                className="min-h-10 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] outline-none focus:border-[#2f6fe8]"
              />
            </label>
            <label className="flex items-end gap-3 pb-2 text-[12px] font-black text-[#102940]">
              <Switch checked={form.isActive} onCheckedChange={(isActive) => setForm({ ...form, isActive })} />
              啟用
            </label>
          </div>
          <label className="grid gap-1 text-[12px] font-black text-[#102940]">
            備註
            <textarea
              value={form.notes ?? ""}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className="min-h-20 rounded-[8px] border border-[#dfe7ef] px-3 py-2 text-[13px] outline-none focus:border-[#2f6fe8]"
              placeholder="主管備註，可留空"
            />
          </label>
          {error ? <p className="text-[12px] font-bold text-[#e45363]">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          <Button type="button" onClick={onSubmit} disabled={disabled} className="bg-[#15935d] text-white hover:bg-[#117a4e]">
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
