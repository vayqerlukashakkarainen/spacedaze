# Run rock tiles — PixelLab

The first generated-run biome uses a low-top-down, pointy-hex rock set. The
logical grid remains axial and the runtime applies a vertical projection to
its screen coordinates.

- Connected edge-mask source: PixelLab job `288e27a0-4cc4-4288-a0e8-fdc554f7848d`
- Low-top-down body source: PixelLab job `064cc873-03e7-4f58-bed4-7cc6bb562f33`
- Shared two-color reduction jobs: `d69af47b-c991-48d3-9333-288895c96748` and
  `30124337-fc5a-4992-8929-970402ef49ff`
- Native source size: 64×64 pixels
- Runtime atlas: 256 frames arranged 16×16; four body variants for every
  six-bit exposed-edge mask
- Runtime projection: `11 / 24` vertical scale, matching the 22-pixel source
  row step to the game grid's 48-pixel axial row step
- Runtime anchor: source pixel `(32, 20)`, keeping the walkable top aligned
  while the cliff face extends below it
- Palette: `(0, 0, 0)` and `(248, 248, 248)` with binary alpha and no dithering

`scripts/buildRunRockTileAtlas.py` combines the generated connected top masks
with the generated low-angle rock bodies. PixelLab supplies all 31 unambiguous
coastline masks. The script composes the remaining split-edge cases from its
six generated single-edge treatments so cellular cave artifacts never fall
back to procedural line art.

## Grayscale detail pass

The runtime high-angle atlas received a second PixelLab Pixen detail pass on
2026-09-08. The generated sheets are stored under `v2/` and are rebuilt with
`scripts/buildDetailedRunRockAtlas.py`. The builder preserves the original
six-edge silhouettes while applying PixelLab's fractured plates, pits, and
layered cliff shading through an eight-value grayscale palette.

- Left-half PixelLab job: `4a2de3f1-efb5-4596-aecf-4a06414c2174`
- Right-half PixelLab job: `b72ee8b1-683f-40d6-9b04-e1e7e4a87723`
- Model: Pixen, seed `47291`, two generations total
