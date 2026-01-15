# Cave Generation Tests

Comprehensive test suite for the procedural hex cave generation system.

## Running Tests

```bash
# Run all generation tests
npm run test:generation

# Run visual test generator (creates SVG outputs)
npm run test:generator
```

## Test Coverage

### ✅ Determinism Tests (2 tests)

- Same seed produces identical maps
- Different seeds produce different maps

### ✅ Grid Dimensions Tests (3 tests)

- Generated map has correct dimensions
- All coordinates within bounds
- No duplicate coordinates

### ✅ Fill Percentage Tests (3 tests)

- Fill percentage roughly matches configuration
- Map is not completely solid
- Map is not completely empty

### ✅ Connectivity Tests (3 tests)

- All empty cells belong to a region
- Main region exists and is largest
- Connectivity ensures single main region dominates (≥60%)

### ✅ Material Properties Tests (3 tests)

- Solid cells have positive hardness
- Hardness values are reasonable (0.5 - 5.0)
- Density values are reasonable (0.0 - 2.0)

### ✅ Stamp/Locked Cells Tests (2 tests)

- Some cells are locked by stamps
- Locked cells maintain their state

### ✅ Feature Tagging Tests (4 tests)

- Player spawn tag exists (exactly 1)
- Player spawn is in empty space
- Resource nodes exist
- Tags are only on empty cells

### ✅ Edge Cases (3 tests)

- Small grid generates correctly (5x5)
- Large grid generates correctly (100x80)
- Rectangular grids work correctly

## Test Results

**Total: 23 tests**
**Status: ✅ All passing**

## What's Tested

### HexGrid Filling

- ✅ Correct number of cells generated
- ✅ All coordinates valid and unique
- ✅ Solid/empty distribution reasonable
- ✅ No completely empty or solid maps

### Connectivity

- ✅ Region detection works
- ✅ Main region identified
- ✅ Connectivity pass connects regions
- ✅ Single dominant region emerges

### Material Assignment

- ✅ Hardness values set correctly
- ✅ Density values in valid range
- ✅ Solid cells have positive hardness

### Gameplay Features

- ✅ Player spawn point tagged
- ✅ Resource nodes placed
- ✅ Tags only on empty cells
- ✅ Features in valid locations

### Edge Cases

- ✅ Very small grids (5x5)
- ✅ Very large grids (100x80)
- ✅ Rectangular aspect ratios

## Known Limitations

### Not Tested (Browser-Only)

- HexGrid conversion (requires kaplay/browser APIs)
- PNG export functionality
- Level editor integration
- Visual rendering

These features are tested manually in the browser via:

1. Running `npm run dev`
2. Opening level editor
3. Clicking GENERATE button

## Test Philosophy

Tests verify:

1. **Correctness** - Output matches specification
2. **Determinism** - Same seed = same output
3. **Reasonableness** - Values within expected ranges
4. **Completeness** - All required features present

Tests do NOT verify:

- Visual quality (subjective)
- "Fun" or gameplay balance
- Performance/speed
- Browser-specific rendering

## Adding New Tests

```typescript
test("Your test name", () => {
	const generator = new CaveGenerator(seedNumber);
	const map = generator.generate(width, height);

	// Your assertions
	assertEqual(actual, expected, "message");
	assertTrue(condition, "message");
	assertInRange(value, min, max, "message");
});
```

## Debugging Failed Tests

If a test fails:

1. **Check the seed** - Some seeds may produce edge cases
2. **Run testGenerator.ts** - Visual inspection of generated maps
3. **Adjust thresholds** - Procedural generation has natural variance
4. **Verify configuration** - Check DEFAULT_CAVE_CONFIG values

## Performance

Test suite completes in ~2-3 seconds for all 23 tests.

Individual test breakdown:

- Small grids (5x5): < 10ms
- Medium grids (20-40): 50-100ms
- Large grids (100x80): 500-800ms
