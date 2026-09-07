# Hub residents — PixelLab sprites

Ring Runner, Range Keeper, Gloom, and Jubilee use native 32×32 spacecraft with cockpits, wings, and engines. Their roles are explorer, patrol, cargo, and courier. Lamp Keeper and the repair crew remain compact 24×24 utility droids.

Generated with PixelLab Pixen on 2026-09-07, overhead and north-facing. Palette reduction forces pure black and white with no dithering. The repository normalizer fills enclosed transparent holes and preserves binary alpha.

Orientation review corrected Jubilee with a lossless 180-degree rotation of its source and atlas region: its pointed nose now faces north, with the exhaust below. The other three ship hulls already face north. Future generated directional sprites must follow the north-facing convention in AGENTS.md.

| Resident | Artwork | Generation job |
| --- | --- | --- |
| ring-runner | 32×32 ship | da5cb2bc-74dc-4a95-9dfc-da0f0d99d7c0 |
| range-keeper | 32×32 ship | 6cc3e2ac-97ff-403f-9795-5e2aea172831 |
| gloom | 32×32 ship | cd7589b4-822e-4db7-bd56-63ce2d424a86 |
| jubilee | 32×32 ship | d203ad3a-b172-4cbf-b661-2091bdfcafee |
| lamp-keeper | 24×24 droid | 4665e8b9-335e-47fb-b27b-312bc42f1af3 |
| repair | 24×24 droid | 29064d6f-b3e5-44b0-a9f3-09a03a502dfa |

Ship palette reduction: 7d172e3a-adfb-48d9-9802-f20c386fe1d2. Utility droid palette reductions: 84f26de6-e7c7-473e-a9d4-5acbb9419a82 and 9ebbbbd3-8978-4a70-b15c-2247378d09d6.

## Runtime layout

Sources are public/sprites/hub/ship-{name}.png for the four ships and droid-{name}.png for the two utility droids. The shared swarm-atlas.png is 96×184. The original friendly-drone and upgrade entries 0–10 retain their pixels and coordinates. The 24px Lamp Keeper and repair entries remain at cells 13 and 16. Superseded 24px ship entries are cleared. The four 32px ships are at (0,120), (32,120), (64,120), and (0,152), registered through hubShipAtlasEntry in src/util.ts. All actors retain the shared atlas texture.

World ships render on a 32px canvas before their existing 0.82/0.86/0.9 role scales, giving 26.24–28.8 game units. Utility droids use a 16px canvas before scaling. Ring Runner's exhaust and Range Keeper's muzzle offsets match the larger hulls. The registry supplies the corresponding ship portraits and archive previews.

All six repair-crew instances and ambient maintenance drones use hub_droid_repair. Debris gatherers reuse drone_salvager; ambient salvage haulers carry five small pieces within the forward claws while returning. Their existing travel and docking behavior is preserved.


## Verification

Production build passed with existing Vite warnings. All four ship sources and the shared atlas pass the PNG normalizer check. A browser roster with 84 sprites and six labels measured 12.0 draw calls per frame over 120 frames both before and after migration. Visual review checked the four ships alongside the repair droid and player at runtime scale and enlarged pixel scale.
