# Level Editor - Procedural Generation Guide

## Overview

The SpaceDaze level editor now includes procedural cave generation with PNG export for debugging.

## Using the Generator

### In the Level Editor

1. **Launch the editor** from the main menu
2. **Enter a seed** (optional):
   - Type 0-9 digits in the seed field (max 8 digits)
   - Use Backspace to delete
   - Leave empty for random generation
3. **Click GENERATE** button
4. **Results**:
   - Map is applied to the grid instantly
   - PNG auto-downloads to your browser downloads folder
   - Console shows seed used and generation stats

### Seed Input Controls

- **Number keys (0-9)**: Add digit to seed
- **Backspace**: Remove last digit
- **Empty field**: Uses random seed (shown as "seed: random")

### Understanding the Generated PNG

The downloaded PNG shows your generated cave with color coding:

| Color            | Meaning                             |
| ---------------- | ----------------------------------- |
| White/Light Gray | Solid walls (brightness = hardness) |
| Yellow Outline   | Locked cells (from stamps)          |
| Green            | Player spawn point                  |
| Blue             | Resource node locations             |
| Red              | Hazard zones                        |
| Dark Gray        | Large chambers                      |
| Very Dark Gray   | Carved tunnels                      |
| Black            | Open space                          |

## Example Seeds

Try these interesting seeds:

- **12345** - Classic organic caves
- **999** - Dense walls with small caves
- **777** - Large open chambers
- **54321** - Lots of connectivity
- **100000** - Sparse, spacious layout

## Integration with Gameplay

Generated caves include:

1. **Solid walls** - Can be carved during gameplay
2. **Hardness values** - Affect destruction difficulty
3. **Region IDs** - Track connected cave systems
4. **Feature tags** - Mark spawn points, resources, hazards

## Technical Details

### Generation Pipeline

1. **Initial Fill** - Random solid/empty distribution
2. **Cellular Automata** - Smoothing with hex neighbor rules
3. **Region Detection** - Flood-fill to find disconnected caves
4. **Connectivity** - Carve tunnels between regions
5. **Stamp Injection** - Add predefined structures (chambers, rooms)
6. **Material Assignment** - Set hardness and density
7. **Feature Tagging** - Mark gameplay locations

### Configuration

Default settings (can be customized in code):

```typescript
{
  fill: {
    percentage: 0.48,      // 48% initial fill
    edgesSolid: true       // Solid border
  },
  ca: {
    iterations: 5,         // 5 smoothing passes
    birthThreshold: 5,     // Become solid if 5+ neighbors solid
    survivalThreshold: 4   // Stay solid if 4+ neighbors solid
  },
  stamps: {
    enabled: true,
    count: 3,              // 3 stamp attempts
    minSpacing: 8          // 8 hexes apart minimum
  }
}
```

## Programmatic Usage

You can also use the generator in code:

```typescript
import { CaveGenerator } from "./generation/caveGenerator";
import { generationMapToHexGrid } from "./generation/gridConversion";

// Generate
const generator = new CaveGenerator();
const map = generator.generate(12345, 30, 20);

// Convert to HexGrid
const grid = generationMapToHexGrid(
	map,
	40, // hex size
	k.vec2(400, 300), // offset
	1 // number of layers
);
```

## Troubleshooting

**PNG doesn't download:**

- Check browser popup blocker settings
- Check browser download permissions
- Look in browser console for errors

**Generation is too slow:**

- Reduce grid size
- Reduce CA iterations in config
- Disable stamps temporarily

**Caves too dense/sparse:**

- Adjust `fill.percentage` in config
- Change `birthThreshold` and `survivalThreshold`

**Disconnected regions:**

- Increase `ca.iterations` for more smoothing
- Connectivity pass should auto-fix this

## Next Steps

- Edit generated caves manually with paint tools
- Save patterns from generated caves
- Export as JSON for sharing
- Integrate into game levels

---

For more technical details, see:

- `/src/generation/README.md` - Full generator documentation
- `/src/generation/caveGenerator.ts` - Core implementation
- `/GENERATION_SUMMARY.md` - Complete technical summary
