# Hub NPC sprites — PixelLab

The hub NPC set was generated at its native 32×32 size with PixelLab on
2026-09-11. Every sprite is transparent, north-facing, and reduced through the
project grayscale tool to three opaque grayscale values plus transparency.

| NPC role | PixelLab job | Runtime state |
| --- | --- | --- |
| Armorer | `290335d0-dd40-4eb1-8ac9-da2e63729605` | Active |
| Quartermaster | `ab64fa03-50a6-4429-9a95-8745406f6d8e` | Active |
| Race Marshal | `c2aebaa1-d214-4b8d-be22-1a502e384e34` | Active |
| Navigator | `65645912-3886-4075-96a1-3f4a3b92f39b` | Reserve |
| Salvage Appraiser | `cab6bb65-6062-4249-8ced-1fe5e40504b6` | Reserve |
| Archivist | `3ea4b4b9-4b86-4c63-bc15-d31269b41516` | Reserve |
| Signal Tender | `b0952eec-f2e5-426c-9469-bb0765cc92df` | Reserve |
| Dockmaster | `566f7092-8d39-4734-8c51-6c5f480f33f5` | Reserve |

The individual source sprites and the deterministic runtime atlas live under
`public/sprites/hub/npcs`. Rebuild the atlas with:

```sh
python3 scripts/buildHubNpcAtlas.py
```

The first Armorer result (`59585375-2885-440b-8f07-697075071c5c`) was rejected
because it became too dark and muddy after the required palette reduction.
