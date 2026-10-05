import { toPublicRooms, type PublicRoom, type PublicSettings } from "@/server/lib/public-data";
import * as roomsRepo from "@/server/repos/rooms";
import { getPublicSettings } from "./settings";

export type PublicAvailability = { rooms: PublicRoom[]; settings: PublicSettings };

/**
 * The ONLY data the public API/pages read about rooms: room number + manual Available/Full.
 * Independent of student counts and of daily checking (vacant/green/red).
 */
export async function getPublicAvailability(): Promise<PublicAvailability> {
  const [rows, settings] = await Promise.all([roomsRepo.listPublicRooms(), getPublicSettings()]);
  return { rooms: toPublicRooms(rows), settings };
}

/** For pages: never let a brief database problem take the whole public site down. */
export async function getPublicAvailabilitySafe(): Promise<PublicAvailability | null> {
  try {
    return await getPublicAvailability();
  } catch {
    return null;
  }
}
