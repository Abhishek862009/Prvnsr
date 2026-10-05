import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.env.VB_ROOT ?? process.cwd();

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const publicFiles = [
  ...walk(join(root, "app/(public)")),
  ...walk(join(root, "components/public")),
  ...walk(join(root, "app/api/public")),
  ...walk(join(root, "content")),
  join(root, "server/services/public-site.ts"),
];

// Nothing on the public side may touch private student/parent/checking data.
const FORBIDDEN_IMPORTS = [
  "server/db",
  "server/repos/students",
  "server/repos/parents",
  "server/repos/checking",
  "server/repos/parent-reports",
  "server/repos/reports",
  "server/repos/enquiries",
  "server/services/students",
  "server/services/checking",
  "server/services/parent-portal",
  "server/services/parent-auth",
  "server/services/reports",
  "server/auth/guards",
];

describe("public side privacy guard", () => {
  it("scans a meaningful set of files", () => {
    expect(publicFiles.length > 15).toBe(true);
  });
  it("never imports private data modules", () => {
    for (const file of publicFiles) {
      const src = readFileSync(file, "utf8");
      for (const bad of FORBIDDEN_IMPORTS) {
        expect(src.includes(`@/${bad}`)).toBe(false);
      }
    }
  });
  it("shows no fee amounts and hard-codes no phone numbers", () => {
    for (const file of publicFiles) {
      const src = readFileSync(file, "utf8");
      expect(/₹|\bRs\.?\s?\d|\bINR\b|per month/i.test(src)).toBe(false);
      expect(/(?<![\d+])[6-9]\d{9}(?!\d)/.test(src)).toBe(false);
    }
  });
  it("the public enquiry endpoint is write-only (no GET)", () => {
    const src = readFileSync(join(root, "app/api/public/enquiry/route.ts"), "utf8");
    expect(/export\s+(const|async function)\s+GET\b/.test(src)).toBe(false);
    expect(/export\s+(const|async function)\s+POST\b/.test(src)).toBe(true);
  });
  it("the public availability endpoint is GET-only and uncached", () => {
    const src = readFileSync(join(root, "app/api/public/availability/route.ts"), "utf8");
    expect(/export\s+(const|async function)\s+(POST|PUT|PATCH|DELETE)\b/.test(src)).toBe(false);
    expect(src.includes("no-store")).toBe(true);
  });
});
