# Floor Themes

Each floor is a coherent place remembered by the Phase Void. Its rooms should
feel like fragments of the same station, fleet, settlement, or biological
structure rather than unrelated arenas joined by doors.

A floor theme controls:

- Wall and floor tiles
- Room silhouettes and door architecture
- Large landmarks and edge dressing
- Ambient motion, particles, and lighting accents
- Environmental hazards and interactive props
- The dominant enemy pool and encounter formations
- Shop, shrine, health, reward, and boss-room presentation
- Reward weighting and the stories recovered on that floor

The theme does not change the floor graph or the meaning of room types. A shop
is still a shop and a shrine is still a shrine, but both inherit the material,
culture, and history of the current floor.

## Theme rules

Every floor has one dominant theme. At least 75% of its enemies, props, and
landmarks should belong to that theme. This makes the floor readable within a
few seconds of entering its first room.

Deeper floors may also receive one **intrusion modifier**. An intrusion adds a
small number of foreign enemies and props without replacing the dominant
identity. Federation claim teams, pirates, scavengers, or Void corruption can
intrude on any compatible theme.

Every theme needs:

- One unmistakable room silhouette
- One large landmark visible in several room variants
- Three reusable prop clusters
- One interactive prop
- One environmental hazard
- One ambient motion system
- One signature encounter formation
- One miniboss or boss concept
- One reward bias that supports its gameplay identity

Dynamic decoration should remain limited. Static dressing belongs in the
cached room picture; moving machinery, hazards, and particles should use
batched updates and shared sprite atlases.

## Theme roster

| Theme | Culture or faction | Accent | Gameplay identity |
| --- | --- | --- | --- |
| Wake Scrap District | Mixed pirates, scavengers, deserters, and droids | Cyan | Improvised machinery and loose salvage |
| Federation Claim Zone | Federation reclamation forces | Red | Formation combat, lockdowns, and suppression |
| Khelt Moltworks | Khelt vacuum salvagers | Amber | Armor, crushing machinery, and kinetic force |
| Naru Tide Ark | Naru aquatic navigators | Blue | Currents, shields, and coordinated support |
| Oruun Pilgrim Array | Oruun gravity-sensitive nomads | Violet | Orbits, displacement, and shifting movement |
| Silex Resonance Vault | Silex crystalline colonies | Magenta | Refraction, chaining attacks, and synchronized pulses |
| Vey Living Convoy | Vey photosynthetic symbiotes | Green | Regrowth, swarms, and area denial |
| Freebooter Exchange | Mixed-species outlaw flotilla | Orange | Traps, stolen technology, and volatile rewards |
| Daze Scar | No stable culture | Purple and white | Unstable geometry and mixed phase echoes |

## Wake Scrap District

The Wake theme reconstructs residential and industrial fragments of Drius
Wake. It should feel poor, inhabited, and repaired many times. This is the
closest theme to the hub, but the rooms represent districts that have not yet
been recovered.

- **Architecture:** Patched homes, broken docks, uneven hull plates, exposed
  cables, small market stalls, antennas, and rock foundations.
- **Landmark:** A ruined neighborhood beacon or a half-reconstructed house.
- **Props:** Stacked hull panels, repair carts, laundry or signal lines,
  improvised lamps, and loose ship parts.
- **Hazard:** Sparking power conduits or decompression vents that push objects.
- **Ambient life:** Welding flashes, flickering lamps, drifting paper and scrap,
  and small maintenance droids hiding when combat begins.
- **Encounters:** Scavengers compete for debris while hacked defenses protect
  old homes. Enemies use whatever cover and machinery the room provides.
- **Reward bias:** Salvage, repair, starter weapons, and broadly useful upgrades.
- **Story use:** Memories of ordinary life in the Wake before the Claim.

## Federation Claim Zone

These floors are fragments of reclamation carriers, impound stations, and
fresh Federation incursions into the Daze. Their clean geometry should feel
hostile beside the improvised Wake.

- **Architecture:** Straight corridors, sealed cargo cells, numbered claim
  bays, scanning arches, and modular armor walls.
- **Landmark:** A claim press that labels captured wreckage as Federation
  property.
- **Props:** Evidence crates, tow clamps, red warning pylons, sensor arrays, and
  neatly stacked confiscated parts.
- **Hazard:** Scanning beams trigger turrets, barriers, or reinforcement jumps.
- **Ambient life:** Searchlights, moving gantries, synchronized status lamps,
  and distant silhouettes behind sealed windows.
- **Encounters:** Shield units and suppressors hold lanes while mobile attackers
  flank. Reinforcements arrive in disciplined formations.
- **Reward bias:** Precision weapons, shields, targeting systems, and stolen
  military technology.
- **Boss concept:** A mobile claim rig that locks portions of the room and tows
  loose objects into its armor.

## Khelt Moltworks

The Khelt evolved in exposed orbital nests and treat armor as a replaceable
outer skin. Their ships and stations are built from curved plates riveted over
older curved plates. Khelt salvagers are not natural enemies of the Wake, but
some crews regard anything abandoned in the Daze as fair salvage.

- **Architecture:** Carapace-shaped chambers, overlapping armor, heavy clamps,
  furnace pits, and low crushing machinery.
- **Landmark:** A suspended armor shell being stripped and rebuilt.
- **Props:** Molted plates, rivet bins, chain hoists, slag troughs, and hydraulic
  tools.
- **Hazard:** Crushers close across marked lanes; hot slag remains dangerous
  until it cools.
- **Ambient life:** Slow pistons, falling sparks, rattling chains, and workers
  retreating into armored pods.
- **Encounters:** Durable enemies advance behind breakable armor. Damaging the
  armor can create debris or expose a faster, vulnerable enemy underneath.
- **Reward bias:** Kinetic force, knockback, armor, piercing, and heavy weapons.
- **Boss concept:** A Khelt shellmaster that discards damaged armor phases and
  constructs new plates from room debris.

## Naru Tide Ark

The Naru are aquatic navigators who travel inside connected pressure vessels.
Their architecture carries water through transparent tanks and pipes while
their ships move through vacuum around it. The Daze has fractured several
arks, leaving rooms caught between pressure states.

- **Architecture:** Rounded pressure chambers, glass reservoirs, pipe bundles,
  pumps, and circular airlocks.
- **Landmark:** A large suspended water globe containing a navigation organism.
- **Props:** Condensation collectors, shell-like consoles, repair bubbles, and
  flexible hose clusters.
- **Hazard:** Current jets push ships and projectiles; ruptured globes create
  temporary drifting fields.
- **Ambient life:** Flowing bubbles, pulsing pumps, swimming silhouettes, and
  droplets collecting back into tanks.
- **Encounters:** Support units share shields and redirect projectiles through
  currents. Breaking their formation makes them individually fragile.
- **Reward bias:** Recovery, cooldowns, shields, projectile redirection, and
  controlled movement.
- **Boss concept:** A Naru current-weaver that rotates streams around the room
  and changes the paths of every projectile.

## Oruun Pilgrim Array

The Oruun sense gravity as direction and memory. Their pilgrim fleets surround
small artificial singularities with rings, shrines, and suspended stone. They
consider the Phase Void sacred, but individual pilgrim orders disagree on
whether outsiders should be guided through it or driven away.

- **Architecture:** Concentric rings, radial bridges, floating monoliths, and
  open centers built around gravity wells.
- **Landmark:** A slowly turning navigation orrery.
- **Props:** Weighted prayer stones, tether pylons, orbit markers, and broken
  ring segments.
- **Hazard:** Gravity wells pull ships, enemies, projectiles, and loose debris
  into changing orbits.
- **Ambient life:** Orbiting fragments, slow ring rotation, bent particle
  trails, and objects settling into stable paths.
- **Encounters:** Enemies displace the player, sling around landmarks, and fire
  along predicted orbital paths.
- **Reward bias:** Mobility, gravity effects, knockback control, and homing.
- **Boss concept:** An Oruun pathkeeper that changes the room's gravity center
  between phases.

## Silex Resonance Vault

The Silex are colonies of crystalline organisms that communicate through
vibration. A single body may be a person, machine, archive, or all three. Their
vaults preserve memories as resonant patterns, making them unusually stable
inside the Daze.

- **Architecture:** Faceted chambers, repeating angles, resonator bridges, and
  crystal growth around older metal frames.
- **Landmark:** A harmonic archive that flashes in response to nearby impacts.
- **Props:** Tuning forks, fractured prisms, suspended shards, and waveform
  markings.
- **Hazard:** Resonance pulses travel between linked crystals. Shooting the
  wrong node can amplify the next pulse.
- **Ambient life:** Synchronized glints, small shards aligning themselves, and
  visible waves traveling through walls.
- **Encounters:** Enemies chain power between one another, reflect weak shots,
  and split when struck at particular resonance states.
- **Reward bias:** Critical hits, chaining, splitting, ricochet, and precision.
- **Boss concept:** A Silex chorus that shares one health pattern across several
  bodies and changes which body can be damaged.

## Vey Living Convoy

The Vey are partnerships between mobile creatures and photosynthetic colony
growths. Their living ships spread sails, roots, and seed pods across salvaged
frames. The Void keeps trying to regrow damaged convoy fragments from their
recorded biological pattern.

- **Architecture:** Organic membranes stretched over wreckage, branching
  corridors, luminous growth beds, and seed chambers.
- **Landmark:** A damaged solar bloom opening and closing above the room.
- **Props:** Root bundles, seed racks, cocooned machinery, nutrient bulbs, and
  reclaimed metal covered in growth.
- **Hazard:** Vines reclaim open space, healing Vey units until their growth
  nodes are destroyed.
- **Ambient life:** Breathing walls, folding leaves, drifting spores, and small
  organisms carrying fragments between nests.
- **Encounters:** Swarms screen for larger symbiotic ships. Unchecked units heal,
  reproduce, or rebuild destroyed cover.
- **Reward bias:** Lifesteal, regeneration, drones, duration, and area effects.
- **Boss concept:** A convoy heart that grows new room structures during combat
  and must be cut off from its nutrient nodes.

## Freebooter Exchange

The Exchange is a moving outlaw market used by pirates, deserters, smugglers,
and traders from many species. Its floor is assembled from chained ships and
cargo frames. Some fragments are abandoned markets; others are active crews
trying to loot the same phase echo as the player.

- **Architecture:** Mismatched ship interiors, docking bridges, hanging signs,
  cargo cages, and open market circles.
- **Landmark:** A chained cluster of ship noses surrounding an auction platform.
- **Props:** Stalls, counterfeit beacons, fuel tanks, weapon racks, dice tables,
  and suspicious sealed crates.
- **Hazard:** Trapped containers, improvised mines, and turrets that can change
  allegiance when their control box is hit.
- **Ambient life:** Vendors closing shutters, cargo drones fleeing with goods,
  rotating signs, and spectators watching from protected alcoves.
- **Encounters:** Mixed enemy rosters use stolen abilities and fight each other
  when alliances break. Valuable objects tempt the player into exposed areas.
- **Reward bias:** Shops, rerolls, unusual combinations, extra salvage, and
  volatile high-risk upgrades.
- **Boss concept:** A pirate auctioneer in a modular ship assembled from stolen
  weapons collected during the fight.

## Daze Scar

A Daze Scar is a late-run floor where no single remembered place remains
stable. It should remix previously introduced themes only after the player has
seen them in their intact form. This is environmental horror, not a separate
alien race.

- **Architecture:** Rooms from different places intersect, repeat, or end in
  missing geometry. Doors reconnect through impossible angles.
- **Landmark:** A broken Phase Crown echo trying to reconstruct several places
  at once.
- **Props:** Familiar objects fused together or frozen midway through motion.
- **Hazard:** Phase surges temporarily duplicate enemies, invert projectile
  paths, or move safe areas.
- **Ambient life:** Delayed shadows, particles moving backward, duplicate sound
  sources, and silhouettes from rooms that are not present.
- **Encounters:** Mixed phase echoes inherit one another's behaviors. The floor
  favors elites and unusual combinations over raw enemy count.
- **Reward bias:** Phase abilities, rare upgrades, unstable tradeoffs, and
  recovered lore.
- **Boss concept:** A composite echo built from previously defeated bosses and
  room landmarks.

## Intrusion modifiers

Intrusions create conflict without erasing the floor theme.

- **Federation Claim:** Red scanning equipment, claim pylons, disciplined patrols,
  and confiscated local objects. Compatible with every theme.
- **Scavenger Rush:** Independent crews strip props and steal dropped salvage.
  Most likely in Wake, Khelt, Exchange, and Federation floors.
- **Pirate Raid:** Traps, boarding craft, stolen turrets, and contested reward
  rooms. Most likely in Wake, Naru, and Exchange floors.
- **Void Bloom:** A small amount of Daze Scar corruption appears before the full
  late-game theme is unlocked.

An intrusion should affect two or three rooms on a normal floor. Its enemies
may fight the dominant faction when both are present.

## Recommended production order

1. **Wake Scrap District** establishes the game's home and reuses current art.
2. **Federation Claim Zone** establishes the main antagonist and formation play.
3. **Oruun Pilgrim Array** expands the existing gravity systems into a full theme.
4. **Khelt Moltworks** adds a readable heavy-combat identity.
5. **Freebooter Exchange** brings multi-species social spaces and mixed encounters.
6. **Naru Tide Ark**, **Silex Resonance Vault**, and **Vey Living Convoy** follow as
   their hazards and enemy families are built.
7. **Daze Scar** arrives after enough earlier themes exist to make its remix
   meaningful.

The first implementation should support theme data even if only the first
three themes have complete art. A floor theme identifier should be saved with
the generated floor so every room, encounter, map label, and revisit uses the
same identity.
