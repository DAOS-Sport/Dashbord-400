import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.NEON_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("NEON_DATABASE_URL or DATABASE_URL must be set; ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
