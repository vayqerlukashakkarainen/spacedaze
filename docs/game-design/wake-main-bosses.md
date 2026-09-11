# Wake Scrap District Main Bosses

Floor 1 main bosses should culminate the floor's lessons: destructible cover,
volatile props, loose salvage, targetable components, and reading large attack
tells. They should not simply add more projectiles to the room.

The final subfloor selects one boss deterministically from the run seed. The
same boss should not repeat on consecutive runs when another unlocked choice
is available.

## Boss pool

| Boss | Origin | Fight identity | Primary lesson |
| --- | --- | --- | --- |
| The Claimkeeper | Federation salvage intrusion | Mobile gunship with batteries and tractor attacks | Break components to remove attacks |
| The Yardmaster | Wake industrial district | Consumes the arena and rebuilds itself from scrap | Control the room's material economy |
| The Last Beacon | Wake residential district | Room-scale signal machine that powers changing lanes | Read the arena instead of staring at the boss |

The Claimkeeper remains the most conventional ship duel. The two Wake bosses
should be available as soon as Floor 1 boss encounters are enabled; they do not
depend on meta-progression abilities such as the lasso.

---

## The Yardmaster

**Subtitle:** WAKE AUTONOMOUS SALVAGE FOREMAN
**Role:** Mobile environment-control boss
**Native canvas:** 192x192 body with aligned component layers
**Accent:** Cyan machinery with a small orange furnace tell

The Yardmaster was built to keep the district usable by turning wreckage into
new hull plate. Its priorities survived after the district did. It now treats
ships, homes, and loose scrap as equally valid construction material.

### Silhouette

A broad, asymmetrical salvage barge with a black compactor mouth at its nose,
two long collection arms, a cracked furnace in the center, and mismatched rear
thrusters. The open mouth and arms must remain readable at gameplay zoom. Large
black gaps separate each component from the body.

The occupied silhouette should fill roughly 168x176 pixels of the canvas. This
makes it visibly larger than the Claimkeeper's approximately 160-pixel runtime
footprint without forcing a non-integer scale or filling the room with hull.

The source sprite faces north. Runtime rotation follows its movement target,
while the arms may rotate independently toward material they are collecting.

### Arena

- Six destructible cover clusters form an uneven outer ring.
- Two volatile fuel cells sit away from the entrance and never begin beside the
  player.
- Four loose salvage clusters provide material for the boss and opportunities
  for the player.
- Only the hexagonal room boundary is permanent.

The arena begins spacious and becomes increasingly open as the Yardmaster
consumes it. Destroyed boss armor returns a portion of its material as loose
debris, preventing the fight from becoming visually empty.

### Components

| Component | Function | Effect when destroyed |
| --- | --- | --- |
| Left collector arm | Collects the nearest prop or salvage cluster | Halves collection speed and removes attacks from the left side |
| Right collector arm | Collects the nearest prop or salvage cluster | Halves collection speed and removes attacks from the right side |
| Furnace stack | Processes collected material into armor and shells | Prevents armor rebuilding and makes every heat cycle stagger the boss |

The body remains damageable throughout the fight. Component destruction creates
strong openings but is never mandatory.

### Phase 1 — CLEAR THE YARD

The boss alternates between two simple actions:

1. **Collection sweep:** One arm marks a cover object with a dotted cyan cable,
   drags it toward the compactor, and consumes it. The arm can be damaged or the
   object can be destroyed before it reaches the mouth.
2. **Bale shot:** The mouth flashes, then fires a slow compressed scrap block.
   The block breaks against walls or solid objects and throws a short fragment
   cone away from the impact.

After consuming two objects, the Yardmaster stops and bolts one temporary armor
plate onto its exposed side. The attachment animation is the vulnerability
window; damage interrupts it and spills the stored salvage.

### Phase 2 — NO MATERIAL WASTED

At 67% health, the furnace ignites and the boss begins using the room more
aggressively.

- **Crusher lane:** The boss marks a wide line, closes its mouth, and surges
  forward. Destructible cover is crushed into fragments instead of stopping it.
- **Hot bale:** Every second bale leaves a brief orange scrap field at the
  impact location.
- It may rebuild one destroyed armor plate, but only while the furnace stack is
  intact and only by consuming an actual room object.

A volatile cell dragged into the mouth explodes inside it, cancels the action,
and causes a long stagger. This is optional counterplay, not required damage.

### Phase 3 — FOREMAN OVERRIDE

At 30% health, the furnace jams open. The Yardmaster can no longer construct
armor.

- It vents a clearly telegraphed radial ring of large, slow scrap chunks.
- Both surviving arms collect simultaneously.
- Crusher lanes happen more often, but every charge ends in a short immobile
  vent.
- Destroyed cover and boss parts remain dangerous only briefly; the phase must
  not fill the room with persistent fragments.

This phase is faster but more vulnerable. The intended rhythm is evade, punish
the vent, and use the last remaining props for explosive damage or cover.

### Death

The furnace whites out first. Both arms lose power and drop before the hull
folds inward around the compactor mouth. A final low-pressure burst throws
large readable plates outward, followed by the normal boss reward reveal.

---

## The Last Beacon

**Subtitle:** DISTRICT EMERGENCY SIGNAL
**Role:** Fixed room-scale pattern boss
**Native canvas:** 192x192 central beacon plus three 64x64 relay sprites
**Accent:** Cold cyan signal light; red only for lethal lane telegraphs

The Last Beacon once guided residents through decompression and attack alarms.
Its memory has collapsed thousands of emergencies into one permanent command:
keep every unknown ship away from the district.

### Silhouette

A damaged neighborhood beacon anchored to a circular scrap foundation. Three
uneven transmitter vanes surround a brilliant central lens. One side resembles
patched residential antenna hardware rather than military equipment. The
center remains mostly black until an attack charges, making the white signal
core immediately readable.

The central structure should occupy roughly 176x176 pixels. Its relays create a
much larger room-wide encounter footprint, but the core itself remains large
enough to read as a main boss rather than a shrine or miniboss platform.

The central structure does not rotate. Its lens and vanes rotate independently;
each relay visually points back toward the center while powered.

### Arena

- The beacon occupies the center and cannot be crossed.
- Three relay pylons sit at broad triangular positions near the room edge.
- Sparse destructible cover lies between relays, never directly on a beam lane.
- Dormant scrap heaps are placed in three known reinforcement pockets.

The fight is built from three sectors. At least one route between sectors must
always remain open, including at maximum difficulty.

### Components

| Component | Function | Effect when destroyed |
| --- | --- | --- |
| Relay pylon A | Powers one third of each signal pattern | Permanently removes its lane and safe-sector restriction |
| Relay pylon B | Powers one third of each signal pattern | Permanently removes its lane and safe-sector restriction |
| Relay pylon C | Powers one third of each signal pattern | Permanently removes its lane and safe-sector restriction |
| Central lens | Main health target | Opens only between completed broadcasts |

Relay damage transfers partially to the boss so attacking mechanics never feels
like delaying the health bar. Destroying every relay forces an immediate long
stagger and leaves the lens permanently exposed.

### Phase 1 — EVACUATION ROUTE

The beacon teaches the arena with alternating patterns:

1. **Guidance sweep:** Two cyan lines rotate slowly from the center. They push
   loose objects and deal damage only after turning red for a final short beat.
2. **Sector warning:** Two sectors pulse red while one stays dark. A broad
   signal blast hits the warned sectors after a generous delay.

After every pattern, the lens shutters open and exposes the boss core. Damaging
a relay shortens the next pattern without removing the attack immediately.

### Phase 2 — UNKNOWN CRAFT DETECTED

At 67% health, the beacon starts waking the district's dormant defenses.

- **Wake signal:** One relay highlights a scrap heap, then calls a small wave of
  Scrap Nippers or a single Rivet Gunner from that location.
- **Crossed guidance:** One rotating line is paired with a sector warning. The
  safe route is always visible before both tells overlap.
- Destroyed relays reduce reinforcement count as well as beam coverage.

Only one reinforcement wave may be alive at once. Adds count as part of the
boss encounter but do not drop keys, rewards, or salvage.

### Phase 3 — NOBODY LEFT TO WARN

At 30% health, the broadcast loses synchronization.

- The core stays exposed.
- Each surviving relay emits its own slow rotating line at a slightly different
  speed.
- The beacon sends three expanding signal rings with deliberate gaps. The gap
  changes between rings but is shown by missing cyan pixels before launch.
- No new enemies spawn in this phase.

The patterns become denser, but destroying a relay immediately removes its
active line. This makes component targeting a direct way to simplify the final
phase.

### Death

The hostile red signal drops out. The beacon emits one clean cyan navigation
pulse across the whole room without damage, plays a fragment of its original
civilian chime, and then goes dark. The three relays answer one after another
before collapsing into large antenna debris.

---

## Difficulty scaling

Difficulty should add decisions before raw speed.

- Increase health and component health using the shared boss curve.
- Add one cover cluster to the Yardmaster arena before increasing projectile
  counts, giving the boss more possible material without removing counterplay.
- Allow the Yardmaster to retain slightly more stored material between actions
  at high difficulty.
- Use tougher Floor 1 enemy types for the Beacon's wake signal, but preserve the
  one-wave limit.
- Increase telegraph rotation speed by no more than 20%. Never shorten the final
  red danger tell below the player's normal reaction window.
- Deep-cycle versions may gain one new interaction: the Yardmaster can throw a
  collected prop without processing it, while the Beacon can briefly repower
  one destroyed relay as a fragile phase echo.

## Selection and repetition

- Save the selected boss ID in generated floor state so revisiting the room
  never rerolls it.
- Prefer a boss the profile did not face on its previous completed Floor 1 run.
- Boss choice must not depend on whether the player owns the lasso.
- The lasso may provide optional advantages: pulling a fuel cell toward the
  Yardmaster or repositioning cover around the Beacon.
- Every boss uses the shared boss health bar, phase transitions, reward flow,
  room locking, and death sequence contract.

## Art and implementation boundaries

- Build bodies and destructible parts on aligned native-size canvases.
- Keep source sprites north-facing even for the fixed Beacon assets.
- Use large, separated component silhouettes rather than dense interior detail.
- Reuse existing projectile, cable, danger-line, debris, explosion, and boss
  phase-transition systems before adding one-off effects.
- Keep all attack scheduling deterministic and compatible with batched entity
  updates.
- Validate every attack at gameplay zoom with the room background and all
  destructible cover still present.
