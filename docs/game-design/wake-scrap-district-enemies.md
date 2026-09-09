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
| Boiler Hulk | Artillery miniboss | Turns marked areas into dangerous scrap fields | Commit during its long vent window |

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

## Encounter progression

The floor introduces one interaction at a time before combining roles.

1. **First combat room:** Four Scrap Nippers with obvious staggered lunges.
2. **First ranged room:** Two Rivet Gunners and two Nippers around simple cover.
3. **First control room:** One Towhook Rig, one Gunner, and loose wreckage placed
   away from the entry door.
4. **First support room:** One Patch Tender with two Gunners. The Tender begins
   in clear view so the repair relationship is readable.
5. **Late-floor formation:** Two Towhook Rigs, one Tender, two Gunners, and a
   delayed Nipper wave.
6. **Miniboss room:** One Boiler Hulk with Nippers arriving after its first
   vent. Later runs may add a Tender, but it must not repair the exposed boiler.

Difficulty should add combinations and elite rules before increasing raw enemy
health. The opening floor remains readable for a new player even when hub
progression increases its threat budget.

## Production order

The first playable art and behavior pass should cover Scrap Nipper, Rivet
Gunner, Towhook Rig, and Patch Tender. They establish pressure, ranged,
controller, and support roles using one shared scrap-machine parts sheet.
Boiler Hulk follows as the floor's bespoke miniboss.

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
