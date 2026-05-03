import {
  courtReservations,
  courtSyncLogs,
  courtSyncErrors,
  type CourtReservation,
  type InsertCourtReservation,
  type CourtSyncLog,
  type InsertCourtSyncLog,
  type CourtSyncError,
  type InsertCourtSyncError,
  type CourtSchoolId,
} from "@shared/schema";
import { db } from "../../db";
import { and, asc, between, desc, eq, sql } from "drizzle-orm";

export interface ICourtsStorage {
  getReservationsByDate(
    school: CourtSchoolId,
    date: string,
  ): Promise<CourtReservation[]>;
  getReservationsByDateRange(
    school: CourtSchoolId,
    startDate: string,
    endDate: string,
  ): Promise<CourtReservation[]>;
  getReservation(id: string): Promise<CourtReservation | undefined>;
  createReservation(
    reservation: InsertCourtReservation,
  ): Promise<CourtReservation>;
  updateReservation(
    id: string,
    reservation: Partial<InsertCourtReservation>,
  ): Promise<CourtReservation | undefined>;
  deleteReservation(id: string): Promise<boolean>;
  checkConflict(
    school: CourtSchoolId,
    date: string,
    court: number,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ): Promise<boolean>;
  recordSyncLog(log: InsertCourtSyncLog): Promise<CourtSyncLog>;
  recordSyncError(err: InsertCourtSyncError): Promise<CourtSyncError>;
  getRecentSyncLogs(
    school: CourtSchoolId,
    limit?: number,
  ): Promise<CourtSyncLog[]>;
  getRecentSyncErrors(
    school: CourtSchoolId,
    limit?: number,
  ): Promise<CourtSyncError[]>;
}

export class CourtsDbStorage implements ICourtsStorage {
  async getReservationsByDate(school: CourtSchoolId, date: string) {
    return db
      .select()
      .from(courtReservations)
      .where(
        and(
          eq(courtReservations.school, school),
          eq(courtReservations.date, date),
        ),
      )
      .orderBy(asc(courtReservations.startTime), asc(courtReservations.court));
  }

  async getReservationsByDateRange(
    school: CourtSchoolId,
    startDate: string,
    endDate: string,
  ) {
    return db
      .select()
      .from(courtReservations)
      .where(
        and(
          eq(courtReservations.school, school),
          between(courtReservations.date, startDate, endDate),
        ),
      )
      .orderBy(
        asc(courtReservations.date),
        asc(courtReservations.startTime),
        asc(courtReservations.court),
      );
  }

  async getReservation(id: string) {
    const [row] = await db
      .select()
      .from(courtReservations)
      .where(eq(courtReservations.id, id))
      .limit(1);
    return row;
  }

  async createReservation(insert: InsertCourtReservation) {
    const [row] = await db
      .insert(courtReservations)
      .values({
        school: insert.school,
        date: insert.date,
        court: insert.court,
        startTime: insert.startTime,
        endTime: insert.endTime,
        customerName: insert.customerName,
        phone: insert.phone,
        notes: insert.notes ?? null,
        status: insert.status ?? "confirmed",
        serviceName: insert.serviceName ?? null,
        source: insert.source ?? "manual",
      })
      .returning();
    return row;
  }

  async updateReservation(
    id: string,
    update: Partial<InsertCourtReservation>,
  ) {
    const [row] = await db
      .update(courtReservations)
      .set(update)
      .where(eq(courtReservations.id, id))
      .returning();
    return row;
  }

  async deleteReservation(id: string) {
    const result = await db
      .delete(courtReservations)
      .where(eq(courtReservations.id, id))
      .returning({ id: courtReservations.id });
    return result.length > 0;
  }

  async checkConflict(
    school: CourtSchoolId,
    date: string,
    court: number,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ) {
    const rows = await db
      .select({ id: courtReservations.id })
      .from(courtReservations)
      .where(
        and(
          eq(courtReservations.school, school),
          eq(courtReservations.date, date),
          eq(courtReservations.court, court),
          sql`${courtReservations.startTime} < ${endTime}`,
          sql`${courtReservations.endTime} > ${startTime}`,
        ),
      )
      .limit(5);
    return rows.some((r) => !excludeId || r.id !== excludeId);
  }

  async recordSyncLog(log: InsertCourtSyncLog) {
    const [row] = await db.insert(courtSyncLogs).values(log).returning();
    return row;
  }

  async recordSyncError(err: InsertCourtSyncError) {
    const [row] = await db.insert(courtSyncErrors).values(err).returning();
    return row;
  }

  async getRecentSyncLogs(school: CourtSchoolId, limit = 50) {
    return db
      .select()
      .from(courtSyncLogs)
      .where(eq(courtSyncLogs.school, school))
      .orderBy(desc(courtSyncLogs.createdAt))
      .limit(limit);
  }

  async getRecentSyncErrors(school: CourtSchoolId, limit = 50) {
    return db
      .select()
      .from(courtSyncErrors)
      .where(eq(courtSyncErrors.school, school))
      .orderBy(desc(courtSyncErrors.createdAt))
      .limit(limit);
  }
}

export const courtsStorage: ICourtsStorage = new CourtsDbStorage();
