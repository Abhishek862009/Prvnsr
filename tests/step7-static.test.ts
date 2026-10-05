import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BACKUP_TABLES, TABLE_NAMES, type TableName } from "@/server/lib/backup-format";

const root = process.env.VB_ROOT ?? process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("backup spec matches the database schema (no silent column loss)", () => {
  const schema = read("server/db/schema.ts");
  const constName: Record<TableName, string> = {
    rooms: "rooms", students: "students", parent_accounts: "parentAccounts", parent_student_links: "parentStudentLinks",
    app_settings: "appSettings", daily_checks: "dailyChecks", daily_room_states: "dailyRoomStates",
    acknowledgements: "acknowledgements", delivery_log: "deliveryLog", enquiries: "enquiries",
  };
  const columnsOf = (name: string): string[] => {
    const start = schema.indexOf(`export const ${name} = pgTable(`);
    const rest = schema.slice(start + 10);
    const end = rest.search(/\nexport const /);
    const block = end < 0 ? rest : rest.slice(0, end);
    return [...block.matchAll(/^\s+(\w+): [A-Za-z]+\(/gm)].map((m) => m[1] as string);
  };
  for (const t of TABLE_NAMES) {
    it(`${t}: every schema column is in the backup spec (except documented exclusions)`, () => {
      const inSchema = columnsOf(constName[t]).filter((c) => !(t === "enquiries" && c === "ipHash")).sort();
      const inSpec = Object.keys(BACKUP_TABLES[t]).sort();
      expect(inSpec).toEqual(inSchema);
    });
  }
  it("security tables are never part of the backup", () => {
    for (const bad of ["warden_accounts", "warden_sessions", "login_attempts", "parent_sessions", "safety_backups"]) {
      expect((TABLE_NAMES as readonly string[]).includes(bad)).toBe(false);
    }
  });
});

describe("backup / restore code never touches Warden security data", () => {
  const repo = read("server/repos/backup.ts");
  it("repos/backup.ts has no reference to Warden or login-attempt tables", () => {
    for (const bad of ["wardenAccounts", "wardenSessions", "loginAttempts", "warden_"]) expect(repo.includes(bad)).toBe(false);
  });
  it("restore wipes only the included tables (plus parent sessions)", () => {
    const body = /export async function wipeIncludedTables[\s\S]*?\n}\n/.exec(repo)?.[0] ?? "";
    const wiped = [...body.matchAll(/tx\.delete\((\w+)\)/g)].map((m) => m[1]).sort();
    expect(wiped).toEqual(["acknowledgements", "appSettings", "dailyChecks", "dailyRoomStates", "deliveryLog", "enquiries", "parentAccounts", "parentSessions", "parentStudentLinks", "rooms", "students"].sort());
  });
  it("enquiry IP hashes are removed before export", () => {
    expect(repo.includes("delete enquiryColumns.ipHash")).toBe(true);
  });
  it("backup passwords are never logged or stored", () => {
    for (const f of ["server/services/backup.ts", "server/lib/restore-flow.ts", "server/lib/backup-archive.ts", "server/lib/backup-zip.ts", "app/api/admin/backup/download/route.ts"]) {
      expect(/console\.(log|error|warn|info)/.test(read(f))).toBe(false);
    }
    expect(read("app/api/admin/backup/download/route.ts").includes("export const GET")).toBe(false); // password must not travel in a URL
  });
});

describe("cleanup deletes only the five temporary categories", () => {
  const repo = read("server/repos/cleanup.ts");
  it("the only tables deleted from are checks, room states, acknowledgements, delivery logs, enquiries", () => {
    const deleted = [...repo.matchAll(/tx\s*\.delete\((\w+)\)/g)].map((m) => m[1]).sort();
    expect(deleted).toEqual(["acknowledgements", "dailyChecks", "dailyRoomStates", "deliveryLog", "enquiries"]);
  });
  it("never references permanent tables", () => {
    for (const bad of ["rooms", "students", "parentAccounts", "parentStudentLinks", "appSettings", "wardenAccounts"]) {
      expect(new RegExp(`\\b${bad}\\b`).test(repo.replace(/\/\*[\s\S]*?\*\//g, ""))).toBe(false);
    }
  });
  it("uses the IST cutoffs, not the server date", () => {
    const svc = read("server/services/cleanup.ts");
    expect(svc.includes("retentionCutoffs(now)")).toBe(true);
    expect(/new Date\(\)\.toISOString\(\)\.slice/.test(svc)).toBe(false);
  });
});

describe("cron endpoint", () => {
  const route = read("app/api/cron/cleanup/route.ts");
  it("authorises before running cleanup and fails closed", () => {
    expect(route.indexOf("isCronAuthorized")).toBeGreaterThan(-1);
    expect(route.indexOf("isCronAuthorized")).toBeLessThan(route.indexOf("runCleanup()"));
    expect(route.includes("401")).toBe(true);
  });
  it("is a plain endpoint (GET + POST) with no hosting-specific imports", () => {
    expect(route.includes("export const GET")).toBe(true);
    expect(route.includes("export const POST")).toBe(true);
    expect(/from "@vercel|from "vercel/.test(route)).toBe(false);
  });
});

describe("parent account management", () => {
  const svc = read("server/services/parent-admin.ts");
  const repo = read("server/repos/parent-admin.ts");
  it("new accounts always start with must_change_password on", () => {
    expect(repo.includes("mustChangePassword: true")).toBe(true);
  });
  it("password reset goes through the existing temporary-password flow (must change + sessions ended)", () => {
    expect(svc.includes("adminSetParentTemporaryPassword")).toBe(true);
  });
  it("there is no automatic linking by phone number", () => {
    expect(/parentWhatsapp\s*===/.test(svc)).toBe(false);
  });
  it("every parent-admin route requires a Warden session", () => {
    for (const f of ["app/api/admin/parents/route.ts", "app/api/admin/parents/[id]/route.ts", "app/api/admin/parents/[id]/password/route.ts", "app/api/admin/parents/[id]/links/route.ts", "app/api/admin/parents/[id]/links/[studentId]/route.ts"]) {
      expect(read(f).includes("requireWardenApi")).toBe(true);
    }
  });
});
