# Hex Grid & Grid Collision Testing Guide

## Running Tests

### In-Game Testing (Interactive)

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open the game** in your browser (usually http://localhost:3002)

3. **Press T** to run the hex grid test suite
   - Results will appear in the browser console (F12 → Console)
   - All tests should pass with green checkmarks (now 37 tests)

4. **Additional Test Keys:**
   - **H** - Create hex grid visualization WITH collision test entity
   - **G** - Toggle debug mode (shows coordinates + current cell info)
   - **Arrow Keys** - Move test entity (green circle) around grid
   - **S** - Save current grid to localStorage
   - **L** - Load grid from localStorage

## Interactive Collision Testing

### Testing Grid Collision

1. **Press H** to create test grid
2. A **green circle** will spawn at cell (5,5)
3. Use **arrow keys** to move the entity
4. Try to move into **white walls** - movement will be blocked
5. Try to move into **gray obstacles** - movement will be blocked
6. Movement in **black empty** cells is allowed
7. **Press G** to see current cell coordinates at bottom of screen
8. Watch console for collision events: `Collision with wall cell at 0,0`

### What to Test

- ✓ Entity cannot move through walls (white cells)
- ✓ Entity cannot move through obstacles (gray cells)
- ✓ Entity can freely move in empty cells (black)
- ✓ Collision event fires when hitting walls
- ✓ Current cell tracking updates as entity moves
- ✓ Spatial partitioning works (entity tracked in grid)

## Test Coverage

The test suite validates:

### Coordinate Math (11 tests)
- ✓ Hex equality checks
- ✓ Addition and subtraction
- ✓ Neighbor generation (6 directions)
- ✓ Distance calculations
- ✓ Ring and range queries
- ✓ Pixel ↔ Hex conversion
- ✓ String serialization

### Grid Operations (9 tests)
- ✓ Grid construction
- ✓ Cell count validation
- ✓ Cell type changes
- ✓ Bounds checking
- ✓ Walkability queries
- ✓ Neighbor queries
- ✓ Screen ↔ Hex conversion

### Serialization (5 tests)
- ✓ JSON format validation
- ✓ JSON roundtrip (save/load)
- ✓ Compact format generation
- ✓ Compact format roundtrip
- ✓ Complex pattern preservation

## Expected Output

When you press **T**, you should see:

```
============================================================
HEX GRID TEST SUITE
============================================================

✓ hexEqual - same coordinates
✓ hexEqual - different coordinates
✓ hexAdd - basic addition
✓ hexSubtract - basic subtraction
... (all tests)

------------------------------------------------------------
Results: 37 passed, 0 failed, 37 total
------------------------------------------------------------

✓ ALL TESTS PASSED!
```

## Test Examples

### Example: Coordinate Math
```typescript
const a = hexCoord(1, 2)
const b = hexCoord(3, 4)
const sum = hexAdd(a, b)
// sum = { q: 4, r: 6 }
```

### Example: Grid Generation
```typescript
const grid = new HexGrid({
  width: 10,
  height: 10,
  hexSize: 30,
  offset: k.vec2(0, 0)
})

grid.setCell(hexCoord(5, 5), CellType.Wall)
const isWalkable = grid.isWalkable(hexCoord(5, 5))
// isWalkable = false
```

### Example: Serialization
```typescript
const grid = createMyGrid()
const json = serializeGrid(grid)
// Save to file or localStorage

const restored = deserializeGrid(json)
// Grid is now restored with all cell types
```

### Example: Grid Collision Component
```typescript
import { gridCollision } from "./comp/gridCollision"
import { gridRegistry } from "./grid/gridRegistry"

// Register grid
gridRegistry.register("main", hexGrid)

// Add collision to entity
const player = k.add([
  k.pos(startPos),
  k.sprite("ship"),
  gridCollision("main"), // References grid by key
  // ... other components
])

// Handle collision events
player.onCollide((cell) => {
  console.log(`Hit ${cell.type} at ${cell.coord.q},${cell.coord.r}`)
  // Play sound, apply damage, etc.
})

// Query current cell
player.onUpdate(() => {
  const cellData = player.getCellProperties()
  if (cellData) {
    // Apply cell effects
    if (cellData.type === CellType.Obstacle) {
      player.speed *= 0.5 // Slow down
    }
  }
})
```

## Troubleshooting

**Tests fail to run:**
- Make sure you've built the project: `npm run build`
- Check browser console for errors
- Try refreshing the page

**Tests show failures:**
- Check the error messages in console
- Verify you're using the latest build
- Report issues with the specific test name and error

**Grid doesn't render:**
- Press **H** first to create the grid
- Check that you're in the game (not on menu screen)
- Try pressing **G** to toggle debug mode

## Adding New Tests

To add a new test, edit `src/grid/hexGrid.test.ts`:

```typescript
test("My new test", () => {
  // Your test code here
  const result = myFunction()
  assert(result === expected, "Description of what should happen")
})
```

Then rebuild and press **T** in game.
