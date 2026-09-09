# Wake Enemy PixelLab Concepts

These are the approved source concepts for the playable Wake Scrap District
roster. Runtime-ready body and component layers live in
`public/sprites/enemies/wake`.

All six concepts were generated as north-facing top-down objects using the
existing SpaceDaze enemy sprites as style references.

| Enemy | Native size | PixelLab object | Selected candidate | Destructible-layer plan |
| --- | ---: | --- | ---: | --- |
| Scrap Nipper | 32x32 | `1e4e0cd6-85ab-473c-90b9-a768bead6f5b` | 10 | None |
| Rivet Gunner | 32x32 | `f500313c-59bb-40b6-8602-b6772fa75887` | 7 | Separate forward rivet driver |
| Towhook Rig | 32x32 | `d9379504-9812-4436-b706-18aef87eee03` | 4 | Separate left and right hook arms |
| Patch Tender | 32x32 | `fb3aff08-342f-46ed-b06b-f8e3b74b427b` | 3 | Separate forward welding arm |
| Scrap Raiser | 32x32 | `7be1a344-fd90-4a89-aa6f-63c3522107b6` | 3 | Single north-facing support hull |
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

### Scrap Raiser

![Scrap Raiser](scrap-raiser.png)

The open central hopper, pointed sensor nose, and uneven collection arms make
its salvage role readable without adding a destructible component to this
first implementation.

### Boiler Hulk

![Boiler Hulk](boiler-hulk.png)

The central boiler, offset stack, and large side scoop make the miniboss
asymmetric without losing its forward direction. The scoop and stack will be
separated while the boiler remains the body target.

## Runtime implementation

The first playable pass uses strict Ink palette and binary alpha. Every
destructible component is stored on an aligned native-size canvas, so it can be
hidden and detached without shifting the remaining silhouette. Motion and
attack anticipation are currently driven in code; sprite animation and unique
detached debris frames remain optional later polish.
