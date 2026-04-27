import type { Express, Request } from "express";
import { z } from "zod";
import type { AppContainer } from "../../app/container";
import type { BackendModule } from "../_shared/module";
import { requireSession } from "../auth/context";
import { storage } from "../../storage";
import type { Task, InsertTask } from "@shared/schema";

const taskStatus = z.enum(["pending", "in_progress", "done", "cancelled"]);
const taskPriority = z.enum(["low", "normal", "high"]);

const createTaskSchema = z.object({
  facilityKey: z.string().min(1).optional(),
  title: z.string().min(1, "標題不可為空").max(140, "標題過長"),
  content: z.string().max(2000, "內容過長").optional().nullable(),
  priority: taskPriority.default("normal"),
  assignedToUserId: z.string().min(1).optional().nullable(),
  assignedToName: z.string().min(1).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
});

const updateTaskSchema = createTaskSchema.partial().extend({
  status: taskStatus.optional(),
});

const statusPatchSchema = z.object({
  status: taskStatus,
});

const isManagerSession = (req: Request) =>
  req.workbenchSession?.activeRole === "supervisor" || req.workbenchSession?.activeRole === "system";

const isGrantedFacility = (req: Request, facilityKey: string) =>
  Boolean(req.workbenchSession?.grantedFacilities.includes(facilityKey));

const canMutateTask = (req: Request, task: Task) => {
  if (!isGrantedFacility(req, task.facilityKey)) return false;
  if (isManagerSession(req)) return true;
  return task.createdByUserId === req.workbenchSession?.userId;
};

const canCompleteTask = (req: Request, task: Task) => {
  if (!isGrantedFacility(req, task.facilityKey)) return false;
  if (isManagerSession(req)) return true;
  const userId = req.workbenchSession?.userId;
  return task.createdByUserId === userId || task.assignedToUserId === userId || !task.assignedToUserId;
};

const parseDueAt = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildTaskPatch = (input: z.infer<typeof updateTaskSchema>, req: Request): Partial<InsertTask & { completedAt: Date | null }> => {
  const patch: Partial<InsertTask & { completedAt: Date | null }> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.content !== undefined) patch.content = input.content;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.dueAt !== undefined) patch.dueAt = parseDueAt(input.dueAt);
  if (input.status !== undefined) {
    patch.status = input.status;
    patch.completedAt = input.status === "done" ? new Date() : null;
  }
  if (isManagerSession(req)) {
    if (input.assignedToUserId !== undefined) patch.assignedToUserId = input.assignedToUserId ?? null;
    if (input.assignedToName !== undefined) patch.assignedToName = input.assignedToName ?? null;
  }
  return patch;
};

export const registerTaskRoutes = (app: Express, _container: AppContainer) => {
  app.get("/api/tasks", requireSession, async (req, res, next) => {
    try {
      const requestedFacility = typeof req.query.facilityKey === "string" ? req.query.facilityKey : undefined;
      const facilityKey = requestedFacility || req.workbenchSession!.activeFacility;
      if (!isGrantedFacility(req, facilityKey)) return res.status(403).json({ message: "Facility is not granted" });
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const tasks = await storage.listTasks({
        facilityKey,
        status,
        userId: isManagerSession(req) ? undefined : req.workbenchSession!.userId,
        includeCancelled: req.query.includeCancelled === "true",
        limit: Number(req.query.limit ?? 100),
      });
      return res.json({ items: tasks });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/tasks", requireSession, async (req, res, next) => {
    try {
      const input = createTaskSchema.parse(req.body);
      const facilityKey = input.facilityKey || req.workbenchSession!.activeFacility;
      if (!isGrantedFacility(req, facilityKey)) return res.status(403).json({ message: "Facility is not granted" });
      const manager = isManagerSession(req);
      const task: InsertTask = {
        facilityKey,
        title: input.title,
        content: input.content ?? null,
        priority: input.priority,
        status: "pending",
        source: manager ? "supervisor" : "employee",
        createdByUserId: req.workbenchSession!.userId,
        createdByName: req.workbenchSession!.displayName,
        assignedToUserId: manager ? input.assignedToUserId ?? null : req.workbenchSession!.userId,
        assignedToName: manager ? input.assignedToName ?? null : req.workbenchSession!.displayName,
        dueAt: parseDueAt(input.dueAt),
      };
      const created = await storage.createTask(task);
      return res.status(201).json(created);
    } catch (error) {
      return next(error);
    }
  });

  app.patch("/api/tasks/:id", requireSession, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid task id" });
      const task = await storage.getTaskById(id);
      if (!task) return res.status(404).json({ message: "Task not found" });
      const input = updateTaskSchema.parse(req.body);
      if (input.status === "done" ? !canCompleteTask(req, task) : !canMutateTask(req, task)) {
        return res.status(403).json({ message: "Task is not editable" });
      }
      const updated = await storage.updateTask(id, buildTaskPatch(input, req));
      return res.json(updated);
    } catch (error) {
      return next(error);
    }
  });

  app.patch("/api/tasks/:id/status", requireSession, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid task id" });
      const task = await storage.getTaskById(id);
      if (!task) return res.status(404).json({ message: "Task not found" });
      const input = statusPatchSchema.parse(req.body);
      if (input.status === "done" ? !canCompleteTask(req, task) : !canMutateTask(req, task)) {
        return res.status(403).json({ message: "Task status is not editable" });
      }
      const updated = await storage.updateTask(id, {
        status: input.status,
        completedAt: input.status === "done" ? new Date() : null,
      });
      return res.json(updated);
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/tasks/:id", requireSession, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid task id" });
      const task = await storage.getTaskById(id);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (!canMutateTask(req, task)) return res.status(403).json({ message: "Task is not deletable" });
      await storage.deleteTask(id);
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  });
};

export const tasksModule: BackendModule = {
  name: "tasks",
  responsibility: "Task CRUD, employee self-created tasks, supervisor-assigned tasks, and task completion state",
};
