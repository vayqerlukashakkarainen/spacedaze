# Hub rock foundations — PixelLab

Six large hub settlement foundations use irregular asteroid rubble suited to a poor pirate and scavenger district. They have cratered surfaces, broken outer edges, and transparent gaps between chunks. None use metal decks, rails, pylons, pavement, square slabs, or clean platform silhouettes.

| Plot | Size | PixelLab generation job | Palette job |
| --- | ---: | --- | --- |
| Scrap sorter | 200×152 | 2329458e-d27b-422f-b2ce-50680553d46d | Forced during generation |
| Smelter annex | 208×160 | e6ed5eaa-82f2-4279-8672-aba7ca287bc3 | Forced during generation |
| Repair drydock | 256×192 | edf487ed-29b6-4f36-891b-48484fd702d7 | ff0505be-a494-41f4-93b7-9bfd1707aaa7 |
| Freight terminal | 288×208 | d89d30f7-750e-49e5-90f7-ecc334a06ba0 | b4f918c9-57b5-44ea-9351-7c30ab3342fd |
| Habitat cluster | 320×224 | 5b05ffb9-a6f7-4875-b9b7-c53b02895022 | 64cbc016-e277-472c-b1e8-42e35f101cc7 |
| Observatory crown | 320×240 | 233f9094-17b0-4e16-a630-9f59e1eb6ac7 | ea601b37-9dca-4776-ac34-6805fd241d7a |

The individual source sprites live under `public/sprites/hub/rock-foundations`. Runtime uses `settlement-rock-foundations-atlas.png`, which packs all six into one texture to preserve draw batching. The sprites stay at 1:1 scale; no runtime enlargement is applied.

All sprites use transparent backgrounds, hard alpha, and the project's pure black-and-white palette without dithering. The original small rocky foundations remain in `settlement-atlas.png` for the four plots that already fit them.
