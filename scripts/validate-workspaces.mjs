#!/usr/bin/env node
/**
 * Strata402 — Phase 1 workspace validation.
 * Resolves root `workspaces` globs against the filesystem and prints every
 * matched workspace. Exits 1 if no workspaces resolve.
 */
import { readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const rootPkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

/**
 * Tiny glob expander for `apps/*`, `services/*`, `packages/*`.
 * Returns directories that exist on disk.
 */
async function expandWorkspaceGlob(glob) {
  const dirs = [];
  const match = /^\*\/?$/.test(glob.split("\/").pop() ?? "");
  const basePath = dirname(join(rootDir, glob));
  if (!match) return dirs;

  let entries;
  try {
    entries = await readdir(basePath, { withFileTypes: true });
  } catch {
    return dirs;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const candidate = join(basePath, entry.name);
      if (statSync(candidate).isDirectory()) dirs.push(candidate);
    }
  }
  return dirs;
}

const globs = rootPkg.workspaces ?? [];
const found = [];

for (const glob of globs) {
  const dirs = await expandWorkspaceGlob(glob);
  for (const dir of dirs) found.push(dir.replace(`${rootDir}/`, ""));
}

if (found.length === 0) {
  console.error("No workspaces resolved. Check root package.json `workspaces`.");
  process.exit(1);
}

console.log(`Found ${found.length} workspace(s):`);
for (const dir of found) console.log(`  - ${dir}`);

if (rootPkg.name !== "strata402") {
  console.error(`Expected root package name "strata402", got "${rootPkg.name}".`);
  process.exit(1);
}

console.log("Workspace validation: OK");