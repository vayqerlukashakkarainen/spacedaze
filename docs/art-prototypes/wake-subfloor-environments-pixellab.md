# Wake subfloor environments — PixelLab

Generated on 2026-09-11 as native-size top-down room props. The selected files use
three opaque grayscale values plus binary transparency, with no runtime scaling.
The first sorting-gantry result was rejected because it collapsed into a thin line;
the replacement below is the live asset.

| Runtime prop | Native size | PixelLab object |
| --- | ---: | --- |
| Pressure tank | 64×32 | `07c1e2b6-1389-431d-8251-7220f61e3222` |
| Battery bank | 48×48 | `ef5e24bf-8b9a-48b4-a224-7f321fa3f585` |
| Sorting gantry | 96×48 | `60c1b6e7-f29d-4521-a027-d070512a5615` |
| Patchwork stall | 80×64 | `0ff5ae3d-4a94-4710-98a7-43a1ac22264e` |
| Signal nest | 64×64 | `07f05dbb-dcfe-4311-a034-484c49504378` |
| Coolant canister | 32×32 | `ba444dd2-21e5-435c-b6ba-3030ce9736b4` |
| Reactor pod | 80×64 | `ade87a37-63af-454c-982d-c7f12ac2becb` |
| Breaker crusher | 96×64 | `c54628d7-6d99-4e75-b81a-8581ae20a3d4` |

The runtime assignment establishes a readable progression across Floor 1:

- 1.1 Outer Silence: the existing sparse environment.
- 1.2 Wreck Drift: long scrap trails and pressure tanks.
- 1.3 Sorting Yards: parallel machinery lanes, gantries, and battery banks.
- 1.4 Patchwork Ward: clustered stalls, signal nests, and coolant canisters.
- 1.5 Breaker Core: a dense machinery ring with crushers and reactor pods.

Durability, collision radius, mass, push speed, and explosion strength increase with
the visible footprint. Large props are separate native canvases rather than scaled-up
copies of the 32×32 fuel cell.

The eight runtime frames are packed into
`public/sprites/rooms/environment/wake-subfloor-props-atlas.png` so their varied
native sizes still share one texture and batch together. Rebuild it with
`python3 scripts/buildWakeSubfloorPropAtlas.py` after editing an individual frame.
