import { z } from "zod";
import { ApiError } from "./api";
import { en } from "@/messages/en";

const optText = z.string().max(200).nullish();

const studentFields = {
  studentCode: optText,
  name: z.string().max(200).nullish(),
  parentName: optText,
  parentEmail: optText,
  parentWhatsapp: optText,
  secondaryName: optText,
  secondaryEmail: optText,
  secondaryWhatsapp: optText,
  studentPhone: optText,
};

const uuid = z.string().uuid();

export const studentCreateSchema = z.object({ ...studentFields, roomId: uuid });
export const studentPatchSchema = z.object(studentFields).strict();
export const moveSchema = z.object({ roomId: uuid });
export const activeSchema = z.object({ isActive: z.boolean() });

export const roomCreateSchema = z.object({
  roomNumber: z.string().max(10),
  capacity: z.number().int(),
});
export const roomPatchSchema = z
  .object({
    roomNumber: z.string().max(10).optional(),
    capacity: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const studentQuerySchema = z.object({
  q: z.string().max(100).optional(),
  roomId: uuid.optional(),
  status: z.enum(["active", "inactive", "all"]).default("active"),
});

export function parseUuid(value: string): string {
  const r = uuid.safeParse(value);
  if (!r.success) throw new ApiError(404, "not_found", en.http.notFound);
  return r.data;
}

/** Import mode from ?mode=create|update. Defaults to "create" (the non-overwriting mode). */
export function importModeFromUrl(url: string): "create" | "update" {
  const raw = new URL(url).searchParams.get("mode") ?? "create";
  const r = z.enum(["create", "update"]).safeParse(raw);
  if (!r.success) throw new ApiError(400, "validation_error", en.http.validation);
  return r.data;
}

// ---- daily checking ----
export const checkSaveSchema = z.object({
  entries: z
    .array(
      z.object({
        studentId: uuid,
        status: z.string().max(20).nullish(),
        stars: z.number().nullish(),
        note: z.string().max(2000).nullish(),
      }),
    )
    .max(20),
  commonNote: z.string().max(2000).nullish(),
  confirmEdit: z.boolean().optional(),
});
export const vacantSchema = z.object({ isVacant: z.boolean() });
export const completeSchema = z.object({ isComplete: z.boolean() });
export const floorParamSchema = z.coerce.number().int().min(0).max(50);

// ---- parent portal ----
export const acknowledgeSchema = z.object({ revision: z.number().int().min(1) });
export const rangeQuerySchema = z.object({ range: z.enum(["7", "30", "all"]).default("30") });

// ---- today's reports / WhatsApp ----
export const whatsappOpenSchema = z.object({ revision: z.number().int().min(1) });
export const reportFilterSchema = z.enum(["all", "needs_whatsapp"]).catch("all");

// ---- public site / enquiries / settings ----
const enquiryText = z.string().max(2000).nullish();
export const publicEnquirySchema = z.object({
  name: enquiryText,
  phone: enquiryText,
  email: enquiryText,
  preferredRoomType: enquiryText,
  expectedJoiningDate: enquiryText,
  message: enquiryText,
  website: z.string().max(500).nullish(), // honeypot: real visitors never fill it
});
export const enquiryStatusSchema = z.enum(["new", "contacted", "closed"]);
export const enquiryPatchSchema = z.object({ status: enquiryStatusSchema });
export const enquiryListQuerySchema = z.enum(["new", "contacted", "closed"]).optional().catch(undefined);
export const settingsSchema = z
  .object({ callNumber: z.string().max(32).nullish(), whatsappNumber: z.string().max(32).nullish() })
  .strict();
export const availabilitySchema = z.object({ availability: z.enum(["available", "full"]) });

// ---- backup ----
export const backupDownloadSchema = z.object({ password: z.string().min(1).max(256), confirmPassword: z.string().min(1).max(256) });

// ---- parent account management (Warden) ----
export const parentCreateSchema = z.object({
  mobile: z.string().min(1).max(32),
  temporaryPassword: z.string().min(1).max(128),
  studentIds: z.array(uuid).max(20).default([]),
});
export const parentMobileSchema = z.object({ mobile: z.string().min(1).max(32) });
export const parentPasswordSchema = z.object({ temporaryPassword: z.string().min(1).max(128) });
export const parentLinkSchema = z.object({ studentId: uuid });
