# Friendly drones — PixelLab migration

Generated with PixelLab Pixen on 2026-09-07 at native 24×24. Prompts specify an overhead, north-facing white mechanical silhouette with black cuts and a transparent background. Roles: twin-gun fighter, missile carrier, narrow interceptor, heavy gunship, repair unit, and salvage claws.

PixelLab reduce_colors forced a shared black/white palette without dithering (jobs f402a508-d92f-48ac-ae2e-a3834d971e30 and e71e41e5-9742-40ee-8671-35335b9654ad). The repository PNG normalizer filled enclosed transparent holes. Runtime files are public/sprites/drone-{role}.png.

| Role | PixelLab generation job |
| --- | --- |
| combat | 02d9e690-3bef-4844-a295-4e0c275357f5 |
| missile | 657b7bf6-28c1-40a9-b505-bf684304813f |
| interceptor | fdd5e11c-8dda-4afe-b482-e7bfcf70d752 |
| gunship | b5d116c3-2d1e-4600-8ef3-1afb63c75ffc |
| medic | dadb4d23-5279-4d8d-967c-2eb3c0997324 |
| salvager | 094bf892-b08c-4482-be57-c20abcc36421 |

The medic was redesigned as a narrow support craft with paired side pods on 2026-09-07. Its palette reduction job is 06533a8b-e6a9-4d7c-ab72-697256d64a19; it replaces only the medic source and cell 3 in the atlas.

## Runtime layout

swarm-atlas.png is 96×184 (extended for hub ships and droids), with four 24px cells per row. Cells 0–5 contain combat, gunship, interceptor, medic, missile, salvager. Cells 6–10 retain the original 16×16 upgrade images at each cell's top-left. src/util.ts records each entry's actual size. Loading order and sprite names are preserved.

World actors render these sprites at 16×16 before their existing role, deployment, and fusion scaling. Standard followers therefore span 15.2–17.92 game units; the player ship canvas spans 19.2. Ambient hub drones also use the compact size. UI previews keep their existing fitting rules.

## Verification

- Production build passes (existing bundler warnings remain).
- All six PNGs and the atlas pass the repository sprite normalizer check. The full check flags 22 unrelated existing PNGs.
- Each drone atlas region matches its source PNG; all five upgrade regions retain their original pixels.
- Reviewed the hub in motion and all six sprites in a Kaplay comparison scene beside the player ship at gameplay scale.
- Hub traces at the same 1280×720 viewport, save, loadout and stationary player position measured 26 calls/frame before and 23 after, over 120 frames each. Ambient animation timing was not locked, so this is a regression spot-check rather than a claimed performance improvement.
