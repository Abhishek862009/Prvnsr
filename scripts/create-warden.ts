/**
 * Creates the single Warden account. Credentials are read from the environment at run time
 * and are never stored in the repo:
 *   WARDEN_LOGIN_ID=... WARDEN_PASSWORD=... npm run warden:create
 */
import { checkPasswordPolicy, hashPassword } from "@/server/auth/password";
import { createWarden, findSoleWarden } from "@/server/repos/warden";

async function main() {
  const loginId = (process.env.WARDEN_LOGIN_ID ?? "").trim().toLowerCase();
  const password = process.env.WARDEN_PASSWORD ?? "";
  if (!loginId) throw new Error("WARDEN_LOGIN_ID is required.");
  if (checkPasswordPolicy(password)) throw new Error("WARDEN_PASSWORD must be 8-128 characters.");
  if (await findSoleWarden()) throw new Error("A Warden account already exists. Use the recovery key flow to reset the password.");

  await createWarden(loginId, await hashPassword(password));
  console.log(`Warden account "${loginId}" created.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : "unknown error");
  process.exit(1);
});
