import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.env.VB_ROOT ?? process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const walk = (dir: string, re: RegExp): string[] => {
  let out: string[] = [];
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) out = out.concat(walk(rel, re));
    else if (re.test(name)) out.push(rel);
  }
  return out;
};

describe("authorization boundary: every Warden API route and page is guarded", () => {
  const publicAdminRoutes = ["app/api/admin/login/route.ts", "app/api/admin/logout/route.ts", "app/api/admin/recover/route.ts"];
  const adminRoutes = walk("app/api/admin", /^route\.ts$/);
  it("finds the full set of admin routes", () => expect(adminRoutes.length > 35).toBe(true));
  for (const f of adminRoutes.filter((r) => !publicAdminRoutes.includes(r))) {
    it(`${f}: EVERY handler requires a Warden session`, () => {
      const src = read(f);
      const handlers = (src.match(/export const (GET|POST|PUT|PATCH|DELETE)\b/g) ?? []).length;
      const guards = (src.match(/await requireWardenApi\(\)/g) ?? []).length;
      expect(handlers > 0).toBe(true);
      expect(guards >= handlers).toBe(true);
    });
  }
  it("every mutating admin route also checks the request origin (CSRF)", () => {
    for (const f of adminRoutes) {
      const src = read(f);
      const mutating = (src.match(/export const (POST|PUT|PATCH|DELETE)\b/g) ?? []).length;
      const checks = (src.match(/assertSameOrigin\(req\);/g) ?? []).length;
      expect(checks >= mutating).toBe(true);
    }
  });
  it("every page inside the Warden panel re-checks the session itself", () => {
    const pages = walk("app/admin/(panel)", /^page\.tsx$/);
    expect(pages.length >= 14).toBe(true);
    for (const f of pages) expect(read(f).includes("await requireWarden()")).toBe(true);
  });
  it("the panel layout guards everything too", () => expect(read("app/admin/(panel)/layout.tsx").includes("requireWarden()")).toBe(true));
});

describe("Warden-only features are never reachable from public or parent code", () => {
  const scanned = [
    ...walk("app/(public)", /\.tsx?$/), ...walk("components/public", /\.tsx?$/), ...walk("app/api/public", /\.ts$/),
    ...walk("app/parent", /\.tsx?$/), ...walk("components/parent", /\.tsx?$/), ...walk("app/api/parent", /\.ts$/),
    ...walk("server/services", /^(parent-portal|parent-auth|student-access|public-site)\.ts$/),
  ];
  const FORBIDDEN = [
    "services/search", "services/history", "repos/warden-history", "lib/history", "lib/search", "services/students",
    "services/rooms", "services/parent-admin", "services/backup", "services/reports", "services/checking", "student-import", "room-import",
  ];
  it("scans a meaningful set of files", () => expect(scanned.length > 25).toBe(true));
  it("none of them imports search, history, student/room management or backup code", () => {
    for (const f of scanned) {
      const src = read(f);
      for (const bad of FORBIDDEN) expect(src.includes(`${bad}"`) || src.includes(`${bad}'`) || src.includes(`/${bad}`)).toBe(false);
    }
  });
  it("there is no public or parent route named search or history that reads Warden data", () => {
    expect(walk("app/api/public", /\.ts$/).some((f) => /search|history/.test(f))).toBe(false);
    expect(walk("app/api/parent", /\.ts$/).filter((f) => /search/.test(f))).toEqual([]);
  });
});

describe("rooms management", () => {
  const svc = read("server/services/rooms.ts");
  it("validation lives in ONE shared place (the service delegates, no copied regex)", () => {
    expect(svc.includes("validateRoomNumberInput")).toBe(true);
    expect(svc.includes("validateCapacityInput")).toBe(true);
    expect(svc.includes("decideRoomChange")).toBe(true);
    expect(/\\d\{3,4\}/.test(svc)).toBe(false);
  });
  it("renaming is checked against existing checking records (daily data cannot be orphaned)", () => {
    expect(svc.includes("hasChecksWithRoomSnapshot")).toBe(true);
  });
  it("the Rooms screen reuses the shared rules for live validation and confirms sensitive edits", () => {
    const ui = read("components/admin/RoomsManager.tsx");
    expect(ui.includes("validateRoomNumberInput")).toBe(true);
    expect(ui.includes("validateCapacityInput")).toBe(true);
    for (const k of ["confirmRename", "confirmDeactivate", "confirmCapacity"]) expect(ui.includes(`t.${k}`)).toBe(true);
    expect(ui.includes("readOnly")).toBe(true); // the floor is derived, never typed
  });
  it("public availability on the Rooms screen reuses the existing manual toggle", () => {
    expect(read("components/admin/RoomsManager.tsx").includes("AvailabilityToggle")).toBe(true);
  });
});

describe("students management: stable ID, snapshot, capacity", () => {
  const svc = read("server/services/students.ts");
  const schemas = read("server/http/schemas.ts");
  it("edit goes through the shared patch merge, and the patch schema cannot carry id / room / active", () => {
    expect(svc.includes("mergeStudentPatch")).toBe(true);
    const patch = /export const studentPatchSchema = z\.object\(studentFields\)\.strict\(\);/.test(schemas);
    expect(patch).toBe(true);
    const fields = /const studentFields = \{[\s\S]*?\n\};/.exec(schemas)?.[0] ?? "";
    for (const bad of ["id:", "roomId", "isActive"]) expect(fields.includes(bad)).toBe(false);
  });
  it("Move to Room changes ONLY the room (same Student ID) and uses the shared capacity decision", () => {
    const move = /export async function moveStudent[\s\S]*?\n}\n/.exec(svc)?.[0] ?? "";
    expect(move.includes("decideMove")).toBe(true);
    expect(move.includes("updateStudentRow(id, { roomId: targetRoomId }, tx)")).toBe(true);
    expect(/dailyChecks|insertCheck|updateCheck/.test(move)).toBe(false); // history is never rewritten
  });
  it("historical room numbers are preserved by a per-record snapshot", () => {
    expect(read("server/db/schema.ts").includes('roomNumberSnapshot: text("room_number_snapshot").notNull()')).toBe(true);
    expect(read("server/services/checking.ts").includes("roomNumberSnapshot: room.roomNumber")).toBe(true);
  });
  it("joining / moving / reactivating clears today's vacant+complete mark (existing locked rule)", () => {
    expect((svc.match(/resetRoomDayState\(/g) ?? []).length >= 4).toBe(true); // definition + create + move + reactivate
  });
  it("students are deactivated, never deleted", () => {
    expect(/\.delete\(students\)/.test(read("server/repos/students.ts"))).toBe(false);
    expect(read("app/api/admin/students/[id]/route.ts").includes("export const DELETE")).toBe(false);
  });
  it("the Students screen asks for confirmation before move / deactivate / reactivate", () => {
    const ui = read("components/admin/StudentsManager.tsx");
    for (const k of ["confirmMove", "confirmDeactivate", "confirmReactivate"]) expect(ui.includes(`t.${k}`)).toBe(true);
  });
});

describe("CSV import screens", () => {
  const ui = read("components/admin/CsvImporter.tsx");
  it("commit is impossible without a clean preview AND an explicit confirmation", () => {
    expect(ui.includes("if (!plan?.canCommit || csv === null || !confirmed) return;")).toBe(true);
    expect(ui.includes("disabled={!confirmed || busy !== null}")).toBe(true);
    expect(ui.includes("plan.canCommit ?")).toBe(true);
  });
  it("what is committed is exactly the text that was previewed, and any change invalidates the preview", () => {
    expect(ui.includes("body: csv }")).toBe(true);
    expect(ui.includes("onChange={invalidate}")).toBe(true);
    expect(ui.includes("setCsv(text)")).toBe(true);
  });
  it("shows errors clearly, with sample download", () => {
    for (const k of ["fileErrors", "onlyErrors", "sample", "blocked"]) expect(ui.includes(`t.${k}`)).toBe(true);
  });
  it("both import screens use the existing APIs and are Warden-guarded", () => {
    const s = read("app/admin/(panel)/students/import/page.tsx");
    const r = read("app/admin/(panel)/rooms/import/page.tsx");
    expect(s.includes("/api/admin/students/import/preview")).toBe(true);
    expect(r.includes("/api/admin/rooms/import/commit")).toBe(true);
    expect(r.includes("modes")).toBe(true);
    for (const f of [s, r]) expect(f.includes("await requireWarden()")).toBe(true);
  });
  it("the server still applies everything in one transaction behind the canCommit gate (rules unchanged)", () => {
    for (const f of ["server/services/student-import.ts", "server/services/room-import.ts"]) {
      const src = read(f);
      expect(src.includes("getDb().transaction")).toBe(true);
      expect(src.indexOf("canCommit")).toBeLessThan(src.indexOf("insert"));
    }
  });
});

describe("Warden search and history", () => {
  it("search is Warden-only and reads through the shared classifier", () => {
    expect(read("server/services/search.ts").includes("classifyQuery")).toBe(true);
    expect(read("app/api/admin/search/route.ts").includes("requireWardenApi")).toBe(true);
  });
  it("search results open the Room Checking screen", () => {
    expect(read("app/admin/(panel)/search/page.tsx").includes("/check`")).toBe(true);
  });
  it("history always clamps to the 30-day retention window", () => {
    expect(read("server/services/history.ts").includes("parseHistoryParams")).toBe(true);
    expect(read("server/lib/history.ts").includes("retentionCutoffs")).toBe(true);
  });
  it("history shows every required column", () => {
    const page = read("app/admin/(panel)/history/page.tsx");
    for (const k of ["studentNote", "roomNote", "whatsapp", "ack", "revision", "notRated"]) expect(page.includes(`t.${k}`)).toBe(true);
    for (const v of ["viewDate", "viewStudent", "viewRoom"]) expect(page.includes(`t.${v}`)).toBe(true);
  });
});

describe("Warden forgot-password", () => {
  const route = read("app/api/admin/recover/route.ts");
  it("the API checks origin, throttles via the shared flow and ends the Warden cookie", () => {
    expect(route.includes("assertSameOrigin(req);")).toBe(true);
    expect(route.includes("clearSessionCookie")).toBe(true);
    expect(read("server/services/warden-auth.ts").includes("runRecovery")).toBe(true);
    expect(read("server/services/warden-auth.ts").includes("deleteAllWardenSessions")).toBe(true);
  });
  it("password change and session deletion happen in ONE transaction", () => {
    const svc = read("server/services/warden-auth.ts");
    const block = /resetPasswordAndSessions:[\s\S]*?\}\),/.exec(svc)?.[0] ?? "";
    expect(block.includes("transaction")).toBe(true);
    expect(block.includes("updateWardenPassword")).toBe(true);
    expect(block.includes("deleteAllWardenSessions")).toBe(true);
  });
  it("the recovery key is never stored or exposed by the UI or source", () => {
    const ui = read("components/admin/RecoverForm.tsx");
    expect(/localStorage|sessionStorage|document\.cookie/.test(ui)).toBe(false);
    expect(ui.includes("RECOVERY_KEY")).toBe(false);
    expect(read("app/admin/recover/page.tsx").includes("RECOVERY_KEY")).toBe(false);
    const holders = [...walk("app", /\.tsx?$/), ...walk("components", /\.tsx?$/), ...walk("server", /\.ts$/)].filter((f) => read(f).includes("RECOVERY_KEY_HASH"));
    expect(holders.sort()).toEqual(["server/config/env.ts", "server/services/warden-auth.ts"]);
  });
  it("the login screen links to the recovery screen, which is open to the middleware only for that path", () => {
    expect(read("app/admin/login/page.tsx").includes("/admin/recover")).toBe(true);
    expect(read("middleware.ts").includes("/admin/recover")).toBe(true);
  });
});
