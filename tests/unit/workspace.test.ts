import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

test("root package is the private strata402 monorepo", () => {
  expect(pkg.name).toBe("strata402");
  expect(pkg.private).toBe(true);
});

test("workspaces globs cover apps, services, and packages", () => {
  expect(pkg.workspaces).toEqual(["apps/*", "services/*", "packages/*"]);
});

test("core monorepo directories exist", () => {
  for (const dir of ["apps", "services", "contracts", "packages", "tests", "scripts"]) {
    expect(existsSync(join(root, dir)), `${dir} should exist`).toBe(true);
  }
});

test("bunfig.toml and .env.example exist", () => {
  expect(existsSync(join(root, "bunfig.toml"))).toBe(true);
  expect(existsSync(join(root, ".env.example"))).toBe(true);
});