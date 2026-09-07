# Primary weapon icons — PixelLab

The ten live primary weapon icons were generated at their native 32×32 size
with PixelLab on 2026-09-07. Every selected sprite is transparent, grayscale,
and north-facing: its muzzle points to the top of the canvas and its mounting
base sits at the bottom.

| Weapon | PixelLab job | Generation approach |
| --- | --- | --- |
| Standard Blaster | `d9c41757-f883-4aed-bbee-e1c7fe4513df` | Pixen text-to-image |
| Pulse Repeater | `63ff771e-1590-48f2-b92d-743bce87f290` | Pixen orientation edit |
| Twin Needle | `299e484e-2da3-4c65-a345-20269e794375` | Pixen orientation edit |
| Impact Driver | `0593013e-09f2-41fb-9128-24cd8474e00a` | Pixen orientation edit |
| Breach Cannon | `fc069e50-64f7-40c9-9269-531a2289f16a` | Pixen orientation edit |
| Arc Carbine | `41b5b734-ea5d-4162-8536-68e1015fb502` | Pixen orientation edit |
| Scatter Array | `bfeb5fc1-94a1-4f4c-a430-cbf2b650a833` | Pixen orientation edit |
| Burst Driver | `caac0fcd-8d5b-487d-9480-892a5d6e556d` | Pixen orientation edit |
| Plasma Mortar | `95331a6c-a02c-4ecf-9bce-662a542128d7` | Pixflux with shared palette |
| Rail Lance | `13bc8af1-9599-4b27-b2b5-57f51ea1aea6` | Pixen text-to-image |

The Standard Blaster output supplied the grayscale palette for the Pixflux
icons. Several first-pass Pixen designs were detailed but side-facing, so a
second PixelLab edit pass reoriented them north while preserving their richer
32px construction.

Runtime assets live in `public/sprites/weapons`. Weapons that previously used
16×16 sprites have their mount scale halved so the new art keeps the same
approximate size on the player ship.
