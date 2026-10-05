import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------- Enums ----------
export const checkStatus = pgEnum("check_status", ["present", "absent", "other"]);
export const roomAvailability = pgEnum("room_availability", ["available", "full"]);
export const deliveryChannel = pgEnum("delivery_channel", ["whatsapp", "email", "sms"]);
export const enquiryStatus = pgEnum("enquiry_status", ["new", "contacted", "closed"]);
export const loginScope = pgEnum("login_scope", ["warden", "parent"]);

// ---------- Settings (public call/WhatsApp number, hostel info, etc.) ----------
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt(),
});

// ---------- Warden (single account, single active session) ----------
export const wardenAccounts = pgTable(
  "warden_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // DB-level guarantee: at most one warden account row.
    singleton: boolean("singleton").notNull().default(true).unique(),
    loginId: text("login_id").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("warden_accounts_singleton_chk", sql`${t.singleton} = true`)],
);

export const wardenSessions = pgTable(
  "warden_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // DB-level guarantee: at most one active warden session row.
    singleton: boolean("singleton").notNull().default(true).unique(),
    wardenId: uuid("warden_id")
      .notNull()
      .references(() => wardenAccounts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    // Hash of the token that was replaced by the latest login, so the old device can be told
    // "signed in on another device" instead of a generic expiry message.
    previousTokenHash: text("previous_token_hash"),
    createdAt: createdAt(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [check("warden_sessions_singleton_chk", sql`${t.singleton} = true`)],
);

// ---------- Rooms & students (permanent profile data) ----------
export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomNumber: text("room_number").notNull().unique(),
    floor: integer("floor").notNull(),
    capacity: smallint("capacity").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    // Public website status only. Independent of daily checking "vacant".
    publicAvailability: roomAvailability("public_availability").notNull().default("available"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("rooms_capacity_chk", sql`${t.capacity} >= 1`),
    index("rooms_floor_idx").on(t.floor),
  ],
);

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Optional stable code used to match rows on CSV re-import.
    studentCode: text("student_code").unique(),
    name: text("name").notNull(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    parentName: text("parent_name"),
    parentEmail: text("parent_email"),
    parentWhatsapp: text("parent_whatsapp"), // E.164
    secondaryName: text("secondary_name"),
    secondaryEmail: text("secondary_email"),
    secondaryWhatsapp: text("secondary_whatsapp"), // E.164
    studentPhone: text("student_phone"), // E.164
    isActive: boolean("is_active").notNull().default(true),
    deactivatedAt: ts("deactivated_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("students_room_idx").on(t.roomId),
    index("students_parent_whatsapp_idx").on(t.parentWhatsapp),
  ],
);

// ---------- Parents ----------
export const parentAccounts = pgTable("parent_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  mobileE164: text("mobile_e164").notNull().unique(), // Parent login ID
  passwordHash: text("password_hash").notNull(),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  passwordChangedAt: ts("password_changed_at"),
  lastLoginAt: ts("last_login_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Linking is Warden-controlled; the system never auto-links students by phone number.
export const parentStudentLinks = pgTable(
  "parent_student_links",
  {
    parentId: uuid("parent_id")
      .notNull()
      .references(() => parentAccounts.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.parentId, t.studentId] }),
    index("parent_student_links_student_idx").on(t.studentId),
  ],
);

export const parentSessions = pgTable(
  "parent_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => parentAccounts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: createdAt(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [index("parent_sessions_parent_idx").on(t.parentId)],
);

// ---------- Daily checking (30-day retention) ----------
export const dailyChecks = pgTable(
  "daily_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checkDate: date("check_date", { mode: "string" }).notNull(), // IST calendar date
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    roomNumberSnapshot: text("room_number_snapshot").notNull(), // room on that day
    status: checkStatus("status").notNull(),
    stars: smallint("stars"), // Present only
    note: text("note").notNull().default(""),
    // +1 on every status/stars/note edit. Drives "Updated - please acknowledge again"
    // and "Edited after WhatsApp".
    revision: integer("revision").notNull().default(1),
    lastEditedAt: ts("last_edited_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("daily_checks_date_student_uq").on(t.checkDate, t.studentId),
    index("daily_checks_student_date_idx").on(t.studentId, t.checkDate),
    index("daily_checks_date_idx").on(t.checkDate),
    check(
      "daily_checks_stars_chk",
      sql`(${t.status} = 'present' AND ${t.stars} BETWEEN 1 AND 5) OR (${t.status} <> 'present' AND ${t.stars} IS NULL)`,
    ),
    check("daily_checks_other_note_chk", sql`${t.status} <> 'other' OR length(btrim(${t.note})) > 0`),
  ],
);

export const dailyRoomStates = pgTable(
  "daily_room_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checkDate: date("check_date", { mode: "string" }).notNull(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    isVacant: boolean("is_vacant").notNull().default(false),
    isManuallyComplete: boolean("is_manually_complete").notNull().default(false),
    commonNote: text("common_note").notNull().default(""),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("daily_room_states_date_room_uq").on(t.checkDate, t.roomId),
    check("daily_room_states_not_both_chk", sql`NOT (${t.isVacant} AND ${t.isManuallyComplete})`),
  ],
);

export const acknowledgements = pgTable(
  "acknowledgements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dailyCheckId: uuid("daily_check_id")
      .notNull()
      .references(() => dailyChecks.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => parentAccounts.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(), // revision the parent acknowledged
    acknowledgedAt: ts("acknowledged_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("acknowledgements_check_parent_uq").on(t.dailyCheckId, t.parentId)],
);

// Generic so email/SMS can be added later without redesign.
export const deliveryLog = pgTable(
  "delivery_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dailyCheckId: uuid("daily_check_id")
      .notNull()
      .references(() => dailyChecks.id, { onDelete: "cascade" }),
    channel: deliveryChannel("channel").notNull(),
    revision: integer("revision").notNull(), // report revision at the time of the click
    openedAt: ts("opened_at").notNull().defaultNow(),
  },
  (t) => [index("delivery_log_check_idx").on(t.dailyCheckId, t.channel)],
);

// ---------- Enquiries (90-day retention) ----------
export const enquiries = pgTable(
  "enquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    preferredRoomType: text("preferred_room_type"),
    expectedJoiningDate: date("expected_joining_date", { mode: "string" }),
    message: text("message"),
    status: enquiryStatus("status").notNull().default("new"),
    // Keyed hash of the submitter's IP, used only for rate limiting. The raw IP is never stored.
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [index("enquiries_created_idx").on(t.createdAt), index("enquiries_ip_idx").on(t.ipHash, t.createdAt)],
);

// ---------- Login throttling ----------
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: loginScope("scope").notNull(),
    identifier: text("identifier").notNull(),
    ipAddress: text("ip_address").notNull(),
    success: boolean("success").notNull(),
    attemptedAt: ts("attempted_at").notNull().defaultNow(),
  },
  (t) => [
    index("login_attempts_identifier_idx").on(t.scope, t.identifier, t.attemptedAt),
    index("login_attempts_ip_idx").on(t.scope, t.ipAddress, t.attemptedAt),
  ],
);

// ---------- Restore safety backup ----------
// Before any restore, an ENCRYPTED copy of the live data is stored here (latest one only), so a
// mistaken restore can be undone. Never included in backups themselves.
export const safetyBackups = pgTable("safety_backups", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: createdAt(),
  sizeBytes: integer("size_bytes").notNull(),
  dataBase64: text("data_base64").notNull(), // the AES-256 ZIP, base64
});
