// Every renderer, collider and displayed unit uses this same physical scale.
export const WORLD_SCALE = 10; // world units per metre
export const PERSON = Object.freeze({ height:17.2, radius:2.6, walkSpeed:14, reverseSpeed:9 });
export const SCOOTER = Object.freeze({ length:20, width:6.8, occupiedWidth:8.6, maxSpeed:72, reverseSpeed:28 });
export const CAR = Object.freeze({ length:44, width:18, mirrorWidth:21, height:15 });
export const BUILDING = Object.freeze({ groundFloorHeight:32, upperFloorHeight:30, doorHeight:22 });
export const toMetres = units => units / WORLD_SCALE;
export const toKmh = unitsPerSecond => unitsPerSecond / WORLD_SCALE * 3.6;
