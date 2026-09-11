# Run rock walls

The generated room walls use PixelLab asteroid-ring sources remapped onto the
game's exact pointy hex geometry. Each exposed edge is composed from irregular
boulders rather than a continuous bright rim. The runtime atlas contains two
stable material variants for each supported six-edge mask.

- Boulder ring job: `0566b148-1ae8-407a-9fca-a62ce993abd9`
- Slab ring job: `0ca12300-ef85-407d-bdf2-59075dfbb96f`
- Native frame size: 64×64
- Palette: eight-value grayscale with binary alpha
- Builder: `scripts/buildRunRockWallAtlas.py`
