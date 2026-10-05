import { floor1 } from "./floor-1";
import { floor2 } from "./floor-2";
import type { FloorLayout } from "./types";

// Register every floor plan here. Adding a floor = add a file + one line.
export const floorLayouts: readonly FloorLayout[] = [floor1, floor2];

export const getFloorLayout = (floor: number): FloorLayout | null => floorLayouts.find((l) => l.floor === floor) ?? null;
