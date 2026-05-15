#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const commands = [
  ["check:encoding", ["node", "scripts/check-encoding-artifacts.cjs"]],
  ["type-check", ["node", "scripts/run-toolchain.cjs", "tsc", "--pretty", "false", "--noEmit"]],
  ["check:modules", ["node", "scripts/run-toolchain.cjs", "tsx", "scripts/module-registry-check.ts"]],
  ["smoke:modules", ["node", "scripts/run-toolchain.cjs", "tsx", "scripts/module-smoke.ts"]],
  ["unit:modules", ["node", "scripts/run-toolchain.cjs", "tsx", "scripts/module-unit-tests.ts"]],
  ["build", ["node", "scripts/run-toolchain.cjs", "tsx", "script/build.ts"]],
];

for (const [name, [command, ...args]] of commands) {
  console.log(`\n[dry-run] ${name}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`[dry-run] ${name} failed with exit ${result.status}`);
    process.exit(result.status || 1);
  }
}

console.log("\n[dry-run] all gates passed");
