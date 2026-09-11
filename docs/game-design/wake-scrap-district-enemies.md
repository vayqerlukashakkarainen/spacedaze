# Wake Scrap District Enemies

The Wake Scrap District is the first floor and the player's nearest point of
reference inside the Daze. Its hostile roster is made from malfunctioning
maintenance systems, feral reclamation machines, and rival salvage crews.
Ordinary Wake residents are not combat targets.

This roster should feel less advanced than the Federation forces. Wake enemies
survive by combining simple tools with the room itself: scrap piles become
ammunition, tow cables turn obstacles into threats, and repair rigs rebuild
allies from whatever is nearby.

## Visual language

- Use uneven silhouettes, exposed frames, mismatched plates, patched tanks,
  dangling cables, and visible tool arms.
- Preserve large black areas inside each sprite. White identifies the body;
  cyan marks active tools, sensors, and unstable power.
- Give every role one readable shape at combat scale. Avoid small surface detail
  that disappears when the camera moves.
- All source sprites face north. Runtime rotation points the sprite toward its
  movement or attack direction.
- Wake machines move with imperfect timing: recoil drift, loose-part wobble,
  delayed thrusters, and brief showers of sparks.
- Federation units use balanced, deliberate construction. Wake units should
  look repaired into service rather than manufactured as weapons.

## Initial roster

| Enemy | Role | Room relationship | Player lesson |
| --- | --- | --- | --- |
| Scrap Nipper | Swarm pressure | Hides in scrap and attacks in short packs | Keep moving and clear nearby threats |
| Rivet Gunner | Baseline ranged | Uses cover and recoils behind it | Read firing lanes and punish recovery |
| Towhook Rig | Controller | Pulls the player or loose wreckage | Break the cable or change position |
| Patch Tender | Support | Rebuilds armor with nearby scrap | Remove support before damage is undone |
| Scrap Raiser | Support | Steals enemy debris and reconstructs destroyed attackers | Deny salvage or interrupt reconstruction |
| Clampback | Armored pressure | Advances behind destructible armor clamps | Flank it or punish the firing opening |
| Fuse Rat | Environmental support | Primes fuel cells, barrels, or improvised mines | Interrupt sabotage or exploit the explosion |
| Shredder Skiff | Area denial | Consumes loose scrap and cover for a fragment cone | Reposition, then break the loaded machinery |
| Boiler Hulk | Artillery miniboss | Turns marked areas into dangerous scrap fields | Commit during its long vent window |
| Magnet Maw | Controller miniboss | Pulls the player and loose props into a fixed crane platform, then releases them | Break either magnetic drum to weaken the field; break both to disable it |
| Railbreaker Rig | Pressure miniboss | Telegraphs a high-speed ram that crushes cover and volatile props | Bait a wall crash, then attack during the stun |

### Scrap Nipper

A small cutting drone that lived inside refuse compactors. It circles loose
debris, waits for another Nipper to be ready, and then lunges across the player
in a straight line. A missed lunge leaves it briefly embedded in a wall or
wreck.

- **Silhouette:** 16x16 triangular frame, one large cutter jaw, two uneven
  maneuvering jets.
- **Tell:** The jaw opens and its cyan cutter brightens before the lunge.
- **Counterplay:** Sidestep the line, then destroy the stuck machine. Piercing
  shots reward lining up a pack.
- **Room use:** Dormant Nippers can emerge from marked scrap piles after nearby
  combat starts. They never emerge directly under the player.
- **Elite variant — Hot Nipper:** Leaves a short spark trail after lunging. The
  trail deals damage but disappears quickly.

### Rivet Gunner

A repair skiff carrying an industrial rivet driver. It fires a three-shot burst
and drifts backward with every shot. It then spends a clear recovery beat
repressurizing the tool.

- **Silhouette:** 24x24 wide utility hull with an off-center barrel and one
  oversized gas cylinder.
- **Tell:** Three cyan points illuminate from back to front along the driver.
- **Counterplay:** Move across the firing line, then close distance during the
  reload. Its recoil can push it out of cover or into hazards.
- **Room use:** Prefers the far side of rock clusters, machinery, and ruined
  homes. It should reposition if its current line remains blocked.
- **Elite variant — Nailstorm Gunner:** Fires five faster rivets but has a
  longer, louder reload.

### Towhook Rig

A salvage tug with two articulated cable launchers. It chooses either the
player or a loose heavy object. A player cable applies a steady pull; an object
cable throws the object across the player's route. Only one cable may be active
at a time.

- **Silhouette:** 24x24 narrow tug with two forward hook arms and a heavy engine
  block.
- **Tell:** A dotted cyan guide line appears before the hook launches.
- **Counterplay:** Damage the exposed cable anchor, move behind cover, or force
  the rig to tow an inconvenient object.
- **Room use:** Most effective around wreckage, scrap heaps, and decompression
  vents. It must not pull keys, rewards, health globes, or permanent props.
- **Elite variant — Twin Tow:** Maintains two cables, but each cable anchor is
  more fragile.

### Patch Tender

A civilian repair platform with corrupted priority rules. It collects small
scrap pieces and attaches temporary armor plates to the most damaged hostile.
When no ally remains, it flees and scatters its carried scrap.

- **Silhouette:** 24x24 round work platform with three thin tool arms and a
  visible scrap basket.
- **Tell:** A cyan welding arc links the Tender to its repair target. The added
  plate is visible on that target.
- **Counterplay:** Interrupt the weld with damage or remove the Tender first.
  Destroying it drops the scrap it has not spent.
- **Room use:** Searches existing room scrap before creating any visual repair
  material. This keeps its behavior grounded in the environment.
- **Elite variant — Yard Tender:** Adds one plate to two nearby allies during a
  longer stationary weld.

### Scrap Raiser

An improvised reclamation drone that treats every destroyed machine as spare
inventory. It races the player to enemy debris, stores six salvage value, then
anchors in place for a two-second reconstruction. A completed reconstruction
creates either a Scrap Nipper or Rivet Gunner.

- **Silhouette:** 32x32 asymmetric support hull with a broad central hopper,
  three short collector arms, and mismatched armor plates.
- **Tell:** Stored fragments orbit the hull. During reconstruction they tighten
  into a cyan ring and the Raiser stops moving.
- **Counterplay:** Collect debris first or destroy the stationary Raiser before
  the reconstruction completes. Its stored debris is released on death.
- **Room use:** Reconstructed enemies count toward room clearance but cannot
  drop salvage, keys, health, or rewards. A Raiser can complete at most two
  reconstructions and can never create another Raiser or an elite.

### Clampback

A compact salvage craft advances behind two oversized hull clamps. It closes
the clamps while moving, then opens them to fire a short-range scrap shotgun.
Each clamp is a separate destructible part.

- **Silhouette:** 32x32 broad hull with two mismatched white clamps, a narrow
  central core, and twin lower engines.
- **Tell:** The clamps separate and the central barrel flashes before firing.
- **Counterplay:** Attack from the exposed side, wait for the firing opening,
  or destroy the clamps to remove its defensive stance.
- **Room use:** Advances through firing lanes and uses stable cover as a route
  toward the player rather than as a permanent firing position.
- **Elite variant — Yard Bulwark:** Closes one surviving clamp between shots,
  but its exposed core takes increased part-explosion damage.

### Fuse Rat

A fast sabotage droid searches for volatile fuel cells and explosive barrels.
It attaches an overcharger that makes the object burn before detonating. When
no suitable prop exists, it plants a weaker improvised mine.

- **Silhouette:** 32x32 narrow wedge with small tool claws, a pointed sensor,
  and an oversized central battery.
- **Tell:** A cyan wire joins the battery to the target while a rising spark
  pulse marks the detonation timer.
- **Counterplay:** Destroy the battery to interrupt sabotage, remove the Fuse
  Rat, or herd nearby enemies into the coming blast.
- **Room use:** Only primes destructible explosive props and never targets
  rewards, doors, health globes, or permanent structures.
- **Elite variant — Livewire Rat:** Can maintain two charges, but destroying
  its battery immediately discharges both at reduced damage.

### Shredder Skiff

A battered grinder craft consumes loose scrap or destructible cover, then
fires the material as a wide cone of fast fragments. Its grinder and loaded
hopper are independent destructible parts.

- **Silhouette:** 32x32 industrial skiff with a broad forward grinder, an
  offset square hopper, and two rear engines.
- **Tell:** Scrap visibly fills the hopper before the grinder spins and points
  toward the final firing cone.
- **Counterplay:** Leave the cone, break the grinder to remove the attack, or
  destroy a loaded hopper to turn its directional explosion against enemies.
- **Room use:** Consumes only loose combat scrap and explicitly destructible
  cover; it cannot remove fixed room boundaries or objective props.
- **Elite variant — Redline Shredder:** Stores two volleys and fires them in
  opposite sweeps, while a full hopper remains vulnerable for longer.

### Boiler Hulk

A heavy compactor built around a cracked pressure furnace. It scoops wreckage,
heats it, and launches a slow shell toward a marked position. The shell bursts
into several hot fragments that remain briefly as hazards. After three shots,
the Hulk must open its armor and vent.

- **Silhouette:** 32x32 broad tank body, tall furnace stack, asymmetrical scoop,
  and a visibly cracked boiler.
- **Tell:** The target area flashes orange, the boiler grows white, and the
  stack releases a vertical plume before firing.
- **Counterplay:** Move away from the marked area, use the shell's travel time
  to reposition, then attack the exposed furnace during venting.
- **Room use:** Consumes loose cosmetic scrap near its scoop. If none exists, it
  fires a weaker shell without persistent fragments.
- **Elite variant — Overpressure Hulk:** Fires four shells before venting. Each
  shot increases its movement speed and the chance of an early self-stagger.

### Magnet Maw

A fixed scrapyard crane built directly into a salvage platform. Both magnetic
drums charge together, pull the player and movable room props inward, then
release everything in a short outward burst.

- **Silhouette:** 64x64 circular work platform, central crane pedestal, and two
  large side drums.
- **Tell:** A cyan field grows from the platform before the pull begins.
- **Counterplay:** Break one drum to reduce pull strength, both to disable the
  field, or destroy the independently animated crane to shut it down directly.
  The platform cannot chase the player.
- **Room use:** The platform occupies the miniboss room center as part of the
  map and never performs the enemy landing jump.

### Railbreaker Rig

A demolition vehicle that tracks the player before locking a direction and
charging through destructible cover. Volatile props struck at charge speed can
detonate and damage the rig as well as nearby enemies.

- **Silhouette:** 64x64 broad wedge ram, narrow armored core, and two rear
  track-thrusters.
- **Tell:** The rig stops, flashes, and holds its facing before launch.
- **Counterplay:** Sidestep the locked path and punish its wall-crash stun.
  Destroying the ram lowers impact damage; destroying thrusters lowers speed.
- **Room use:** Best paired with breakable barricades and explosive barrels so
  its route changes the room during the fight.

## Encounter progression

The floor introduces one interaction at a time before combining roles.

1. **First combat room:** Four Scrap Nippers with obvious staggered lunges.
2. **First reclamation room:** One Scrap Raiser and three Nippers. The Nippers
   provide enough debris for one reconstruction if the player ignores it.
3. **First ranged room:** Two Rivet Gunners and two Nippers around simple cover.
4. **First control room:** One Towhook Rig, one Gunner, and loose wreckage placed
   away from the entry door.
5. **First support room:** One Patch Tender with two Gunners. The Tender begins
   in clear view so the repair relationship is readable.
6. **Late-floor formation:** Two Towhook Rigs, one Tender, two Gunners, and a
   delayed Nipper wave.
7. **Miniboss room:** Every sublevel contains one. Sublevel 1.1 uses Boiler
   Hulk, 1.2 uses the fixed Magnet Maw platform, and 1.3 uses Railbreaker Rig.
   The stable order teaches artillery, forced movement, then destructive charge.

Difficulty should add combinations and elite rules before increasing raw enemy
health. The opening floor remains readable for a new player even when hub
progression increases its threat budget.

## Production order

The first playable art and behavior pass should cover Scrap Nipper, Rivet
Gunner, Towhook Rig, and Patch Tender. They establish pressure, ranged,
controller, and support roles using one shared scrap-machine parts sheet.
Boiler Hulk, Magnet Maw, and Railbreaker Rig form the floor miniboss sequence.

Each enemy needs a north-facing idle sprite, a two- or three-frame movement
loop, one anticipation frame, one attack frame, one damage flash mask, and a
compact debris set. Generate and review silhouettes at their intended runtime
size before producing animation variants.

The current Federation roster remains assigned to Federation Claim intrusions
and its dedicated floor. It should not fill normal Wake encounters once this
roster becomes playable.

The selected PixelLab silhouette pass and its source object IDs are recorded in
[the Wake enemy concept sheet](concepts/wake-enemies/README.md). The first
runtime pass uses aligned core and destructible-tool layers derived from those
sources; code-driven anticipation and movement cover the initial animation
needs.
