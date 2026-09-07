# Chest sprites — PixelLab redesign

The salvage chest and weapon chest each use separate native map and opening-window sprites, plus an opened map state. All six assets are transparent, hard-edged, and reduced to SpaceDaze's pure black-and-white palette without dithering.

| Chest | Context | Size | PixelLab generation job | Palette job |
| --- | --- | ---: | --- | --- |
| Salvage cache | Map | 32×32 | 65f4cfc7-6fc4-48b3-aa5c-0f08b26391b2 | fb57cf00-bcc7-4389-948f-4c73f837c88a |
| Salvage cache | Opening window | 64×64 | d3801ad2-ceea-4df3-80cc-e6be872fc6ce | 54d7a9d2-c22d-4088-99ac-c8a51fd7b079 |
| Weapon cache | Map | 32×32 | 3f84618b-3540-4e0c-87be-903ef1501d23 | 964d0af8-3f9a-469b-aac9-b52ef461565a, frame 0 |
| Weapon cache | Opening window | 64×64 | 477138f4-08a9-46a4-a8e0-1f649ac4356d | 8cd5825d-f15d-4ff4-a2f2-7a87d12aa0b6, frame 1 |
| Open salvage cache | Map | 32×32 | cc3cc3fd-aafe-4512-8978-fcabb747d526, frame 0 | Local one-bit contrast mapping |
| Open weapon cache | Map | 32×32 | bbc9b3d8-c1c2-4a7d-a11f-a90eaa2a8bd0 (edit of closed cache) | 964d0af8-3f9a-469b-aac9-b52ef461565a, frame 1 |

The salvage cache is an angular orbital cargo pod with a recessed service panel, pressure clamps, and a mechanical latch. It deliberately avoids the curved wooden-lid language of a fantasy treasure chest. The weapon cache uses a heavier armory silhouette, reinforced lid panels, and a prominent lock. Its closed and open map states share the salvage cache's right-facing oblique perspective; the open state was edited directly from the closed source to preserve its position and footprint.

Runtime assets live under `public/sprites/chests`. `spawnChest` selects the 32px world sprite by reward type, and the opening sequence selects the matching 64px UI sprite. Weapon chests no longer place a separate blaster icon over the ordinary chest. The old `crate1` registration remains in its original loader position only to avoid disturbing the established automatic atlas layout.

Opening a chest swaps its world sprite to the matching empty open state instead of destroying the object. Each open frame keeps the closed cache's facing and footprint, with the existing lid raised on its far-edge hinge. The spent shell stays in the level at reduced opacity, with its interaction radius, callback, aura, ring, and continuous sparkle emitter disabled.

## Verification

- All six files have their intended 32×32 and 64×64 dimensions and pass the repository PNG normalizer.
- Visual review covered native size and enlarged nearest-neighbor rendering on black.
- A controlled 120-frame roster with 84 sprites and six labels remains at 12.0 draw calls per frame after the four registrations were appended.
- The production build passes with the existing Vite warnings.
