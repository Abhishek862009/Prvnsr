const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Session lifetimes (defaults; change here only).
export const WARDEN_SESSION = { idleMs: 2 * HOUR, absoluteMs: 12 * HOUR } as const;
export const PARENT_SESSION = { idleMs: 7 * DAY, absoluteMs: 30 * DAY } as const;

/** Only write last_seen_at when it is older than this, to avoid a write per request. */
export const SESSION_TOUCH_INTERVAL_MS = MINUTE;

// Login throttling (DB-backed, because serverless memory is not reliable).
export const THROTTLE = {
  windowMs: 15 * MINUTE,
  maxFailuresPerIdentifier: 5,
  maxFailuresPerIp: 20,
} as const;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
