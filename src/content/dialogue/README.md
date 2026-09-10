# SpaceDaze dialogue

All player-facing dialogue copy lives in this directory. Files are grouped by
character or narrative sequence and exported through `dialogueCatalog.ts`.

Cutscene choreography remains with the feature that performs it. Camera moves,
actor movement, emotions, progression checks, sounds, and spawned objects should
reference named dialogue sections instead of containing dialogue text directly.

## Editing a line

Plain dialogue uses a speaker and text:

```ts
{
	speaker: "BURT",
	text: "Keep moving.",
}
```

Use text segments only when a line needs a pause, color, reference, sound, flash,
or shake. Keep named sections stable so cutscene code never needs numeric slices.

Run `npm run test:npc-dialogue` after editing dialogue content.
