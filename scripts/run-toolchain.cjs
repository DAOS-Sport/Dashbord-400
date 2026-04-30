#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeMaybePath(value) {
  if (!value) return undefined;
  return path.resolve(value);
}

function candidateNodes() {
  const userProfile = process.env.USERPROFILE;
  return unique([
    normalizeMaybePath(process.env.TOOLCHAIN_NODE),
    normalizeMaybePath(process.execPath),
    userProfile && path.join(userProfile, "nodejs-22", "node.exe"),
    userProfile &&
      path.join(
        userProfile,
        ".cache",
        "codex-runtimes",
        "codex-primary-runtime",
        "dependencies",
        "node",
        "bin",
        "node.exe",
      ),
    "C:\\Program Files\\nodejs\\node.exe",
  ]).filter((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
}

const commandEntries = {
  tsc: {
    entry: path.join(repoRoot, "node_modules", "typescript", "lib", "tsc.js"),
    probeArgs: ["--version"],
  },
  tsx: {
    entry: path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs"),
    probeArgs: ["--version"],
  },
};

function readNodeVersion(nodePath) {
  const result = spawnSync(nodePath, ["-p", "process.version"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 10_000,
  });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function selectNode(entryConfig) {
  const candidates = candidateNodes();
  for (const nodePath of candidates) {
    const result = spawnSync(nodePath, [entryConfig.entry, ...entryConfig.probeArgs], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 20_000,
    });

    if (result.status === 0) {
      return nodePath;
    }
  }

  console.error("[toolchain] no usable Node.js runtime found for this repo");
  for (const nodePath of candidates) {
    console.error(`- tried ${nodePath}`);
  }
  process.exit(1);
}

function parseArgs(argv) {
  const args = [...argv];
  const extraEnv = {};

  if (args[0] === "env") {
    args.shift();
    while (args[0] && /^[A-Za-z_][A-Za-z0-9_]*=/.test(args[0])) {
      const [key, ...valueParts] = args.shift().split("=");
      extraEnv[key] = valueParts.join("=");
    }
  }

  const command = args.shift();
  if (!commandEntries[command]) {
    console.error("[toolchain] usage: node scripts/run-toolchain.cjs [env KEY=value ...] <tsc|tsx> [...args]");
    process.exit(1);
  }

  return { command, args, extraEnv };
}

const { command, args, extraEnv } = parseArgs(process.argv.slice(2));
const entryConfig = commandEntries[command];
const nodePath = selectNode(entryConfig);

if (nodePath !== process.execPath || process.env.TOOLCHAIN_VERBOSE === "1") {
  console.warn(`[toolchain] using Node ${readNodeVersion(nodePath)} at ${nodePath}`);
}

const result = spawnSync(nodePath, [entryConfig.entry, ...args], {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env, ...extraEnv },
});

if (result.signal) {
  console.error(`[toolchain] ${command} terminated by signal ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
