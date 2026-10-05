import { NextResponse } from "next/server";
import { z } from "zod";
import { en } from "@/messages/en";
import { DomainError } from "@/server/lib/errors";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

const DOMAIN_STATUS = { validation: 400, not_found: 404, conflict: 409, rate_limited: 429 } as const;

/** Wraps a route handler: known errors become JSON errors, unknown errors never leak details. */
export function apiHandler<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message } },
          { status: err.status, headers: NO_STORE },
        );
      }
      if (err instanceof DomainError) {
        return NextResponse.json(
          { error: { code: err.kind, message: err.message, details: err.details } },
          { status: DOMAIN_STATUS[err.kind], headers: NO_STORE },
        );
      }
      // Log the error type only; messages can contain student/parent data.
      console.error("Unhandled API error:", err instanceof Error ? err.name : "unknown");
      return NextResponse.json(
        { error: { code: "server_error", message: en.http.serverError } },
        { status: 500, headers: NO_STORE },
      );
    }
  };
}

export async function readJson<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "bad_request", en.http.badRequest);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "validation_error", en.http.validation);
  return parsed.data;
}

/** Reads a plain-text body (e.g. CSV) with a hard size limit. */
export async function readText(req: Request, maxBytes: number): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new ApiError(413, "too_large", en.http.tooLarge);
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "too_large", en.http.tooLarge);
  return text;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || req.headers.get("x-real-ip") || "unknown").slice(0, 64);
}
