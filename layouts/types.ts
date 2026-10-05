/**
 * Floor plans are DATA. To use the real hostel plan, edit the floor-N.ts files only;
 * no application code changes. Units are abstract canvas units (scaled to the screen).
 * Every room tile points to a Room Number that must exist in the database.
 */
export type Rect = { x: number; y: number; w: number; h: number };

export type FloorLayout = {
  floor: number;
  width: number;
  height: number;
  corridors: Rect[];
  walls: { x1: number; y1: number; x2: number; y2: number }[];
  features: (Rect & { label: string })[]; // stairs, washrooms, etc. (decorative)
  rooms: (Rect & { roomNumber: string })[];
};
