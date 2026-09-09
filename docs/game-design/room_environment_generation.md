# Room Environment Generation

Room environments are part of level generation. They shape traversal, firing
lanes, enemy behavior, and combat outcomes. They must not be selected randomly
when a room is loaded.

## Generation order

1. Generate the floor graph and assign room kinds and the floor theme.
2. Build the room boundary and door corridors.
3. Select a seeded environment layout from the theme and room-kind catalog.
4. Place structural cover and reserve its occupied cells.
5. Place dynamic cover, volatile objects, hazards, and authored interactions.
6. Validate navigation between every door, the room center, and required
   content positions.
7. Select enemy and content spawn slots around the completed environment.
8. Build an encounter compatible with the generated cover and hazards.
9. Save the environment plan on the room. Runtime code only instantiates it.

This order prevents props from blocking doors, spawning under enemies, or
appearing in tactically meaningless positions.

## Saved generation contract

Each room owns a stable environment plan. Every object records:

- A stable instance ID and catalog archetype ID
- Its hex cell, orientation step, and visual variant
- Its category: structural, dynamic cover, volatile, hazard, dressing, or
  explicit interaction
- Its footprint and whether it blocks navigation or projectiles
- Mutable state required on revisit, such as health, destroyed, collected,
  activated, or depleted

The catalog archetype defines runtime behavior, collision size, placement
rules, compatible room kinds, theme weight, cover properties, and sprite
variants. The saved room plan contains results, not another set of weights.

## Placement constraints

- Preserve a two-cell-wide protected route from every door to the room center.
- Preserve every dedicated content anchor and player entry position.
- Keep dynamic objects at least one cell from doors and spawn positions.
- Keep volatile objects away from player entry and mandatory interactions.
- Validate that every traversable region remains connected after structural
  placement.
- Ensure at least two useful combat lanes instead of filling all open space.
- Cap active environment objects per room; static background dressing belongs
  in the cached room picture.

## Gameplay categories

### Structural cover

Structural cover occupies grid cells and is placed before pathfinding and spawn
slots. It blocks movement and projectiles. It may be indestructible or have an
explicit destroyed state that updates navigation.

### Dynamic cover

Dynamic cover moves independently of the grid. It blocks projectiles and can be
pushed by knockback. Ranged enemies query cover anchors on the side opposite the
player. If the object moves, is destroyed, or no longer breaks line of sight,
the enemy releases that cover target and replans.

### Volatile objects

Volatile objects are neutral combat actors. Destroying one applies radial
damage and knockback to the player, enemies, and other environment objects.
Nearby volatile objects chain after a short stagger so the result is readable.

### Hazards

Hazards are generated with clear safe lanes and telegraphs. They use batched
updates and may affect ships, projectiles, or loose objects depending on their
theme definition.

### Explicit interactions

These are the minority of room objects and use the F prompt. They provide story,
small recovery, or control over an existing room system. They do not replace
systemic interactions such as shooting a fuel cell or pushing cover.

## Floor 1: Wake Scrap District

Floor 1 teaches the environment language with familiar salvage-yard objects.
The player should understand each object from its silhouette and behavior
without a tutorial panel.

### Initial archetypes

| Object | Category | Behavior | Tactical purpose |
| --- | --- | --- | --- |
| Patched hull barricade | Structural cover | Blocks ships and projectiles | Creates stable lanes for ranged enemies |
| Floating scrap mass | Dynamic cover | Pushable, destructible, slowly drifts back to rest | Temporary cover for player and scavengers |
| Volatile fuel cell | Volatile | Explodes on destruction; neutral damage, strong knockback, delayed chains | Teaches environmental kills and risk |
| Loose salvage cluster | Dynamic resource | Breaks into a small debris payout | Invites the player to alter the room |
| Sparking conduit | Hazard | Periodic short electrical arc between two fixed endpoints | Creates a timed crossing |
| Damaged memory console | Explicit interaction | Displays one short Wake memory after combat | Carries floor story without affecting rewards |

Sprites remain black and white. Structural and background objects use subdued
blue-gray tinting; dynamic cover is brighter; volatile cells receive a small red
light or pulse rather than a colored sprite.

### Room budgets

- **Start:** One memory console, one or two barricades, no hazards or volatile
  objects.
- **Combat:** Two to four structural cover cells, one or two floating scrap
  masses, zero to two fuel cells, and at most one conduit pair.
- **Reward, health, shrine, shop, and exit:** Theme dressing only around the
  authored focal object. No random volatile objects.
- **Miniboss:** Three to five structural cover cells, up to two floating scrap
  masses, and at most one fuel cell placed outside the entry lane.

Use a per-room environment budget rather than independent spawn chances. A room
may spend that budget on fewer large objects or several small ones, but must
remain readable.

## Enemy integration

Environment-aware behavior is opt-in by enemy role:

- Ranged scavengers and suppressors may reserve dynamic or structural cover.
- Chargers ignore cover selection but collide cleanly with structural objects.
- Melee and swarm enemies treat cover as navigation geometry only.
- Enemies may deliberately shoot a fuel cell only when the player is inside its
  blast radius and the firing line is clear.

Cover reservations prevent several enemies from selecting the same small
object. Selection uses distance to the enemy, path cost, protection from the
player, and a short commitment time to avoid jitter.

## Implementation slices

1. Add the saved environment-plan types and deterministic planner with
   navigation validation.
2. Implement patched barricades and floating scrap, then make one ranged enemy
   use generated cover.
3. Add neutral fuel cells with radial damage, knockback, and chain reactions.
4. Add the Wake conduit hazard and its placement telegraph.
5. Add quiet-room memory consoles and persistence.
6. Add debug overlays and seed tests for blocked doors, disconnected rooms,
   overlapping footprints, and deterministic regeneration.
