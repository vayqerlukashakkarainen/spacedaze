# Performance Baseline

Captured on 2026-09-03 in the Codex in-app browser at a 1000x1000 viewport with
Kaplay `4000.0.0-alpha.24`. Audio was muted. Benchmark samples use a 0.5 second
warm-up and exclude time spent in the command console.

## Reference results

| Scenario | Duration | Frames | Frame avg | Frame p95 | Draw avg | Notable CPU sections |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Legacy combat screenshot | - | - | 7.26ms | 7.90ms | 13 | game 0.06ms |
| Latest hub idle | 3.07s | 234 | 13.13ms | 14.60ms | 31.4 | game 0.07ms, background 0.04ms, UI HUD 0.01ms |
| Latest generated map, seed 12345, idle | 3.01s | 168 | 17.92ms | 21.30ms | 55.1 | wall draw p95 1.90ms, game 0.07ms, background 0.05ms, UI HUD 0.04ms |

The legacy screenshot contained 116 enemies, 7 projectiles, and 226 debris.
The much lower draw count despite the larger visible object count confirms that
object count alone is not a useful rendering-cost proxy.

The browser produced isolated 250ms frame samples while being automated. Use
p95 rather than maximum frame time for comparisons until browser scheduling is
controlled more tightly.

## Reproducing a sample

Open the command console and run:

```text
benchmark start <scenario-name> 5
```

Close the console. After the requested duration, reopen it and run:

```text
benchmark report
```

Useful related commands:

```text
profiler show
profiler reset
stress projectiles 1000
stress clear
map 12345
```

Use the same viewport, seed, loadout, camera position, and benchmark duration
when comparing changes. Record p95 frame time, average draw calls, and the
largest named CPU sections.

## Batched update migration

Phase 3 moved projectiles and gameplay entities into dense, centrally ordered
batches. Static Kaplay `onUpdate` registration sites fell from 71 in the
problematic build to 14. The remaining registrations are singleton player,
audio, transition, background, and UI controllers; the legacy projectile and
entity controllers are retained only as the `runloop off` fallback.

The diagnostics HUD reports the active handler count in each batch and exposes
their CPU time as `batch:enemies`, `batch:followers`, `batch:debris`,
`batch:world`, and `batch:effects`. A live 1,000-projectile stress run completed
with all projectiles updating through the scheduled projectile pass.

## Spatial query migration

Runtime objects are indexed once per frame in 96px spatial-hash cells after
projectile movement and before entity collision work. Projectile hits, homing,
proximity fuses, chain effects, explosions, gravity, interceptor targeting,
afterburner damage, phase-ram damage, rings, and timescale zones query nearby
cells instead of repeatedly scanning every object. Exact distance and segment
checks remain in place after candidate selection.

## UI update migration

Dynamic HUD, popover, tactical-map, chest-overlay, and main-menu animation
callbacks register with one dense UI update service. The central run loop
executes those callbacks in its UI phase and exposes total and per-group batch
counts in the profiler. The debug overlay now gathers its object and component
counts in one traversal at 4Hz instead of allocating several filtered arrays.

## Area component removal

Kaplay `area()` components were removed from projectiles, the player, runtime
HUD, menus, modals, scrollbars, and the level editor. Projectile and player
collision already use spatial distance and grid-segment checks. UI interaction
now uses a single lightweight pointer-region pass with local-space rectangle
tests, keeping hover, click, drag, and scroll behavior outside Kaplay's global
collision broadphase.
