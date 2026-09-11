# Stamps

Reusable authored layouts live here. Group stamps by the room or world context
that places them, and keep one stamp definition per file.

- `combat/` contains combat-room stamps used by procedural floor generation.
- `reward/` contains guaranteed layouts for room rewards and service buildings.
- `hub/` contains authored hub stamps and their placement list.

Add future categories such as `reward/`, `boss/`, or `traversal/` beside these
folders. Register run-room stamps in `roomStampCatalog.ts`; context-specific
catalogs and placement lists stay inside their category folder.

Combat stamps describe geometry and semantic `contentSlots`, rather than naming
a floor-specific enemy directly. `combat/combatSpawnerProfileCatalog.ts` maps an
enemy or controller to a spawner profile with theme, threat, footprint, delivery,
and budget constraints. The planner resolves a compatible profile deterministically
and stores it in the room plan, so revisiting a room never rerolls its contents.

Add a new spawner variant to the profile catalog instead of copying the stamp. A
profile may require that its enemy already exists in the generated encounter and
may declare minimum companions, which lets the encounter budget remain authoritative.

Large hub floor art is also declared as a stamp. Keep its sprite, placement,
scale, tint, and draw depth together in the hub stamp file so the scene only
decides when to place it.
