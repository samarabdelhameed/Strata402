import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";

const DEMO_HTML = fs.readFileSync(path.join(import.meta.dir, "demo.html"), "utf8");

export function mountDemoPage(app: Express): void {
  app.get("/demo", (_req, res) => {
    res.type("html").send(DEMO_HTML);
  });
}
