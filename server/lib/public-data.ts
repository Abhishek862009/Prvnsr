import { deriveFloor } from "./rooms";

/**
 * WHITELIST of what the public website may ever receive. Every public response is built through
 * these mappers, so a field that is not named here cannot leak - even if a query returns more.
 */
export type PublicRoom = { roomNumber: string; status: "available" | "full" };
export type PublicSettings = { callNumber: string | null; whatsappNumber: string | null };

export function toPublicRoom(row: { roomNumber: string; publicAvailability: string }): PublicRoom {
  return { roomNumber: row.roomNumber, status: row.publicAvailability === "available" ? "available" : "full" };
}

export const toPublicRooms = (rows: readonly { roomNumber: string; publicAvailability: string }[]): PublicRoom[] => rows.map(toPublicRoom);

const E164 = /^\+[1-9]\d{7,14}$/;
const valid = (v: string | null | undefined): string | null => (v && E164.test(v) ? v : null);

export function sanitizePublicSettings(raw: { callNumber?: string | null; whatsappNumber?: string | null }): PublicSettings {
  return { callNumber: valid(raw.callNumber), whatsappNumber: valid(raw.whatsappNumber) };
}

export function groupRoomsByFloor(rooms: readonly PublicRoom[]): { floor: number; rooms: PublicRoom[] }[] {
  const map = new Map<number, PublicRoom[]>();
  for (const r of rooms) {
    const floor = deriveFloor(r.roomNumber) ?? 0;
    map.set(floor, [...(map.get(floor) ?? []), r]);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([floor, list]) => ({ floor, rooms: list }));
}

export const telHref = (e164: string) => `tel:${e164}`;
