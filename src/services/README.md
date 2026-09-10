# Service domains

Services are grouped by the game system they own. Tests stay beside the service
they cover.

| Folder | Responsibility |
| --- | --- |
| `abilities` | Ability loadouts, activation, tiers, and ability-specific runtime state |
| `audio` | Music, sound playback, sound profiles, and UI audio |
| `combat` | Damage, projectiles, explosions, targeting, and combat feedback |
| `core` | Shared scheduling, pooling, visibility, and spatial infrastructure |
| `debug` | Profiling, stress tools, runtime inspection, and debug commands |
| `economy` | Debris, salvage, rewards, and cargo |
| `enemies` | Enemy encounters, navigation, progression, bosses, and threat scaling |
| `hub` | Hub layout, restoration, settlement, and training behavior |
| `input` | Bindings, prompts, pointer input, and steering modes |
| `narrative` | Dialogue, cutscenes, emotions, prologue, and narrative state |
| `player` | Player health, movement, equipment, targeting, and player-only mechanics |
| `progression` | Saves, quests, contracts, upgrades, and persistent progression |
| `runs` | Run lifecycle, levels, inventory, finales, telemetry, and run shops |
| `ui` | Display settings, popovers, transitions, and UI update helpers |
| `world` | Rooms, terrain, gravity, lighting, warps, and level transitions |

Import a service from its concrete domain path. Avoid cross-domain barrel files,
which hide dependencies and can create broad circular import chains.
