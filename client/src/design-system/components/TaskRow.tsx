import type { ReactNode } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { DenseRow } from "./DenseRow";
import { StatusTag } from "./Tags";

export interface TaskRowProps {
  title: string;
  description?: string;
  status?: "todo" | "doing" | "done" | "cancelled";
  dueLabel?: string;
  actions?: ReactNode;
}

const statusLabel: Record<NonNullable<TaskRowProps["status"]>, string> = {
  todo: "Todo",
  doing: "Doing",
  done: "Done",
  cancelled: "Cancelled",
};

export function TaskRow({ title, description, status = "todo", dueLabel, actions }: TaskRowProps) {
  const done = status === "done";
  return (
    <DenseRow
      leading={done ? <CheckCircle2 className="h-4 w-4 text-state-success" aria-hidden="true" /> : <Circle className="h-4 w-4 text-state-muted" aria-hidden="true" />}
      title={title}
      description={description}
      meta={
        <div className="flex items-center gap-1.5">
          {dueLabel ? <span className="text-body-xs font-bold text-text-muted">{dueLabel}</span> : null}
          <StatusTag variant={done ? "success" : "muted"}>{statusLabel[status]}</StatusTag>
        </div>
      }
      actions={actions}
    />
  );
}
