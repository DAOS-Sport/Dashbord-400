#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const artifact = `${String.fromCharCode(0xfffd)}${String.fromCharCode(0xfffd)}`;
const result = spawnSync("rg", ["-q", artifact, "-g", "*.ts", "-g", "*.tsx"], {
  cwd: process.cwd(),
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.status === 0) {
  console.error("Encoding artifacts detected");
  process.exit(1);
}

if (result.status === 1) {
  process.exit(0);
}

process.exit(result.status || 1);
