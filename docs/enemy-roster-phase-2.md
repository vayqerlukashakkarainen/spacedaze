# Enemy roster phase 2

Implementation status: complete. The four units, role tags, encounter budgets,
shared telegraphs, player status-effect registry, debug spawns, and monochrome
sprites are integrated. Balance values remain intentionally data-driven for
playtest tuning.

Phase 1 establishes six combat roles: flanker, artillery, controller,
support, splitter, and gravity control. Phase 2 should build encounters that
combine those roles while adding four enemies that answer specific player
builds.

## Units

### Phase Skirmisher

- Blinks across one hex boundary after a visible white afterimage telegraph.
- Pressures stationary and long-range builds without becoming another rammer.
- Elite: leaves a short-lived damaging phase seam between departure and arrival.
- First appears at threat III.

### Salvage Scavenger

- Attempts to collect loose debris before the player and retreats after a haul.
- Killing it returns everything it collected with a small bonus.
- Elite: converts part of its haul into temporary armor while escaping.
- First appears at threat II, especially in salvage-heavy rooms.

### Suppressor

- Fires a slow fan that temporarily increases weapon recovery when it connects.
- Forces movement and target priority without disabling firing outright.
- Elite: alternates between narrow fast fans and wide slow fans.
- First appears at threat III.

### Breach Crawler

- Travels along destructive hex edges and opens temporary paths toward the player.
- Makes terrain less reliable as permanent cover late in a run.
- Elite: creates two breaches before pausing.
- First appears at threat IV and never in protected objective rooms.

## Foundations to add before phase 2

1. Give every enemy one or more role tags: pressure, artillery, support,
   controller, swarm, or terrain.
2. Move encounter selection from fixed compositions to a threat budget with role
   limits. A group should normally have one support/controller and one source of
   direct pressure.
3. Extract reusable telegraph primitives for target circles, lines, cones, and
   delayed impacts so warning timing remains consistent.
4. Add a status-effect registry for movement, weapon recovery, armor, and damage
   modifiers. Effects need source IDs, stacking rules, duration, and guaranteed
   cleanup when their source disappears.
5. Add deterministic encounter simulations that validate spawn cost, role caps,
   and cleanup without requiring a rendered scene.

## Delivery order

1. Role tags, encounter budgets, telegraph primitives, and status effects.
2. Phase Skirmisher and Salvage Scavenger at threat II–III.
3. Suppressor and mixed support encounters at threat III–IV.
4. Breach Crawler and terrain encounters at threat IV–V.
5. Tune against time-to-kill, unavoidable-hit rate, simultaneous telegraphs, and
   frame time with 30, 60, and 100 active enemies.

## Guardrails

- No encounter may contain more than two hard-control units.
- Do not pair a Tether Drone and Gravity Warden before threat IV.
- Artillery must always show its final impact area for at least 0.7 seconds.
- Support enemies should increase target priority, not create infinite healing.
- New sprites remain monochrome; elite identity comes from scale, behavior, and
  effects rather than a colored sprite.
