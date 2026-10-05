/**
 * Prints the value to store in the RECOVERY_KEY_HASH environment variable.
 * The recovery key itself is never stored anywhere; keep it somewhere safe offline.
 */
import { createInterface } from "node:readline/promises";
import { hashPassword } from "@/server/auth/password";

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const key = (await rl.question("Enter the Master Recovery Key (16+ characters): ")).trim();
  rl.close();
  if (key.length < 16) throw new Error("Recovery key must be at least 16 characters.");

  const hash = await hashPassword(key);
  console.log("\nRECOVERY_KEY_HASH (base64, safe for .env and hosting dashboards):\n");
  console.log(Buffer.from(hash, "utf8").toString("base64"));
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : "unknown error");
  process.exit(1);
});
