import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import PhotoUpload from "@/components/work-log/PhotoUpload";
import { useToast } from "@/hooks/use-toast";
import type { WorkLogShift } from "@/types/portal";
import type { CreateHandoverPayload } from "@/hooks/useWorkLog";

function MaterialIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden>{name}</span>;
}

const SHIFT_LABEL: Record<WorkLogShift, string> = { morning: "早班", noon: "中班", night: "晚班" };

function nextShift(s: WorkLogShift): WorkLogShift {
  if (s === "morning") return "noon";
  if (s === "noon") return "night";
  return "morning";
}

const composerSchema = z.object({
  category: z.enum(["facility", "customer", "safety", "general"]),
  content: z.string().trim().min(1, "請輸入交接內容"),
  isImportant: z.boolean(),
  needsAttention: z.boolean(),
  photoUrls: z.array(z.string().url()),
});

type ComposerValues = z.infer<typeof composerSchema>;

interface HandoverComposerProps {
  facilityKey: string;
  workDate: string;
  shiftType: WorkLogShift;
  disabled?: boolean;
  isPending: boolean;
  onSubmit: (payload: CreateHandoverPayload) => Promise<unknown>;
}

export default function HandoverComposer({
  facilityKey,
  workDate,
  shiftType,
  disabled = false,
  isPending,
  onSubmit,
}: HandoverComposerProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const target = nextShift(shiftType);

  const form = useForm<ComposerValues>({
    resolver: zodResolver(composerSchema),
    defaultValues: {
      category: "general",
      content: "",
      isImportant: false,
      needsAttention: false,
      photoUrls: [],
    },
  });

  const handleSubmit = async (values: ComposerValues) => {
    try {
      await onSubmit({
        facilityKey,
        workDate,
        fromShift: shiftType,
        toShift: target,
        category: values.category,
        content: values.content.trim(),
        isImportant: values.isImportant,
        needsAttention: values.needsAttention,
        photoUrls: values.photoUrls.length > 0 ? values.photoUrls : undefined,
      });
      form.reset({
        category: "general",
        content: "",
        isImportant: false,
        needsAttention: false,
        photoUrls: [],
      });
      setOpen(false);
      toast({ title: "已交接給下一班", description: `已留交接給${SHIFT_LABEL[target]}` });
    } catch (err) {
      toast({
        title: "建立交接失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    }
  };

  if (!open) {
    return (
      <div className="border-t border-slate-200 pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          disabled={disabled}
          data-testid="button-open-handover-composer"
        >
          <MaterialIcon name="add" className="text-base mr-1" />
          交接給下一班（{SHIFT_LABEL[target]}）
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-200 pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-stitch-secondary font-bold">
          交接給下一班 · 目標班次：{SHIFT_LABEL[target]}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            form.reset();
            setOpen(false);
          }}
          data-testid="button-close-handover-composer"
        >
          收起
        </Button>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">分類</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={disabled || isPending}>
                  <FormControl>
                    <SelectTrigger className="w-40" data-testid="select-handover-composer-category">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="general">一般</SelectItem>
                    <SelectItem value="facility">設施</SelectItem>
                    <SelectItem value="customer">客務</SelectItem>
                    <SelectItem value="safety">安全</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">
                  交接內容 <span className="text-rose-500">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder="例如：男廁 3 號小便斗水箱漏水，已通知設備組..."
                    disabled={disabled || isPending}
                    data-testid="input-handover-composer-content"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="isImportant"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <MaterialIcon name="priority_high" className="text-rose-500" />
                    <FormLabel className="text-sm m-0">標記為重要</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={disabled || isPending}
                      data-testid="switch-handover-composer-important"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="needsAttention"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <MaterialIcon name="supervisor_account" className="text-amber-600" />
                    <FormLabel className="text-sm m-0">需主管注意</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={disabled || isPending}
                      data-testid="switch-handover-composer-attention"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="photoUrls"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">照片（選填，最多 8 張）</FormLabel>
                <FormControl>
                  <PhotoUpload
                    value={field.value}
                    onChange={field.onChange}
                    facilityKey={facilityKey}
                    folder="work-logs/handover"
                    max={8}
                    disabled={disabled || isPending}
                    testIdPrefix="photo-handover-composer"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={disabled || isPending}
              data-testid="button-submit-handover-composer"
            >
              <MaterialIcon name="send" className="text-sm mr-1" />
              {isPending ? "送出中..." : "送出交接"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
