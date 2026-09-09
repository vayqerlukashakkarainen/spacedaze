# Wake Enemy PixelLab Concepts

These are approved silhouette concepts for the Wake Scrap District roster. They
are stored outside `public/sprites` because destructible layers, animation
frames, and final palette cleanup still need to be produced before runtime use.

All five concepts were generated as north-facing top-down objects using the
existing SpaceDaze enemy sprites as style references.

| Enemy | Native size | PixelLab object | Selected candidate | Destructible-layer plan |
| --- | ---: | --- | ---: | --- |
| Scrap Nipper | 32x32 | `1e4e0cd6-85ab-473c-90b9-a768bead6f5b` | 10 | None |
| Rivet Gunner | 32x32 | `ef0bcac0-ff98-41c0-9d3b-287d404459ef` | 15 | Separate forward rivet driver |
| Towhook Rig | 32x32 | `47624804-9879-4d0d-992f-b891f91b54a8` | 1 | Separate left and right hook arms |
| Patch Tender | 32x32 | `fb3aff08-342f-46ed-b06b-f8e3b74b427b` | 3 | Separate forward welding arm |
| Boiler Hulk | 64x64 | `92967acd-a359-4f07-bf71-95bd34e4f6f7` | 1 | Separate scoop and vent stack |

## Concepts

### Scrap Nipper

![Scrap Nipper](scrap-nipper.png)

The broad open jaw and two uneven lower jets remain readable at 32x32. Its
compact body leaves no visual room for destructible components, matching its
role as a disposable swarm threat.

### Rivet Gunner

![Rivet Gunner](rivet-gunner.png)

The forward barrel sits away from the main hull and can become a separate
component. The body remains recognizable after the weapon is removed.

### Towhook Rig

![Towhook Rig](towhook-rig.png)

The paired hook arms dominate the silhouette and form two clean component
regions. The narrow engine body remains readable after either or both are lost.

### Patch Tender

![Patch Tender](patch-tender.png)

The round work platform and surrounding tool arms read as civilian machinery.
The upper welding arm will become the functional destructible component.

### Boiler Hulk

![Boiler Hulk](boiler-hulk.png)

The central boiler, offset stack, and large side scoop make the miniboss
asymmetric without losing its forward direction. The scoop and stack will be
separated while the boiler remains the body target.

## Production requirements

Before moving these files into `public/sprites/enemies/wake`, produce:

- Body sprites with each destructible component removed cleanly
- Component sprites aligned to the same native canvas as their body
- Two- or three-frame movement loops
- Anticipation and attack states for every active tool
- Detached debris sprites for each breakable component
- Strict Ink palette and binary-alpha cleanup

Runtime registration waits until those assets are complete and have been
checked for draw-call changes in the same controlled room scene.
