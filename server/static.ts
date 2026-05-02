import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const uploadsPath = path.resolve(process.cwd(), "uploads");
  if (fs.existsSync(uploadsPath)) {
    // Block direct static access to work-log photos in production too —
    // they must go through /api/storage/objects/* for facility-scoped authz.
    app.use("/uploads/work-logs", (_req, res) => {
      res.status(403).json({ message: "請改用 /api/storage/objects/ 取得工作日誌照片" });
    });
    app.use("/uploads", express.static(uploadsPath));
  }

  app.use(express.static(distPath));

  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
