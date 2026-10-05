function codeOf(e: unknown): string | undefined {
  if (typeof e === "object" && e !== null && "code" in e) {
    const c = (e as { code: unknown }).code;
    if (typeof c === "string") return c;
  }
  return undefined;
}

/** Postgres unique_violation (23505), also when wrapped by Drizzle's query error. */
export function isUniqueViolation(err: unknown): boolean {
  if (codeOf(err) === "23505") return true;
  const cause = typeof err === "object" && err !== null ? (err as { cause?: unknown }).cause : undefined;
  return codeOf(cause) === "23505";
}
