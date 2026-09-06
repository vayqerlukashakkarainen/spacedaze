# SpaceDaze Art Pipeline

SpaceDaze sprites use neutral monochrome pixels. Color belongs to the game layer:
local lights, damage flashes, rarity tints, and other runtime effects may color the
sprite without requiring colored source art.

## Approved styles

### A: Ink

- Pure black, pure white, and transparent pixels only
- Broad connected shapes and deliberate highlights
- No dithering, antialiasing, gradients, or isolated single-pixel noise
- Best for small enemies, projectiles, icons, and highly readable silhouettes

### B: Dither

- Pure black, pure white, and transparent pixels only
- A fixed 4x4 Bayer pattern represents midtones
- No random or diffusion dithering, so texture remains stable between related assets
- Best for large stations, bosses, asteroids, and damaged surfaces

Do not mix random speckle with either style. Ink and Dither should share the same
silhouette language; Dither adds surface texture rather than extra geometry.

## Source image requirements

1. Use a square, high-resolution source with one centered subject.
2. Prefer a transparent background. A white edge-connected background is also removed.
3. Use large structural shapes and avoid tiny generated machinery.
4. Leave clear space around the silhouette.
5. Match the final gameplay view, normally top-down.

Generated images are concept inputs, not final game sprites. The production path is
ML image translation followed by deterministic grid and palette enforcement.

## ML translation

The prototype uses three existing model components:

- SDXL supplies the general image model.
- The small Canny ControlNet preserves the source silhouette and major internal
  divisions while using substantially less memory than the full adapter.
- Pixel Art XL LoRA translates the surface treatment toward pixel art.

The original alpha mask is restored after ML inference so the model cannot expand
the gameplay silhouette. The ML output is then passed automatically through the
Ink or Dither converter described below.

Create the isolated Python environment once:

```sh
python3 -m venv .venv-art
.venv-art/bin/pip install -r requirements-art.txt
```

Convert an image with the ML pipeline:

```sh
npm run art:ml -- source.png output.png \
  --style ink \
  --logical-size 64 \
  --subject "top-down hostile interceptor"
```

To compare both approved styles, run the command once with `--style ink` and once
with `--style dither`, using the same seed. Add `--ml-preview preview.png` to retain
the large result before grid conversion.

The first run downloads several model components and needs substantial disk and
memory. Later runs reuse the Hugging Face cache. Defaults are tuned conservatively
for silhouette preservation; reduce `--strength` if the result drifts from the
source, or increase `--control-scale` if its outline changes too much.

Ink output defaults to a white-forward threshold of `72`, matching the selected
style's white hull surfaces and black recesses. Raise `--ink-threshold` for a
darker sprite or lower it for a brighter one.

## Conversion

The deterministic converter may also be run directly without ML:

```sh
npm run art:prepare -- input.png output.png 128 128 ink
npm run art:prepare -- input.png output.png 128 128 dither
```

Arguments are:

```text
input output file-size logical-size style [ink-threshold]
```

Keep `file-size` equal to `logical-size` for new assets. Kaplay already uses nearest
texture filtering, so the game can enlarge the native sprite without smoothing it.
An integer-multiple file size remains supported for legacy 512px assets:

```sh
npm run art:prepare -- input.png output.png 512 128 ink
```

The optional final argument controls the Ink white/black split:

```sh
npm run art:prepare -- input.png output.png 128 128 ink 72
```

The old `1bit` style name remains an alias for `ink`.

## Native sizes

- 16px: particles and tiny pickups
- 32px: small enemies, drones, and compact icons
- 64px: player ships and ordinary enemies
- 128px: bosses, shops, and hub facilities
- 256px: exceptionally large structures only

Choose the smallest size that preserves the gameplay silhouette. Do not increase
resolution to preserve generated micro-detail.

## Review checklist

- The silhouette is readable at 100% native size.
- Every visible RGB value is either `0` or `255` in Ink and Dither output.
- Alpha is binary: fully transparent or fully opaque.
- No isolated pixels or accidental background fragments remain.
- Dithering follows the fixed grid and is restricted to intentional surfaces.
- The sprite remains readable under at least two different in-game light colors.
- The asset is reviewed in motion and at normal camera zoom before approval.

Manual pixel cleanup after conversion is expected. The converter establishes the
grid, palette, and texture rules; it does not replace art direction.
