---
name: spacedaze-art-style
description: Design, generate, edit, or review SpaceDaze sprites, environments, effects, and game UI according to the project's visual language. Use when deciding how new visual content should look, when redesigning art that feels inconsistent, or when evaluating whether a visual belongs in SpaceDaze.
---

# SpaceDaze Art Style

SpaceDaze is a stark, lo-fi space salvage game: bright, readable pixel silhouettes drift over a near-black ruined world, with cold cyan system UI and small bursts of semantic color. It should feel lonely, mechanical, damaged, and tactile rather than clean or glossy.

Use this skill for art direction. When adding files or registering them in Kaplay, also follow the `spacedaze-assets` skill.

## Visual hierarchy

Maintain three deliberate detail levels:

1. **Gameplay actors and icons:** Very compact, high-contrast, and readable during motion. Their silhouette matters more than internal detail.
2. **Interactive structures and props:** More detail is allowed, but the important shape and interaction point must remain obvious at gameplay zoom.
3. **Background ruins and planets:** These can be large and textural, but should use dark blue-gray values so they support navigation without competing with actors, projectiles, or prompts.

Do not apply the dense detail of a 256x256 facility to a 16x16 drone or pickup. At tiny sizes, simplify aggressively.

## Palette and contrast

- The world foundation is black and near-black blue.
- Player ships, drones, enemies, projectiles, outlines, and important silhouettes are primarily white or pale gray.
- Background art lives in subdued navy and blue-gray, often barely above the void.
- Cyan is the system/UI accent and communicates focus, selection, progress, and interactability.
- Use color as information, not decoration: green for positive/safe outcomes, red for danger or critical damage, yellow/gold for valuable salvage, and rarity colors for reward feedback.
- Keep colored accents small enough that white silhouettes remain the game's identity.
- Avoid broad full-spectrum palettes, painterly shading, smooth gradients, and realistic lighting. Glows and distortion should behave like restrained game feedback rather than changing the base art style.

Use the canonical UI values from `src/ui/common/theme.ts`; do not approximate them by eye when building UI.

## Pixel construction

- Use hard pixel edges and transparent backgrounds. Do not antialias sprite contours.
- Work on the intended runtime canvas, commonly 16x16 for gameplay sprites and icons. Do not create a detailed large illustration and shrink it down as the final pixel-art workflow.
- Favor connected pixel clusters, stepped diagonals, and purposeful single-pixel highlights.
- Reserve isolated pixels for sparks, stars, debris, or a clearly intentional highlight. Random isolated pixels make small sprites look noisy.
- Use one-pixel negative-space cuts to separate wings, tools, eyes, barrels, or mechanical joints.
- Keep the center of mass legible. A sprite should still communicate its role when viewed at 1x without zooming.
- Symmetry is useful for ships, stations, and machinery, but one or two asymmetrical damage marks can sell the ruined setting.

## Category rules

### Ships, enemies, and drones

- Use a strong top-down silhouette with a clear forward direction.
- Build the outer contour first, then add only the interior pixels needed to communicate cockpit, engine, weapon, armor, or role.
- Keep normal drones white; distinguish their jobs through silhouette and motion rather than arbitrary body colors.
- Enemy families should share construction language while having distinct attack silhouettes. For example, a rammer should read heavier and more pointed than a support drone.
- Lean, recoil, flashes, trails, and particles provide motion. Do not bake motion blur into the sprite.

Reference: `public/sprites/ship-v2.png`, `public/sprites/enemies/rammer.png`, `public/sprites/drone-medic.png`, and `public/sprites/companions/burt.png`.

### Upgrades, weapons, pickups, and emotes

- Communicate one idea with one bold symbol. At 16x16, remove anything that does not help recognition.
- Prefer negative space and a recognizable outer shape over tiny texture.
- Show rarity through the surrounding UI, shine, particles, or tint unless color is intrinsic to the object. Do not make separate art styles for each rarity.
- Emotes should read instantly as punctuation or expression above a moving character.

Reference: `public/sprites/upgrades/critical_shatter_upg1.png`, `public/sprites/salvage-asteroids/salvage-asteroid-rich.png`, and `public/sprites/emotes/emote_question.png`.

### Facilities and environments

- Large structures may use dense mechanical line work, repeated modules, rings, ports, broken panels, and exposed machinery.
- Preserve a bold overall silhouette beneath the detail. The structure should be identifiable when zoomed out.
- Use value hierarchy: interactive edges and focal mechanisms may approach white, while most surface detail stays gray.
- Ruins, planets, and rock chunks should feel eroded and irregular, with large dark masses breaking up the texture.
- Destructible rock must look related to ordinary rock while offering a subtle readable clue through cracks, embedded salvage, or edge treatment.

Reference: `public/sprites/facilities/v3/facility-phase-station.png`, `public/sprites/planet-chunks/planet-chunk-3.png`, and `public/sprites/bg/destroyed-planet.png`.

### Interface

- Build interface layouts from the component library under `src/ui/common`; do not redraw one-off versions of panels, buttons, prompts, or progress bars.
- Use the `unscii` bitmap font, uppercase labels, concise copy, strong alignment, and generous empty space.
- Panels are near-black with thin cyan or blue-gray borders. Hierarchy comes from spacing, size, rules, and accent color—not gradients or ornamental frames.
- Use the input-prompt sprite resources for keys and mouse buttons instead of typing bracketed key labels.
- Containers should size to their content and remain readable at supported viewport sizes.
- Interaction prompts should be minimal. Prefer the action plus its key sprite; do not repeat an NPC or object name when the context already identifies it.

Reference: `src/ui/common/theme.ts`, the components under `src/ui/common`, and `public/sprites/input-prompts`.

## Effects and animation

- Add juice with short pixel flashes, small explosions, chunky debris, recoil, squash/lean, screen shake, and brief distortion.
- Effects should peak quickly and clear completely. Lingering full-screen distortion or dense particles obscure the 1-bit readability.
- Scale intensity by gameplay importance and rarity. Common feedback is quick and restrained; rare reveals can pause, ramp up, shake, shine, and burst more strongly.
- Use larger but fewer readable shards instead of clouds of tiny visual noise.
- Keep background animation slower and dimmer than combat feedback.

## Review checklist

Before accepting new art, view it at native size and in the actual scene. Ask:

- Does the silhouette explain what it is before the internal detail is examined?
- Is its detail density appropriate for its runtime size and visual layer?
- Does it remain readable over the dark environment during motion?
- Are white, cyan, and semantic colors being used for information?
- Does it look pixel-built rather than like a smooth image reduced to pixels?
- Does it reuse the nearest category's canvas, scale, and visual vocabulary?
- Is the background supporting the gameplay subject instead of competing with it?

If the answer is unclear, simplify the sprite before adding more detail.
