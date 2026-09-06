---
name: spacedaze-dialogue-emotions
description: Write, stage, implement, or review SpaceDaze NPC dialogue, reaction emotes, and cutscene timing. Use when adding conversations, character reactions, comedic beats, emotional pauses, dialogue sounds, or camera and actor choreography around dialogue.
---

# SpaceDaze Dialogue and Emotions

Make conversations feel performed by small expressive machines, not printed by a text box. Use short lines, visible reactions, deliberate silence, and physical staging to reveal personality.

Golden Sun is the tonal reference for characters reacting through overhead emotion icons and small in-engine movements between lines. Preserve that expressiveness, but not its frequently criticized length: SpaceDaze dialogue should reach the reaction and punchline quickly. Do not copy Golden Sun dialogue, characters, or art.

When creating or changing emote sprites, also follow `spacedaze-art-style` and `spacedaze-assets`.

## Know the systems

- `src/services/dialogService.ts` renders `DialogueLine` sequences and supports timed text segments, manual or automatic advance, live or paused gameplay, overlay control, references, text cues, and dialogue shake.
- `src/services/emotionService.ts` owns the available `EmotionId` values and displays one active emotion per actor.
- `src/services/cutsceneService.ts` sequences dialogue, emotions, waits, movement, camera changes, parallel actions, and cleanup.
- NPC examples live under `src/spawn/npcs`.

Do not bypass these services with ad hoc text or sprite objects.

## Emotion vocabulary

Use the narrowest matching emotion:

| Emotion | Meaning and typical use |
| --- | --- |
| `dialogue` | Ambient dots indicating unseen dialogue is available. Usually owned by `npcDialogueIndicatorService`, not narrative choreography. |
| `alert` | A single sharp notice, interruption, or sudden attention. |
| `question` | Confusion, doubt, suspicion, or processing something odd. |
| `surprised` | A stronger shock or sudden reversal than `alert`. |
| `awkward` | Social discomfort, strained silence, or a statement nobody wants to answer. |
| `idea` | A realization, plan, confident deduction, or dangerous inspiration. |
| `angry` | Frustration, confrontation, determination, or a comic overreaction. |
| `happy` | Relief, delight, pride, or open celebration. |
| `laugh` | Audible amusement or a joke landing; stronger and more performative than `happy`. |
| `sad` | Loss, disappointment, regret, or a deflated reaction. |
| `heartbroken` | Personal emotional hurt, rejection, or grief stronger than ordinary sadness. |
| `fear` | Alarm, panic, social dread, or realizing consequences. |
| `dizzy` | Disorientation, impact, overload, or logic failing to compute. |
| `sleep` | Idling, boredom, exhaustion, or ignoring someone. |
| `love` | Affection, gratitude, attachment, or excessive enthusiasm. |
| `music` | Singing, humming, music starting, or an ominous promise to perform. |
| `impressed` | Awe, admiration, wonder, or seeing something exceptional. |

The icon must be unambiguous in context. If `alert`, `surprised`, and `fear` could all fit, choose based on intensity and consequence instead of stacking them.

## Stage reactions, not annotations

- Show emotions on the character who is reacting, which is often the listener rather than the next speaker.
- Let an icon add subtext instead of repeating the words. A character saying “I am angry” under an angry icon wastes the visual beat.
- Prefer one strong reaction at a turn in the conversation. Do not place an emote above someone after every line.
- Allow silent characters to participate through an icon, a turn, a small move, or a pause. This is the most useful Golden Sun influence: the group visibly processes what was said.
- Use contrast between words and reaction for character comedy when intentional: a droid can insist it is calm while an angry icon gives it away.
- Give recurring NPCs consistent reaction habits. One may hide embarrassment behind `angry`; another may move rapidly from `question` to `idea`.

An emotion cutscene step is non-blocking: it starts the icon and immediately proceeds. Add an explicit `wait` after it when the audience needs to see the reaction before dialogue or action continues.

## Timing language

Use these as starting ranges, then tune in the running scene:

| Beat | Duration | Use |
| --- | ---: | --- |
| Micro beat | 0.12–0.22 s | Turn, tiny hesitation, sound lead-in. |
| Reaction beat | 0.28–0.45 s | Icon appears before the response. |
| Comedic beat | 0.55–0.85 s | Let an absurd statement or visual contradiction land. |
| Heavy silence | 0.9–1.4 s | Grief, dread, or a major reveal; use rarely. |
| Emotion visibility | 1.4–2.6 s | Normal narrative reaction spanning the beat and response. |

The emotion service already spends about 0.16 seconds entering and 0.24 seconds exiting. Durations below roughly 0.7 seconds tend to feel like flicker rather than a readable icon.

For pauses inside a line, split `DialogueLine.text` into segments and use `waitAfter`:

- 0.12–0.2 seconds for a small rhetorical catch.
- 0.25–0.4 seconds for hesitation or a change in thought.
- 0.4–0.65 seconds immediately before or after a reveal or punch word.
- Longer than 0.8 seconds only when the silence itself is the point.

Do not scatter pauses at every comma. One intentional pause is usually stronger than several mechanical ones.

`holdAfter` affects automatic lines. A line with `autoAdvance: true` otherwise advances immediately when complete, so set `holdAfter` explicitly when the player must read or feel it. Manual dialogue should normally leave the final advance to the player.

## Comedic construction

Build most jokes from two or three distinct beats:

1. **Setup:** A short sincere claim or expectation.
2. **Reaction:** The listener emotes or physically processes it; wait long enough for recognition.
3. **Turn:** A dry correction, escalation, reveal, or immediate consequence.

Useful SpaceDaze patterns include:

- Confident technical claim → `question` from another droid → humiliating clarification.
- Grand declaration → short silence → mundane system error.
- `idea` → determined line → immediate explosion or failure → surviving character reacts.
- Emotional statement → literal engineering interpretation.
- Repeated behavior twice → third attempt breaks the pattern.

End close to the strongest line or visual result. Do not explain the joke afterward. Avoid leaning on ellipses alone; an icon, pause, turn, movement, or sound should carry the timing.

## Conversation pacing

- Write one thought per dialogue box. Two short sentences are usually the maximum before another character or visual beat should respond.
- Alternate speakers or reactions so exposition becomes an exchange.
- Cut greetings, repeated agreement, and summaries unless they establish character.
- Let animations and icons replace prose such as “Burt looked confused.”
- Keep ordinary hub conversations brief. Longer scenes must earn their length through a reveal, relationship change, or staged event.
- Preserve player control for ordinary NPC conversations: use live gameplay, manual advance, passthrough input, and no dark overlay unless the scene explicitly requires another mode.
- Use a paused cutscene only when choreography, danger, or camera control requires it. Keep visual effects live unless freezing them is intentional.
- Camera zoom should gently frame an important scene, not announce every conversation.

The default ordinary NPC dialogue options are:

```ts
options: {
	gameplay: "live",
	advance: "manual",
	input: "passthrough",
	overlayOpacity: 0,
}
```

## Implementation pattern

This reaction-before-response pattern creates a visible comic beat:

```ts
steps: [
	{
		type: "dialogue",
		lines: [{
			speaker: "BURT",
			text: "I repaired the pressure seal.",
		}],
		options: {
			gameplay: "live",
			advance: "manual",
			input: "passthrough",
			overlayOpacity: 0,
		},
	},
	{
		type: "emotion",
		actor: "listener",
		emotion: "question",
		options: { duration: 1.8, priority: "narrative" },
	},
	{ type: "wait", duration: 0.42 },
	{
		type: "dialogue",
		lines: [{
			speaker: "BURT",
			text: [
				{ text: "Mostly.", waitAfter: 0.6 },
				{ text: " Do not lean on it." },
			],
		}],
		options: {
			gameplay: "live",
			advance: "manual",
			input: "passthrough",
			overlayOpacity: 0,
		},
	},
]
```

Resolve every actor name used by an emotion or movement step through `playCutscene({ resolveActor })`. Use `priority: "narrative"` for authored cutscene reactions so ambient dialogue indicators cannot replace them. Normal same-or-higher-priority emotions replace the current emotion on that actor; avoid accidental rapid replacement.

## Sound and movement

- A soft pitched UI sound can sharpen an important icon, but do not sound every routine reaction.
- Match pitch and energy to meaning: lower/softer for doubt or sadness, higher/snappier for ideas and surprise.
- Keep emotion sounds positional when they belong to a world actor.
- Pair movement with a reaction when it changes the beat: face the speaker, recoil, approach, drift away, or hold perfectly still.
- Use `parallel` when camera and actor movement should happen together; use sequential steps when the delay is part of the joke.

## Review in motion

Play the entire conversation without reading the source. Check:

- Can the reaction target and emotion be understood immediately?
- Does each pause have a dramatic or comedic job?
- Can the player read manual dialogue comfortably without losing world control?
- Is any icon redundant with the spoken line?
- Does the next line arrive after the reaction registers, but before the energy dies?
- Could a line be removed while preserving the setup and payoff?
- Does the scene clean up emotions, restore its camera, and return interaction state when completed, skipped, or cancelled?

When a joke feels slow, remove a line before shortening every pause. When it feels flat, add a reaction beat before adding more words.
