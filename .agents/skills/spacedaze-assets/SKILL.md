---
name: spacedaze-assets
description: Create, import, edit, or register SpaceDaze sprites, textures, fonts, music, and sound effects while preserving the game's 1-bit pixel-art style and Kaplay draw batching. Use whenever work adds or changes files under public/sprites, public/sounds, or public/fonts, or changes their loading in src/util.ts.
---

# SpaceDaze Assets

Keep new assets visually consistent, correctly registered, and cheap to render.

## Inspect before creating

- Inspect nearby assets serving the same purpose before generating or editing anything. Compare canvas size, occupied pixel area, silhouette, line weight, palette, transparency, and animation layout.
- Inspect the asset in its real game context when practical. A sprite that looks good enlarged may be noisy or illegible at its rendered size.
- Preserve SpaceDaze's restrained 1-bit pixel-art language. Prefer a strong silhouette and a few readable internal marks over fine texture, antialiasing, gradients, or dense detail.
- Reuse an established canvas size and palette for the asset category unless gameplay requires otherwise. Gameplay icons and many actors are normally 16x16 transparent PNGs; verify the relevant neighboring files instead of assuming.
- Keep source/reference previews separate from runtime assets. Do not register contact sheets, mockups, or large previews as game sprites.

## Add raster sprites

1. Put the PNG beside assets of the same category under `public/sprites` and follow their naming style.
2. Check its actual dimensions with `file <path>` or another image metadata tool.
3. Register it in `src/util.ts` with a stable, descriptive Kaplay sprite name.
4. Keep registration order deterministic. Do not depend on filesystem enumeration order.
5. Render it at intended scale and visually verify transparency, pixel sharpness, silhouette, and alignment.

Prefer explicit atlases for a growing group of same-purpose sprites that are frequently rendered together. Group atlases by render category and compatible dimensions rather than combining unrelated art merely to reduce file count.

## Protect Kaplay batching

Kaplay's automatic atlas packing is sensitive to sprite dimensions and load order. An unused sprite registration can still change atlas layout and increase draw calls throughout gameplay.

- Preserve the established contiguous loading run for common gameplay sprites in `src/util.ts`.
- Never insert a differently sized sprite into the middle of that run. Append unusual-sized sprites after the existing gameplay/background registrations, or place a coherent group in an explicit atlas.
- Keep sprites that render together compatible in format and dimensions where the art permits.
- Treat an asset-only draw-call regression as a likely atlas-packing problem before rewriting rendering systems.
- When moving registrations, preserve asset names and paths so callers do not change.

This invariant comes from a measured regression: loading the 24x24 Burt sprite directly after a 16x16 ship changed the same scene from about 24.5 to 50.8 draw calls per frame. Moving Burt after the established sprite-loading groups restored the original count. The measured fact is the load-order effect; do not overstate undocumented Kaplay internals beyond that evidence.

## Add audio

- Put runtime audio under `public/sounds` and register it in the existing sound-loading section of `src/util.ts`.
- Use a stable semantic sound name so gameplay code does not encode filenames or providers.
- Trim unnecessary silence and overly long tails when they hurt responsiveness or download size. Make loops seamless when the sound repeats.
- Normalize perceived loudness for the intended use, then control situational volume in code. Avoid baking extreme gain into the file.
- Record the source, creator, and attribution/license information where the project's credits data is maintained. A free or private game does not remove licensing obligations.
- Do not download or redistribute an asset unless its license permits the intended use.

## Verify changes

- Run `npm run build` after registrations or asset-path changes.
- Exercise the scene that renders the asset and check for missing-sprite errors, bad scale, unwanted filtering, and visual mismatch.
- For sprite additions or loader-order changes, compare draw calls in the same scene using the same viewport, seed/state, and loadout before and after. Object count alone is not a valid comparison.
- If draw calls rise unexpectedly, first move the new registration to the end of its compatible group or after the main sprite groups and rerun the controlled comparison. If the asset belongs to a repeated set, evaluate an explicit atlas.
- Report both visual verification and performance verification when the change could affect batching.
