#!/bin/bash
# OFFLINE TEST RUNNER (only for sandboxes with no npm/network).
# Runs the PURE-logic tests under Node's built-in TypeScript stripping with a tiny vitest stand-in
# (it awaits async tests and supports the matchers used in tests/*.test.ts).
# On a normal machine run the real thing instead:  npm test
# Usage: VB_ROOT=$(pwd) bash tools/offline-test-runner.sh backup cleanup ...   (names without .test.ts)
# usage: runtests.sh test1 test2 ...   (names without .test.ts)
set -e
P="${VB_ROOT:-$(pwd)}"
rm -rf /tmp/run && mkdir -p /tmp/run/server/lib /tmp/run/server/config /tmp/run/tests /tmp/run/layouts
cp $P/server/lib/*.ts /tmp/run/server/lib/
cp $P/layouts/*.ts /tmp/run/layouts/ 2>/dev/null || true
cp $P/server/config/retention.ts /tmp/run/server/config/
for t in "$@"; do cp $P/tests/$t.test.ts /tmp/run/tests/; done
cd /tmp/run
sed -i -E 's#from "\./([a-z0-9-]+)"#from "./\1.ts"#; s#from "\.\./config/([a-z0-9-]+)"#from "../config/\1.ts"#' server/lib/*.ts layouts/*.ts 2>/dev/null || true
sed -i -E 's#from "@/server/lib/([a-z0-9-]+)"#from "../server/lib/\1.ts"#; s#from "@/layouts/([a-z0-9-]+)"#from "../layouts/\1.ts"#; s#from "vitest"#from "../vitest-shim.mjs"#' tests/*.ts
cat > vitest-shim.mjs <<'EOS'
import assert from "node:assert/strict";
let pass = 0, fail = 0, current = "";
export function describe(name, fn) { current = name; fn(); }
const pending = [];
export function it(name, fn) {
  const label = current;
  const bad = (e) => { fail++; console.log("FAIL:", label, "›", name, "\n ", String(e && e.message || e).split("\n").slice(0,3).join(" | ")); };
  try {
    const r = fn();
    if (r && typeof r.then === "function") pending.push(r.then(() => { pass++; }, bad));
    else pass++;
  } catch (e) { bad(e); }
}
export function expect(v) { return {
  toBe: (x) => assert.strictEqual(v, x),
  toEqual: (x) => assert.deepStrictEqual(v, x),
  toBeNull: () => assert.strictEqual(v, null),
  toBeUndefined: () => assert.strictEqual(v, undefined),
  toBeTruthy: () => assert.ok(v),
  toHaveLength: (n) => assert.strictEqual(v.length, n),
  toContain: (x) => assert.ok(v.includes(x), `expected ${JSON.stringify(v)} to contain ${x}`),
  toThrow: () => assert.throws(v),
  toBeGreaterThan: (x) => assert.ok(v > x),
  toBeLessThan: (x) => assert.ok(v < x),
  rejects: { toThrow: async () => { await assert.rejects(v); }, toBeInstanceOf: async (c) => { await assert.rejects(v, (e) => e instanceof c); } },
}; }
export const report = async () => { await Promise.all(pending); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); };
EOS
{ echo 'import {report} from "./vitest-shim.mjs";'; for t in "$@"; do echo "await import(\"./tests/$t.test.ts\");"; done; echo 'await report();'; } > run.mjs
node run.mjs 2>&1 | grep -v -E "MODULE_TYPELESS|Reparsing|To eliminate|trace-warnings"
