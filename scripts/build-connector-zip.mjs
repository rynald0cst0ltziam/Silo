#!/usr/bin/env node
import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const root = process.cwd();
const src = join(root, "silo-connector");
const dest = join(root, "public");
const out = join(dest, "silo-connector.zip");

if (!existsSync(src)) {
  console.error("silo-connector/ directory not found");
  process.exit(1);
}

if (!existsSync(dest)) {
  mkdirSync(dest, { recursive: true });
}

// Use PowerShell's Compress-Archive on Windows, zip on Unix
const isWin = process.platform === "win32";

if (isWin) {
  execSync(
    `powershell -Command "Compress-Archive -Path '${src}' -DestinationPath '${out}' -Force"`,
    { stdio: "inherit" },
  );
} else {
  execSync(`cd "${root}" && zip -r "${out}" silo-connector/`, {
    stdio: "inherit",
  });
}

console.log(`Built: ${out}`);
