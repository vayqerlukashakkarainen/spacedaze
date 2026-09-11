# Connected Wake salvage ground

PixelLab surface sources:

- fractured basalt: `6b89e14b-b785-47cc-b309-3cc3e7ce4d98`
- salvage embedded in rock: `d5535470-ad5d-4a91-afb0-3bd91d8a579f`
- compacted rubble and dust: `96904ebd-e42f-475e-8098-6b2d86a6a1a2`

- 64px pointy-top hex ground tiles
- regular, unprojected hex geometry for flat top-down rooms
- three room-wide material families with four subtle variations each
- surface-only ground with no lip or vertical cliff treatment
- borderless texture continues across neighboring hex edges
- generated connected floor shapes cover part of each room while preserving
	 paths from the center to every doorway
- four grayscale levels plus transparency after runtime processing

Rebuild the four-level grayscale atlas and its preview with
`python3 scripts/buildRunRockGroundAtlas.py`.
