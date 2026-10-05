import { cookies } from "next/headers";
import { cookieName, type SessionKind } from "./cookie-names";

const base = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
});

export async function setSessionCookie(kind: SessionKind, token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set({ name: cookieName(kind), value: token, expires: expiresAt, ...base() });
}

export async function clearSessionCookie(kind: SessionKind): Promise<void> {
  (await cookies()).set({ name: cookieName(kind), value: "", maxAge: 0, ...base() });
}

export async function readSessionToken(kind: SessionKind): Promise<string | undefined> {
  return (await cookies()).get(cookieName(kind))?.value;
}
