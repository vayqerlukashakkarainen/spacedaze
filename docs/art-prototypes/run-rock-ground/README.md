# Connected Wake rock ground

PixelLab tiles-pro source: `614e751f-71da-4fe2-8478-d61e3db2387c`

- 64px pointy-top hex coastline tiles
- rock platform to transparent void
- 31 generated edge masks plus the stamp-only source frame
- four deterministic mirrored surface variations in the runtime atlas
- four grayscale levels plus transparency after runtime processing

Rebuild the atlas with `python3 scripts/buildRunRockGroundAtlas.py`, then run
the SpaceDaze grayscale simplifier at four levels before shipping it.
