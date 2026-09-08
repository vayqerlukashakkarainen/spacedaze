# Progression save strategy

SpaceDaze stores durable player progression in one versioned profile document under
`spacedaze_profile_v1`. `profileSaveService.ts` is the only module that should read
or write that document directly.

The profile is divided into domain sections so features can own their data without
owning storage:

- `player`: loadout, owned equipment, and permanent ship upgrades
- `hub`: deposited debris, facilities, construction, and restoration state
- `narrative`: story checkpoints and semantic NPC locations
- `dialogue`: conversations the player has seen
- `unlocks`: blueprints, abilities, and discovered content
- `stats`: lifetime and completed-run summaries

Domain services validate their section, merge defaults for missing fields, and expose
game-specific mutations. Each completed progression event writes immediately through
`writeProfileSection`. World entities are reconstructed from semantic state such as
`burtHubLocation: "center"`; raw screen coordinates are not saved because layouts can
change between versions.

Active room enemies, projectiles, temporary pickups, and the current procedural floor
remain run state. If run resume is added, it should use a separate versioned run snapshot
that can be discarded without damaging permanent progression. Audio, display, debug,
and other device preferences also remain separate from the profile.

Existing storage keys are migrated section by section. A domain first reads its new
profile section, imports and validates its legacy key when that section is absent, writes
the migrated section, and then removes the legacy key. Schema changes increment the
profile version and add an explicit migration before runtime services receive the data.
