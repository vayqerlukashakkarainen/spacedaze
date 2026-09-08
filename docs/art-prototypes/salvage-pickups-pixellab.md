# Salvage Pickups — Pixel Lab Source

The runtime atlas is `public/sprites/salvage-pickups.png`. It contains four
native 16x16 frames in a single horizontal row. Generated source images were
reduced to transparent, pure black, and pure white pixels before assembly.

| Frame | Value | Runtime sprite | Pixel Lab job | Seed |
| --- | ---: | --- | --- | ---: |
| Metal shard | 1 | `salvage_shard` | `18653794-a515-4e3d-b151-2b66a9159346` | 49210 |
| Machine plate | 3 | `salvage_plate` | `f6d7892d-27c6-431e-8b90-f2f36ef2d052` | 49211 |
| Salvage core | 5 | `salvage_core` | `81d0c3f1-b91a-40ad-ad0c-3509678192a8` | 49212 |
| Reactor fragment | 10 | `salvage_reactor_fragment` | `d22fc401-2c75-4841-bcdb-1443a200d37f` | 49213 |

All prompts requested a transparent background, low detail, a single black
outline, a high top-down view, and a connected asymmetrical mechanical
silhouette. The runtime applies the white, blue, gold, and purple denomination
tints so the source atlas remains compatible with SpaceDaze's 1-bit asset rules.
