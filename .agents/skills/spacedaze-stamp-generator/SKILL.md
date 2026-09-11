---
name: spacedaze-stamp-generator
description: Create, extend, or review SpaceDaze room and hub stamps, including their local hex geometry, compatibility, semantic content, catalog registration, generation tests, and in-game console verification. Use when work adds a reusable authored layout under src/stamps or changes how a stamp is selected, placed, or rendered.
---

# SpaceDaze Stamp Generator

Build stamps as authored local layouts that the generator can rotate, validate, and place deterministically.

## Choose the stamp context

- Run-room stamps belong under `src/stamps/<purpose>/`, use `RoomStampDefinition`, and register in `src/stamps/roomStampCatalog.ts` plus the `RoomStampId` union in `src/generation/rooms/roomFloorTypes.ts`.
- Hub stamps belong under `src/stamps/hub/` and use the hub catalog and placement types. Follow the nearest existing hub stamp rather than adapting run-room selection rules.
- Keep one definition per file. Use local axial coordinates centered on `{ q: 0, r: 0 }`; runtime placement and rotation are handled by the planner.

Read `src/stamps/README.md`, `src/stamps/roomStampTypes.ts`, and one analogous stamp before editing. Inspect `src/generation/rooms/roomStampPlanner.ts` when changing compatibility, selection, rotation, overlap, content resolution, or persistence behavior.

## Author a run-room stamp

1. Define its gameplay purpose, eligible room kinds and themes, subfloor range, room radius, connection count, and port requirements before drawing cells.
2. Choose `primary` when the stamp controls the room layout. Choose `overlay` for a small composable addition that can coexist with a primary stamp.
3. Declare `cells` as open or wall terrain. Keep every cell and mechanic strictly inside the minimum compatible room radius. Preserve door routes unless blocking them is deliberate and verified.
4. Put behavior in semantic `mechanics` or `contentSlots`; do not hide gameplay objects in rendering code. Add a narrow union member when the existing schema cannot represent the new behavior.
5. Use `selection.required` only for a room kind whose identity depends on that stamp, such as a service building. Optional combat layouts should remain weighted and respect repeat cooldowns.
6. Register the definition in the typed catalog and update generation/runtime code only where the new semantic content requires it.

For a building or other grounded object, include its complete open-cell footprint in the stamp and provide a `world-object-anchor`. `createRoomGroundCells` treats open stamp cells as mandatory ground, so do not restore a separate floating foundation beneath the object.

## Verify generation

Add or update seeded tests for meaningful invariants: compatible room kinds, valid rotations and ports, preserved door paths, non-overlapping reserved cells, deterministic selection, resolved content, and required ground coverage. Avoid tests that only repeat literal catalog data.

Run:

```bash
npm run test:room-floors
npm run build
git diff --check
```

If the stamp adds assets, also apply the `spacedaze-assets` skill and its asset and draw-call checks.

## Verify in game with the command console

Start the dev server and open a generated run. Toggle the command console with backtick, `§`, or `0`, then use:

```text
stamp list
stamp current
stamp <stamp-id>
```

`stamp <stamp-id>` jumps to the first generated room containing that stamp. If the active seed does not contain an optional stamp, run `map <positive-seed>` and try the stamp command again. Required stamps should be present on every floor containing their compatible room kind.

Close the console and inspect the complete room at gameplay zoom. Verify geometry, routes to every door, actor and mechanic placement, collision, draw depth, shadows, and ground beneath grounded objects. Exercise the mechanic once and re-enter the room when persistence matters. State that visual verification passed only after actually inspecting the scene.
