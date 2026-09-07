# Hub building concepts — PixelLab

Ten decorative hub buildings, their reusable floating ground pieces, and seven destroyed states. Native transparent sprite canvases range from 64×64 to 256×192.

Redesigned with PixelLab Pro on 2026-09-07 using `public/sprites/companions/burt-house.png` as the direct style reference. PixelLab palette reduction enforces pure black and white without dithering. The buildings inherit Burt's three-quarter top-down view, chunky white roofs and walls, deep black entrances, uneven salvage-built silhouettes, and sparse wear. They should feel inhabited rather than diagrammatic. Introduce them cumulatively so each hub level retains earlier structures.

| Level | Building | Native canvas | Suggested placement and activity |
| --- | --- | --- | --- |
| 1 | Service Shack | 64×64 | Beside the arrival lane, with a small canopy for the emergency repair droid. |
| 1 | Courier Cabin | 96×64 | Near the contract terminal, serving as a lived-in parcel office and courier stop. |
| 1 | Scrap Workshop | 96×96 | On the salvage side, with a wide workshop door and an exterior scrap lean-to. |
| 2 | Smelter House | 128×96 | Behind the salvage forge, combining a furnace workshop with a crooked utility room. |
| 3 | Signal Loft | 96×128 | On the outer rim near the signal array, giving its keeper a tall lookout and home. |
| 4 | Repair Barn | 160×128 | Beside the maintenance wing, with a large dark bay and attached tool sheds. |
| 5 | Fuel Keeper | 128×128 | Along a quieter approach, combining a small dwelling with two protected fuel tanks. |
| 6 | Freight Lodge | 192×128 | Near the gantries, with loading doors, joined cargo sheds, and a staffed side office. |
| 7 | Habitat Row | 192×192 | On the calmer side of the traffic grid, forming a small neighborhood of connected homes. |
| 8 | Watchmaker Hall | 256×192 | Across from the phase station, acting as a late-game guild hall and observatory landmark. |

## Placement principles

Keep the central phase station, existing facility entrances, and travel lanes open. Put larger structures toward the perimeter, with smaller service buildings filling gaps. Treat footprints as the occupied sprite silhouette rather than the full canvas. Keep all sprites at native size initially; decide world scale in a scene review before adding collisions.

Ambient buildings should render dimmer than the player and interactive stations. Use runtime tint on the monochrome artwork; do not bake cyan glow into every roof. Small traffic, lights, or repair activity can communicate restoration progress later.

## Floating foundations

PixelLab generated six purpose-built ground pieces from 96×64 through 256×192. They are broad, angular slabs with visible top surfaces and short broken undersides, avoiding the circular silhouette and crater language of the planet chunks. The palette-constrained sprites are in `foundations-v2/sprites`; their untouched PixelLab outputs are in `foundations-v2/source`.

The ground and building remain separate objects. Render the ground first in a dark blue-gray tint, then place the pure white building above it using the offsets recorded in `manifest.json`. This keeps the settlement modular: one ground size can support several building types, and pieces can be mirrored or recombined without redrawing the structures. The images under `composed` are preview renders only.

Small buildings use the two small slabs. Workshops share the medium slabs. Freight Lodge uses the first large slab, while Habitat Row and Watchmaker Hall use the widest piece.

## Hub progression

Hub level 1 shows Service Shack, Courier Cabin, and Scrap Workshop completed, with seven matching ruins on their ground pieces. Each level from 2 through 8 replaces exactly one ruin with its completed sprite. Plot state is selected once when the hub loads, so the scenery adds no per-frame progression updates.

The 10 buildings, 7 ruins, and 6 ground pieces share `public/sprites/hub/settlement-atlas.png`. The settlement is decorative and has no collisions or interaction prompts.

## Provenance

Generation prompts, native dimensions, level assignments, selected variants, and PixelLab job IDs are in [manifest.json](manifest.json). Destroyed-state jobs are recorded in [ruins-v2/manifest.json](ruins-v2/manifest.json). The rejected overhead set remains in `source` and `sprites` for comparison. Burt-inspired source images are in `source-v2`; final palette-constrained concepts are in `sprites-v2`.

## Review

All building, ruin, and ground images were inspected on a dark background at native size. Dimensions, binary transparency, and monochrome palettes are checked while building the runtime atlas.

Open [the gallery](index.html) to switch between buildings alone and buildings on ground. [The restoration sheet](ruins-contact-sheet.png) compares every ruin with its completed replacement. [The ground-piece sheet](ground-pieces-contact-sheet.png) shows the six reusable slabs, [the combined sheet](foundations-contact-sheet.png) shows all proposed pairings, and [the building sheet](contact-sheet.png) shows the structures alone.
