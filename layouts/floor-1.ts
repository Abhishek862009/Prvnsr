import type { FloorLayout } from "./types";

// DUMMY layout. Replace with the real plan later (data only).
export const floor1: FloorLayout = {
  floor: 1,
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
    { label: "Stairs", x: 20, y: 20, w: 120, h: 200 },
    { label: "Washroom", x: 800, y: 20, w: 180, h: 200 },
    { label: "Stairs", x: 20, y: 300, w: 120, h: 200 },
    { label: "Common Area", x: 580, y: 300, w: 400, h: 200 },
  ],
  rooms: [
    { roomNumber: "101", x: 140, y: 20, w: 220, h: 200 },
    { roomNumber: "102", x: 360, y: 20, w: 220, h: 200 },
    { roomNumber: "103", x: 580, y: 20, w: 220, h: 200 },
    { roomNumber: "104", x: 140, y: 300, w: 220, h: 200 },
    { roomNumber: "105", x: 360, y: 300, w: 220, h: 200 },
  ],
};
