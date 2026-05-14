import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";
import { getDatabaseRuntimeConfig } from "./shared/db/profile";

const dbConfig = getDatabaseRuntimeConfig();

if (dbConfig.isMockConnection) {
  console.warn("[db] NEON_DATABASE_URL/DATABASE_URL is not set. Using mock connection profile; DB-backed legacy routes will require a real database.");
}

export const db = drizzle({
  connection: dbConfig.connectionString,
  schema,
  ws: ws,
});
