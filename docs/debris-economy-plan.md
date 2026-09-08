# Debris Economy Plan

## Implementation status

- Phase 1 foundation is implemented.
- Phase 2 pickup sprites, denomination splitting, atlas loading, tinting, pickup
  pitch, and collection flashes are implemented.
- Phase 2 draw-call profiling and the later phases remain to be tuned through
  representative playtests.

## Product rules

- **Debris** is the physical object that drops into the world.
- **Salvage** is the spendable value collected from debris.
- **Restoration** is lifetime deposited salvage and advances the hub. It is progress, not another wallet.
- Reroll tokens and blueprints remain rare utility items. Do not add another general currency until the salvage loop is balanced.

## Phase 1 — Repair the foundation

- Remove repeatable economic debris and crates from the hub.
- Use `SALVAGE` consistently for balances, costs, deposits, and losses in player-facing UI.
- Award run XP directly from defeated targets rather than from post-multiplier salvage value.
- Preserve carried-versus-safe salvage and existing deposit risk.

Acceptance criteria:

- Reloading the hub cannot create spendable salvage or reroll tokens.
- Salvage-value and threat-economy multipliers do not increase run XP.
- No player-facing currency prompt calls salvage `DEBREE`, `DEBRIS`, or `SCRAP`.

## Phase 2 — Make pickups satisfying

- Replace scaled asteroid pickups with a native 16x16 four-denomination set:
  - 1 salvage: white metal shard.
  - 3 salvage: blue machine plate.
  - 5 salvage: gold salvage core.
  - 10 salvage: purple reactor fragment.
- Use an explicit atlas so the repeated pickup set remains batch-friendly.
- Reduce the number of spawned objects while preserving total salvage value.
- Give each denomination a distinct silhouette, size, tint, pickup pitch, and impact intensity.
- Keep attraction readable: short anticipation, fast magnetic arc, crisp collection flash, consolidated gain number.

Acceptance criteria:

- Every denomination is identifiable at native size without relying only on color.
- A 50-salvage drop produces substantially fewer objects than the current system.
- Draw calls do not regress in a controlled scene.

## Phase 3 — Strengthen deposit decisions

- Animate the transfer from `CARRIED` to `SAFE` in the relay panel and HUD.
- Scale relay intake effects and audio with the amount deposited.
- Add deposit milestones that grant a small immediate run benefit without minting more salvage.
- Make the post-run Restoration gain visibly affect the hub.

Candidate milestone rewards: a small repair, shield charge, or one reroll token at a deliberately tuned threshold.

## Phase 4 — Add meaningful run sinks

- Balance around two to four meaningful purchases per successful expedition.
- Add focused salvage spends: emergency repair, temporary weapon overcharge, map reveal, route reroll, and extraction insurance.
- Keep prices legible and avoid low-impact micro-purchases.

## Phase 5 — Tune with telemetry

- Compare salvage earned, spent, deposited, and lost by run depth and outcome.
- Track purchases by sink and relay deposit choices.
- Tune hub thresholds and prices only after representative real runs.
- Review whether Restoration pacing remains satisfying after removing hub farming.

## Optional future currency

Only add a rare permanent currency if the tuned salvage economy cannot support capstone progression. The preferred candidate is **Anomaly Cores**, earned from bosses and major challenges, never dropped by ordinary enemies, and never lost on death.
