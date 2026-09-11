# Connected Wake rock ground

PixelLab tiles-pro source: `614e751f-71da-4fe2-8478-d61e3db2387c`

- 64px pointy-top hex coastline tiles
- rock platform to transparent void
- 32 generated PixelLab rock-surface candidates
- one shared generated center surface plus the established organic cliff-edge kit,
  preventing seams on connected sides
- four deterministic mirrored crack variations in the runtime atlas
- four grayscale levels plus transparency after runtime processing

Rebuild the atlas with `python3 scripts/buildRunRockGroundAtlas.py`, then run
the SpaceDaze grayscale simplifier at four levels before shipping it.
