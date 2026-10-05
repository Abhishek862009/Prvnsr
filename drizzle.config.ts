import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dbCredentials: { url },
  strict: true,
});
