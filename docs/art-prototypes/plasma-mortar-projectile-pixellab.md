# Plasma Mortar Projectile — PixelLab

## Source

- Generator: PixelLab Pixen
- Image job: `afd2b07c-5e3f-4925-bff6-90ae552a44e0`
- Palette-reduction job: `4e60dfc5-580f-498f-9b09-2cec12cb45b3`
- Seed: `481517`
- Canvas: 32 × 32 pixels, transparent background
- Direction: north/up
- Palette reduction: 2 colors, no dithering

## Generation prompt

> SpaceDaze plasma mortar projectile sprite, flying north/up. One large compact charged plasma shell that fills about 75 percent of the canvas: broad round crackling energy head, bright solid central core, short tapered tail directly below, several thick connected jagged plasma arcs attached to the silhouette. Stark 1-bit pure white shape on transparency only, strong chunky pixel clusters, unmistakable and readable when scaled down, hard pixel edges, no antialiasing, no gradients, no gray, no shadow, no text, no border frame.

## Runtime treatment

- Asset: `public/sprites/projectiles/plasma-mortar.png`
- Sprite key: `plasma_mortar_projectile`
- The white source sprite is tinted with the Plasma Mortar's purple at runtime.
- The projectile alternates between fully visible and hidden on the same timing as the player's thruster flash.
- The projectile uses the existing local ring-distortion shader for a restrained animated wobble.
- Its muzzle flash, impact flashes, and splash shockwave use the same purple.
