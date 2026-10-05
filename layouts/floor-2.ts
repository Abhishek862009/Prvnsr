import type { FloorLayout } from "./types";

// DUMMY layout. Replace with the real plan later (data only).
export const floor2: FloorLayout = {
  floor: 2,
  width: 1000,
  height: 520,
  corridors: [{ x: 20, y: 220, w: 960, h: 80 }],
  walls: [
    { x1: 20, y1: 20, x2: 980, y2: 20 },
    { x1: 980, y1: 20, x2: 980, y2: 500 },
    { x1: 980, y1: 500, x2: 20, y2: 500 },
    { x1: 20, y1: 500, x2: 20, y2: 20 },
    { x1: 20, y1: 220, x2: 980, y2: 220 },
    { x1: 20, y1: 300, x2: 980, y2: 300 },
  ],
  features: [
    { label: "Washroom", x: 20, y: 20, w: 140, h: 200 },
    { label: "Stairs", x: 600, y: 20, w: 140, h: 200 },
    { label: "Balcony", x: 540, y: 300, w: 440, h: 200 },
  ],
  rooms: [
    { roomNumber: "201", x: 160, y: 20, w: 220, h: 200 },
    { roomNumber: "202", x: 380, y: 20, w: 220, h: 200 },
    { roomNumber: "203", x: 740, y: 20, w: 240, h: 200 },
    { roomNumber: "204", x: 20, y: 300, w: 260, h: 200 },
    { roomNumber: "205", x: 280, y: 300, w: 260, h: 200 },
  ],
};
