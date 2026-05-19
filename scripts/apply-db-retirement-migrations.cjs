const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log("[db-retirement] NEON_DATABASE_URL/DATABASE_URL not set; skipping retirement migrations.");
  process.exit(0);
}

const migrationPath = path.resolve(__dirname, "..", "migrations", "0014_retire_tasks_personal_note.sql");
const sql = fs.readFileSync(migrationPath, "utf8");

const client = new Client({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
});

(async () => {
  await client.connect();
  try {
    await client.query(sql);
    console.log("[db-retirement] Applied 0014_retire_tasks_personal_note.sql");
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error("[db-retirement] Failed to apply retirement migrations:", error.message);
  process.exit(1);
});
