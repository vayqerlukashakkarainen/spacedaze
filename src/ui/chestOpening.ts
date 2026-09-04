import { GameObj, Vec2 } from "kaplay";
import {
	getScore,
	k,
	layers,
	mainSoundVolume,
	spendScore,
} from "../main";
import {
	ChestReward,
	generateChestRewardChoices,
	Rarity,
} from "../chestRewards";
import { audioService } from "../services/audioService";
import { shake } from "../comp/shake";
import { applyReward, REWARD_RARITY_COLORS } from "../services/rewardService";
import { getUiEffects } from "../particles";
import { addCollectedPowerup } from "./gameUi";
import {
	consumeNextChestDifficulty,
	createChestChallengeConfig,
	normalizeChestChallengeHits,
	type ChestChallengeType,
} from "./chestChallenge";
import {
	addThemedText,
	createUiActionButton,
	createUiBadge,
	createUiPanel,
	createUiSectionHeader,
	createUiSelectableCard,
} from "./common";
import {
	incrementPerformanceCounter,
	recordSectionTime,
} from "../services/frameProfilerService";
import { registerBatchedUiUpdate } from "../services/uiUpdateService";
import {
	getRerollTokens,
	spendRerollToken,
} from "../player";

interface TimingZone {
	start: number; // 0-1
	end: number; // 0-1
	hit: boolean;
}

interface RewardRevealProfile {
	suspense: number;
	postRevealHold: number;
	riserSound?: string;
	popScale: number;
	duration: number;
	particleCount: number;
	detune: number;
	shake: number;
}

const REWARD_REVEAL_PROFILES: Record<Rarity, RewardRevealProfile> = {
	[Rarity.Common]: {
		suspense: 0.04,
		postRevealHold: 0.01,
		popScale: 1.18,
		duration: 0.13,
		particleCount: 14,
		detune: 0,
		shake: 0,
	},
	[Rarity.Uncommon]: {
		suspense: 0.07,
		postRevealHold: 0.03,
		popScale: 1.32,
		duration: 0.15,
		particleCount: 24,
		detune: 120,
		shake: 1,
	},
	[Rarity.Rare]: {
		suspense: 0.12,
		postRevealHold: 0.07,
		popScale: 1.52,
		duration: 0.19,
		particleCount: 42,
		detune: 260,
		shake: 3,
	},
	[Rarity.Epic]: {
		suspense: 0.5,
		postRevealHold: 0.15,
		riserSound: "reward_riser_epic",
		popScale: 1.85,
		duration: 0.5,
		particleCount: 84,
		detune: 420,
		shake: 4,
	},
	[Rarity.Legendary]: {
		suspense: 1.3,
		postRevealHold: 0.25,
		riserSound: "reward_riser_legendary",
		popScale: 2.2,
		duration: 0.7,
		particleCount: 130,
		detune: 650,
		shake: 9,
	},
};

const CHEST_RETRY_COST = 20;

function isRarityAtLeast(rarity: Rarity, minimum: Rarity) {
	const rarityOrder = Object.values(Rarity);
	return rarityOrder.indexOf(rarity) >= rarityOrder.indexOf(minimum);
}

export function startChestOpeningSequence(onSequenceComplete?: () => void) {
	const center = k.center();
	const challengeType: ChestChallengeType = k.rand() < 0.5
		? "linear"
		: "bezier";
	const challengeConfig = createChestChallengeConfig(
		consumeNextChestDifficulty(),
		challengeType
	);

	// Dark overlay background
	k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(0, 0, 0),
		k.opacity(0.8),
		k.fixed(),
		k.layer(layers.game),
		"chestUI",
	]);

	// Main container with state machine
	const chestController = k.add([
		k.pos(center),
		k.fixed(),
		k.layer(layers.ui),
		{
			onComplete: onSequenceComplete,
			challengeConfig,
			rewards: [] as ChestReward[],
			successfulHits: 0,
			failedAttempts: 0,
			totalFailures: 0,
			quality: 0,
			normalizedHits: 0,
			timingBarPosition: 0,
			timingBarSpeed: challengeConfig.speed,
			timingZones: [] as TimingZone[],
			zoneObjects: [] as GameObj[],
			passes: 0,
			maxPasses: challengeConfig.maxPasses,
			bezierPoints: [] as Vec2[],
			uiContainer: null as GameObj | null,
			borderBox: null as GameObj | null,
			crateSprite: null as GameObj | null,
			timingBarObj: null as GameObj | null,
			explosionStarted: false,
			explosionElapsed: 0,
			explosionScale: 1,
			spaceKeyHandler: undefined as any,
			barScale: k.vec2(1, 1),
			barTargetScale: k.vec2(1, 1),
			multiplierText: null as GameObj | null,
			rewardSprite: null as GameObj | null,
			detailControllers: [] as { cancel: () => void }[],
			detailObjects: [] as GameObj[],
			rerollExcludedIds: [] as string[],
		},
		k.state("initial", [
			"initial",
			"countdown",
			"timingGame",
			"explosion",
			"reveal",
			"reroll",
			"showDetails",
		]),
		"chestUI",
	]);
	const clearDetailInteractions = () => {
		for (const controller of chestController.detailControllers) {
			controller.cancel();
		}
		for (const object of chestController.detailObjects) {
			if (object.exists()) k.destroy(object);
		}
		chestController.detailControllers = [];
		chestController.detailObjects = [];
	};

	// State: Initial - Display chest briefly
	chestController.onStateEnter("initial", async () => {
		// White border box
		const boxWidth = Math.min(900, k.width() - 60);
		const boxHeight = Math.min(500, k.height() - 50);
		chestController.borderBox = chestController.add([
			k.pos(0, 0),
			k.rect(boxWidth, boxHeight),
			k.anchor("center"),
			k.color(0, 0, 0),
			k.outline(4, new k.Color(255, 255, 255)),
			k.scale(0.5),
			k.opacity(0),
			k.animate(),
			shake(),
		]);

		// Animate border box in
		chestController.borderBox.animate(
			"scale",
			[k.vec2(0.5, 0.5), k.vec2(1, 1)],
			{
				duration: 0.2,
				easing: k.easings.easeOutCubic,
				loops: 1,
			}
		);
		chestController.borderBox.animate("opacity", [0, 1], {
			duration: 0.2,
			loops: 1,
		});

		chestController.uiContainer = chestController.borderBox.add([k.pos(0, 0)]);

		// Upscaled crate sprite
		chestController.crateSprite = chestController.uiContainer.add([
			k.sprite("crate1", { width: 64, height: 64 }),
			k.pos(0, 0),
			k.anchor("center"),
			k.scale(1),
			shake(),
		]);

		// Multiplier text below crate
		chestController.multiplierText = chestController.uiContainer.add([
			k.text("x0", { size: 24, font: "unscii" }),
			k.pos(0, 50),
			k.anchor("center"),
			k.scale(1),
			k.opacity(0),
			k.animate(),
		]);

		chestController.enterState("countdown");
	});

	chestController.onStateEnter("countdown", async () => {
		if (!chestController.uiContainer) return;
		const modeLabel = chestController.uiContainer.add([
			k.text(
				`${challengeConfig.type === "bezier" ? "CURVE LOCK" : "TIMING LOCK"}  •  DIFFICULTY ${challengeConfig.difficulty}`,
				{ size: 14, font: "unscii" }
			),
			k.pos(0, -115),
			k.anchor("center"),
			k.color(150, 205, 255),
		]);
		const countdown = chestController.uiContainer.add([
			k.text("3", { size: 64, font: "unscii" }),
			k.pos(0, 90),
			k.anchor("center"),
			k.color(k.WHITE),
			k.scale(1),
			k.animate(),
		]);

		for (const value of [3, 2, 1]) {
			countdown.text = `${value}`;
			countdown.scale = k.vec2(1.45);
			countdown.animate("scale", [k.vec2(1.45), k.vec2(1)], {
				duration: 0.5,
				loops: 1,
				easing: k.easings.easeOutCubic,
			});
			audioService.playSound("collect1", {
				volume: mainSoundVolume * 0.55,
				detune: (3 - value) * 120,
			});
			await k.wait(0.65);
		}

		countdown.text = "GO";
		countdown.color = k.rgb(255, 165, 0);
		await k.wait(0.3);
		k.destroy(countdown);
		k.destroy(modeLabel);
		chestController.enterState("timingGame");
	});

	// State: Timing Game
	chestController.onStateEnter("timingGame", async () => {
		if (!chestController.uiContainer) return;

		const barWidth = 300;
		const barHeight = 10;
		const barY = 80;
		const isBezier = challengeConfig.type === "bezier";
		chestController.timingZones = [];
		chestController.zoneObjects = [];

		if (isBezier) {
			const curveDirection = k.rand() < 0.5 ? -1 : 1;
			const p0 = k.vec2(-barWidth / 2, barY);
			const p1 = k.vec2(-barWidth * 0.24, barY + 125 * curveDirection);
			const p2 = k.vec2(barWidth * 0.24, barY - 125 * curveDirection);
			const p3 = k.vec2(barWidth / 2, barY);
			chestController.bezierPoints = [p0, p1, p2, p3];
			const targetCenter = k.rand(0.32, 0.72);
			const hitWindow = challengeConfig.bezierHitWindow;
			chestController.timingZones.push({
				start: targetCenter - hitWindow / 2,
				end: targetCenter + hitWindow / 2,
				hit: false,
			});

			const pathPoints: Vec2[] = [];
			for (let index = 0; index <= 32; index++) {
				pathPoints.push(cubicBezierPoint(
					p0,
					p1,
					p2,
					p3,
					index / 32
				));
			}
			chestController.uiContainer.add([
				{
					draw() {
						k.drawLines({
							pts: pathPoints,
							width: 4,
							color: k.rgb(60, 60, 60),
						});
					},
				},
			]);
			const targetPos = cubicBezierPoint(p0, p1, p2, p3, targetCenter);
			const targetRadius = 5 + hitWindow * 50;
			const targetObj = chestController.uiContainer.add([
				k.circle(targetRadius),
				k.pos(targetPos),
				k.anchor("center"),
				k.color(255, 165, 0),
				k.outline(2, k.WHITE),
				k.opacity(1),
			]);
			chestController.zoneObjects.push(targetObj);
			chestController.timingBarObj = chestController.uiContainer.add([
				k.circle(5),
				k.pos(p0),
				k.anchor("center"),
				k.color(255, 255, 255),
				k.outline(2, k.rgb(100, 200, 255)),
			]);
		} else {
			const numZones = 3;
			const zoneWidth = challengeConfig.linearZoneWidth;
			for (let i = 0; i < numZones; i++) {
				const basePos = (i + 1) / (numZones + 1);
				const offset = k.rand(-0.1, 0.1);
				const start = k.clamp(
					basePos + offset - zoneWidth / 2,
					0,
					1 - zoneWidth
				);
				chestController.timingZones.push({
					start,
					end: start + zoneWidth,
					hit: false,
				});
			}

			chestController.uiContainer.add([
				k.rect(barWidth, barHeight),
				k.pos(-barWidth / 2, barY),
				k.color(60, 60, 60),
			]);
			for (const zone of chestController.timingZones) {
				const zoneStart = zone.start * barWidth;
				const zoneWidthPx = (zone.end - zone.start) * barWidth;
				const zoneObj = chestController.uiContainer.add([
					k.rect(zoneWidthPx, barHeight),
					k.pos(-barWidth / 2 + zoneStart, barY),
					k.color(255, 165, 0),
					k.opacity(1),
				]);
				chestController.zoneObjects.push(zoneObj);
			}
			chestController.timingBarObj = chestController.uiContainer.add([
				k.rect(4, barHeight + 10),
				k.pos(-barWidth / 2, barY + barHeight / 2),
				k.anchor("center"),
				k.color(255, 255, 255),
			]);
		}

		chestController.uiContainer.add([
			k.text(isBezier ? "FOLLOW THE CURVE" : "TIME ALL THREE", {
				size: 20,
				font: "unscii",
			}),
			k.pos(0, -120),
			k.anchor("center"),
		]);

		// Add help text
		chestController.uiContainer.add([
			k.text("PRESS SPACE", { size: 12, font: "unscii" }),
			k.pos(0, isBezier ? 175 : barY + 30),
			k.anchor("center"),
		]);

		// Reset timing state
		chestController.timingBarPosition = 0;
		chestController.passes = 0;
		chestController.successfulHits = 0;
		chestController.failedAttempts = 0;

		// Handle space key press
		const checkTimingHit = () => {
			const barWidth = 300;
			const barY = 80;
			let hitZone = false;
			for (let i = 0; i < chestController.timingZones.length; i++) {
				const zone = chestController.timingZones[i];
				if (zone.hit) continue;
				if (
					chestController.timingBarPosition >= zone.start &&
					chestController.timingBarPosition <= zone.end
				) {
					zone.hit = true;
					chestController.successfulHits++;
					hitZone = true;
					audioService.playSound("explosion1", {
						volume: mainSoundVolume,
						detune: chestController.successfulHits * 200,
					});
					k.shake(5);
					// Scale up on hit
					chestController.barTargetScale = k.vec2(6, 6);

					// Shake the crate
					if (
						chestController.crateSprite &&
						chestController.crateSprite.shake
					) {
						chestController.crateSprite.shake(10);
					}

					// Update multiplier text
					if (chestController.multiplierText) {
						chestController.multiplierText.text = `x${chestController.successfulHits}`;
						chestController.multiplierText.opacity = 1;

						// Calculate target scale: starts at 1, increases by 0.3 for each hit
						const targetScale = 1 + (chestController.successfulHits - 1) * 0.3;
						const popScale = targetScale * 1.5;

						// Pop animation
						chestController.multiplierText.animate(
							"scale",
							[
								k.vec2(targetScale, targetScale),
								k.vec2(popScale, popScale),
								k.vec2(targetScale, targetScale),
							],
							{
								loops: 1,
								duration: 0.3,
								timing: [0, 0.3, 1],
							}
						);
					}

					// Update zone opacity
					if (chestController.zoneObjects[i]) {
						chestController.zoneObjects[i].opacity = 0.3;
					}
					getUiEffects().explosionEmitter.pos = chestController.pos;
					getUiEffects().explosionEmitter.emit(15);

					break;
				}
			}
			if (!hitZone) {
				chestController.failedAttempts++;
				audioService.playSound("collect1", { volume: mainSoundVolume });
				// Scale down on miss
				chestController.barTargetScale = k.vec2(0.3, 0.3);
			}
			if (chestController.timingZones.every((z) => z.hit)) {
				if (chestController.spaceKeyHandler) {
					chestController.spaceKeyHandler.cancel();
				}
				chestController.enterState("explosion");
			}
		};

		chestController.spaceKeyHandler = k.onKeyPress("space", checkTimingHit);

		// Wait briefly then transition to timing game
		await k.wait(0.5);
	});

	chestController.onStateUpdate("timingGame", () => {
		const barWidth = 300;
		chestController.timingBarPosition +=
			chestController.timingBarSpeed * k.dt();

		if (chestController.timingBarPosition >= 1) {
			chestController.timingBarPosition = 0;
			chestController.passes++;

			if (chestController.passes >= chestController.maxPasses) {
				if (chestController.spaceKeyHandler) {
					chestController.spaceKeyHandler.cancel();
				}
				chestController.enterState("explosion");
				return;
			}
		}

		// Lerp bar scale back to 1
		chestController.barScale.x = k.lerp(
			chestController.barScale.x,
			chestController.barTargetScale.x,
			10 * k.dt()
		);
		chestController.barScale.y = k.lerp(
			chestController.barScale.y,
			chestController.barTargetScale.y,
			10 * k.dt()
		);
		chestController.barTargetScale.x = k.lerp(
			chestController.barTargetScale.x,
			1,
			8 * k.dt()
		);
		chestController.barTargetScale.y = k.lerp(
			chestController.barTargetScale.y,
			1,
			8 * k.dt()
		);

		if (chestController.timingBarObj) {
			if (
				challengeConfig.type === "bezier" &&
				chestController.bezierPoints.length === 4
			) {
				chestController.timingBarObj.pos = cubicBezierPoint(
					chestController.bezierPoints[0],
					chestController.bezierPoints[1],
					chestController.bezierPoints[2],
					chestController.bezierPoints[3],
					chestController.timingBarPosition
				);
			} else {
				const newX =
					-barWidth / 2 + chestController.timingBarPosition * barWidth;
				chestController.timingBarObj.pos = k.vec2(newX, 85);
			}
			chestController.timingBarObj.scale = chestController.barScale;
		}

		getUiEffects().explosionEmitter.pos = k.vec2(200, 200);
		getUiEffects().explosionEmitter.emit(15);
	});

	// State: Explosion
	chestController.onStateEnter("explosion", () => {
		chestController.explosionStarted = true;
		chestController.explosionElapsed = 0;
		chestController.explosionScale = 1;
	});

	chestController.onStateUpdate("explosion", () => {
		const scaleDuration = 0.3;
		const startScale = 1;
		const targetScale = 2;

		chestController.explosionElapsed += k.dt();
		const t = Math.min(chestController.explosionElapsed / scaleDuration, 1);
		chestController.explosionScale =
			startScale + (targetScale - startScale) * t;

		if (chestController.crateSprite) {
			chestController.crateSprite.scale = k.vec2(
				chestController.explosionScale,
				chestController.explosionScale
			);
		}

		if (t >= 1 && chestController.explosionStarted) {
			chestController.explosionStarted = false;

			spawnChestGravityBurst(chestController.pos);
			spawnChestExplosionEffect(chestController.pos);
			k.shake(7);
			if (chestController.borderBox?.shake) {
				chestController.borderBox.shake(5);
			}

			// Play explosion sound
			audioService.playSound("explosion4", { volume: mainSoundVolume });

			// Remove crate sprite
			if (chestController.crateSprite) {
				k.destroy(chestController.crateSprite);
				chestController.crateSprite = null;
			}

			chestController.enterState("reveal");
		}
	});

	// State: Reveal
	chestController.onStateEnter("reveal", async () => {
		const normalizedHits = normalizeChestChallengeHits(
			challengeConfig.type,
			chestController.successfulHits
		);
		chestController.normalizedHits = normalizedHits;
		const result = generateChestRewardChoices(
			normalizedHits,
			chestController.failedAttempts
		);
		chestController.rewards = result.rewards;
		chestController.totalFailures = result.failures;
		chestController.quality = result.quality;

		if (chestController.rewards.length === 0) {
			if (chestController.onComplete) {
				chestController.onComplete();
			}
			return;
		}

		// Clear old UI container content but keep the border box
		if (chestController.uiContainer) {
			chestController.uiContainer.removeAll();
		}

		chestController.uiContainer.add([
			k.text("CRATE OPENED", { size: 22, font: "unscii" }),
			k.pos(0, -150),
			k.anchor("center"),
		]);

		const layout = getRewardCardLayout(
			chestController.borderBox?.width ?? 840,
			chestController.rewards.length
		);
		const concealedSlots = chestController.rewards.map((_, index) => {
			const slot = chestController.uiContainer!.add([
				k.rect(82, 98),
				k.pos(layout.cardX(index), layout.iconY),
				k.anchor("center"),
				k.color(6, 6, 10),
				k.outline(2, k.rgb(70, 70, 80)),
				k.opacity(0.85),
			]);
			slot.add([
				k.text("?", { size: 30, font: "unscii" }),
				k.anchor("center"),
				k.color(100, 100, 110),
			]);
			return slot;
		});
		for (let index = 0; index < chestController.rewards.length; index++) {
			const reward = chestController.rewards[index];
			const profile = REWARD_REVEAL_PROFILES[reward.rarity];
			const target = k.vec2(layout.cardX(index), layout.iconY);
			const revealShakeRamp = reward.rarity === Rarity.Legendary
				? startRevealShakeRamp(
						profile.suspense,
						7.5,
						chestController.borderBox ?? undefined
					)
				: reward.rarity === Rarity.Epic
					? startRevealShakeRamp(
							profile.suspense,
							2.4,
							chestController.borderBox ?? undefined
						)
					: undefined;
			if (profile.riserSound) {
				const riser = audioService.playSound(profile.riserSound, {
					volume: mainSoundVolume * 0.85,
				});
				if (reward.rarity === Rarity.Epic) riser.speed = 0.62;
				if (reward.rarity === Rarity.Legendary) riser.speed = 0.5;
			}
			await k.wait(profile.suspense);
			if (!chestController.uiContainer?.exists()) return;
			revealShakeRamp?.cancel();

			const concealedSlot = concealedSlots[index];
			if (concealedSlot.exists()) {
				concealedSlot.removeAll();
				concealedSlot.opacity = 1;
			}

			const rewardSprite = chestController.uiContainer.add([
				k.sprite(reward.sprite, { width: 64, height: 64 }),
				k.pos(target),
				k.anchor("center"),
				k.scale(0.05),
				k.opacity(0),
				k.animate(),
			]);
			rewardSprite.animate("opacity", [0, 1], {
				duration: 0.1,
				loops: 1,
			});
			rewardSprite.animate(
				"scale",
				[k.vec2(0.05), k.vec2(profile.popScale), k.vec2(1)],
				{
					duration: profile.duration,
					loops: 1,
					timing: [0, 0.42, 1],
					easing: k.easings.easeOutCubic,
				}
			);
			const rarityColor = REWARD_RARITY_COLORS[reward.rarity];
			chestController.uiContainer.add([
				k.text(reward.rarity, { size: 9, font: "unscii" }),
				k.pos(target.x, target.y + 52),
				k.anchor("center"),
				k.color(...rarityColor),
				k.opacity(0),
				k.animate(),
			]).animate("opacity", [0, 1], {
				duration: 0.18,
				loops: 1,
			});

			audioService.playSound("powerup1", {
				volume: mainSoundVolume,
				detune: profile.detune,
			});
			if (isRarityAtLeast(reward.rarity, Rarity.Epic)) {
				audioService.playSound("explosion2", {
					volume:
						mainSoundVolume *
						(reward.rarity === Rarity.Legendary ? 0.75 : 0.45),
					detune: reward.rarity === Rarity.Legendary ? 320 : 180,
				});
			}
			if (reward.rarity === Rarity.Legendary) {
				audioService.playSound("reward_shine_legendary", {
					volume: mainSoundVolume * 0.9,
				});
			}
			if (profile.shake > 0) k.shake(profile.shake);
			spawnRewardRevealBurst(
				k.center().add(target),
				rarityColor,
				profile
			);

			await k.wait(
				profile.duration * 0.35 + profile.postRevealHold
			);
		}

		await k.wait(0.15);
		if (chestController.exists()) {
			chestController.enterState("showDetails");
		}
	});

	chestController.onStateEnter("reroll", async () => {
		if (!chestController.uiContainer) return;
		chestController.uiContainer.removeAll();
		const statusSize = k.vec2(360, 88);
		const statusPanel = createUiPanel({
			pos: k.center().sub(statusSize.scale(0.5)),
			size: statusSize,
			tags: ["chestUI"],
		});
		createUiSectionHeader(statusPanel, {
			pos: k.vec2(12, 10),
			width: statusSize.x - 24,
			eyebrow: "CHEST MATRIX",
			title: "RECALIBRATING REWARDS",
		});
		chestController.detailObjects.push(statusPanel);
		await k.wait(0.18);
		if (!chestController.exists()) return;
		clearDetailInteractions();
		const result = generateChestRewardChoices(
			chestController.normalizedHits,
			chestController.failedAttempts,
			chestController.rerollExcludedIds
		);
		chestController.rewards = result.rewards;
		chestController.totalFailures = result.failures;
		chestController.quality = result.quality;
		chestController.enterState("showDetails");
	});

	// State: Show Details
	chestController.onStateEnter("showDetails", () => {
		if (!chestController.uiContainer || chestController.rewards.length === 0) return;
		clearDetailInteractions();
		chestController.uiContainer.removeAll();
		if (chestController.borderBox) chestController.borderBox.opacity = 0;

		const choiceCount = chestController.rewards.length;
		const performanceLabel = chestController.totalFailures === 0
			? "PERFECT OPEN"
			: `${chestController.totalFailures} FAILURE${chestController.totalFailures === 1 ? "" : "S"}`;
		const panelWidth = Math.min(900, k.width() - 48);
		const panelHeight = Math.min(560, k.height() - 48);
		const panel = createUiPanel({
			pos: k.vec2(
				(k.width() - panelWidth) / 2,
				(k.height() - panelHeight) / 2
			),
			size: k.vec2(panelWidth, panelHeight),
			tags: ["chestUI"],
		});
		chestController.detailObjects.push(panel);
		const rerollTokenCount = getRerollTokens();
		const availableSalvage = getScore();
		createUiSectionHeader(panel, {
			pos: k.vec2(16, 12),
			width: panelWidth - 32,
			eyebrow: performanceLabel,
			title: `SELECT REWARD  /  1 OF ${choiceCount}`,
			action: `${rerollTokenCount} REROLL TOKEN${rerollTokenCount === 1 ? "" : "S"}`,
		});

		const layout = getRewardCardLayout(
			panelWidth - 32,
			choiceCount
		);
		const { cardWidth, cardHeight } = layout;
		const cardTop = 82;
		const cardStagger = 0.03;
		chestController.rewards.forEach((reward, index) => {
			if (!isRarityAtLeast(reward.rarity, Rarity.Epic)) return;
			addEpicRewardShine(
				panel,
				k.vec2(
					panelWidth / 2 + layout.cardX(index),
					cardTop + cardHeight / 2
				),
				REWARD_RARITY_COLORS[reward.rarity],
				index * cardStagger
			);
		});

		let accepted = false;
		const acceptControllers = chestController.detailControllers;
		const acceptReward = (reward: ChestReward) => {
			if (accepted) return;
			accepted = true;

			if (!applyReward(reward, k.center())) {
				accepted = false;
				return;
			}
			addCollectedPowerup(reward);

			// Play purchase sound
			audioService.playSound("purchase1", { volume: mainSoundVolume });

			clearDetailInteractions();

			// Kaplay doesn't recursively destroy child objects with destroyAll().
			// Remove the controller tree first so reward visuals cannot linger.
			chestController.removeAll();
			k.destroyAll("chestUI");

			if (chestController.onComplete) {
				chestController.onComplete();
			}
		};
		const rerollRewards = () => {
			if (accepted || !spendRerollToken()) return;
			accepted = true;
			chestController.rerollExcludedIds = chestController.rewards.map(
				(reward) => reward.id
			);
			clearDetailInteractions();
			audioService.playSound("purchase1", { volume: mainSoundVolume });
			chestController.enterState("reroll");
		};
		const retryChallenge = () => {
			if (accepted || !spendScore(CHEST_RETRY_COST)) return;
			accepted = true;
			clearDetailInteractions();
			audioService.playSound("purchase1", { volume: mainSoundVolume });
			chestController.removeAll();
			chestController.uiContainer = null;
			chestController.borderBox = null;
			chestController.crateSprite = null;
			chestController.multiplierText = null;
			chestController.timingBarObj = null;
			chestController.rewardSprite = null;
			chestController.enterState("initial");
		};
		const tokenLabel = rerollTokenCount === 1 ? "TOKEN" : "TOKENS";
		const actionGap = 12;
		const actionWidth = Math.min(240, (panelWidth - 64 - actionGap) / 2);
		const actionRowWidth = actionWidth * 2 + actionGap;
		const actionStartX = (panelWidth - actionRowWidth) / 2;
		createUiActionButton(panel, {
			pos: k.vec2(actionStartX, panelHeight - 50),
			size: k.vec2(actionWidth, 32),
			text: `PRESS R TO REROLL  //  ${rerollTokenCount} ${tokenLabel}`,
			disabled: rerollTokenCount === 0,
			icon: "reroll_token",
			onClick: rerollRewards,
		});
		createUiActionButton(panel, {
			pos: k.vec2(actionStartX + actionWidth + actionGap, panelHeight - 50),
			size: k.vec2(actionWidth, 32),
			text: `PRESS T TO RETRY  //  ${CHEST_RETRY_COST}`,
			disabled: availableSalvage < CHEST_RETRY_COST,
			icon: "debree_part1",
			onClick: retryChallenge,
		});
		if (rerollTokenCount > 0) {
			acceptControllers.push(k.onKeyPress("r", rerollRewards));
		}
		if (availableSalvage >= CHEST_RETRY_COST) {
			acceptControllers.push(k.onKeyPress("t", retryChallenge));
		}

		chestController.rewards.forEach((reward, index) => {
			const rarityColor = REWARD_RARITY_COLORS[reward.rarity];
			const cardCenterX = panelWidth / 2 + layout.cardX(index);
			const animationDelay = index * cardStagger;
			const cardReveal = panel.add([
				k.pos(cardCenterX, cardTop + cardHeight / 2),
				k.scale(0.96),
				k.opacity(0),
				k.animate(),
			]);
			const cardControl = createUiSelectableCard(cardReveal, {
				pos: k.vec2(-cardWidth / 2, -cardHeight / 2),
				size: k.vec2(cardWidth, cardHeight),
				onClick: () => {
					if (cardReveal.opacity < 1) return;
					acceptReward(reward);
				},
			});
			const card = cardControl.obj;
			cardReveal.animate("opacity", [0, 1], {
				duration: 0.24,
				delay: animationDelay,
				loops: 1,
			});
			cardReveal.animate("scale", [k.vec2(0.96), k.vec2(1.025), k.vec2(1)], {
				duration: 0.42,
				delay: animationDelay,
				loops: 1,
				timing: [0, 0.72, 1],
				easing: k.easings.easeOutCubic,
			});

			card.add([
				k.sprite(reward.sprite, { width: 56, height: 56 }),
				k.pos(cardWidth / 2, 42),
				k.anchor("center"),
				k.z(3),
			]);
			createUiBadge(card, {
				pos: k.vec2(12, 76),
				width: cardWidth - 24,
				text: `${reward.rarity} ${reward.kind.toUpperCase()}`,
				color: rarityColor,
			});
			addThemedText(card, {
				text: reward.name,
				pos: k.vec2(12, 108),
				variant: "heading",
				size: 12,
				width: cardWidth - 24,
				align: "center",
				lineHeight: 1.45,
				color: k.WHITE,
				z: 3,
			});
			addThemedText(card, {
				text: reward.description,
				pos: k.vec2(14, 174),
				variant: "body",
				size: 9,
				width: cardWidth - 28,
				align: "center",
				lineHeight: 1.4,
				z: 3,
			});
			const rewardStats = Object.entries(reward.stats)
				.map(([stat, value]) => `${stat}: ${value}`)
				.join("\n");
			addThemedText(card, {
				text: rewardStats,
				pos: k.vec2(14, 250),
				variant: "stat",
				size: 9,
				width: cardWidth - 28,
				align: "center",
				color: k.rgb(100, 200, 255),
				z: 3,
			});
			addThemedText(card, {
				text: `PRESS ${index + 1} TO SELECT`,
				pos: k.vec2(14, cardHeight - 28),
				variant: "caption",
				width: cardWidth - 28,
				align: "center",
				z: 3,
			});
			if (reward.rarity === Rarity.Legendary) {
				addLegendaryCardSweep(
					card,
					cardWidth,
					cardHeight,
					animationDelay + 0.18
				);
			}
			acceptControllers.push(k.onKeyPress(`${index + 1}`, () => acceptReward(reward)));
		});

		acceptControllers.push(k.onKeyPress("enter", () => {
			acceptReward(chestController.rewards[0]);
		}));
	});

	// Start state machine
	chestController.enterState("initial");
}

function addLegendaryCardSweep(
	card: GameObj,
	cardWidth: number,
	cardHeight: number,
	delay: number
) {
	const startX = -cardWidth / 2 - 54;
	const endX = cardWidth / 2 + 54;
	const sweepDuration = 0.72;
	const sweepMask = card.add([
		k.rect(cardWidth - 6, cardHeight - 6),
		k.pos(cardWidth / 2, cardHeight / 2),
		k.anchor("center"),
		k.mask("intersect"),
	]);
	const glow = sweepMask.add([
		k.rect(48, cardHeight * 1.35),
		k.pos(startX, 0),
		k.anchor("center"),
		k.rotate(-12),
		k.color(255, 205, 90),
		k.opacity(0),
		k.animate(),
		k.z(20),
	]);
	const core = sweepMask.add([
		k.rect(10, cardHeight * 1.35),
		k.pos(startX, 0),
		k.anchor("center"),
		k.rotate(-12),
		k.color(k.WHITE),
		k.opacity(0),
		k.animate(),
		k.z(21),
	]);

	for (const light of [glow, core]) {
		light.animate("pos", [k.vec2(startX, 0), k.vec2(endX, 0)], {
			duration: sweepDuration,
			delay,
			loops: 1,
			easing: k.easings.easeInOutCubic,
		});
	}
	glow.animate("opacity", [0, 0.34, 0.34, 0], {
		duration: sweepDuration,
		delay,
		loops: 1,
		timing: [0, 0.22, 0.72, 1],
	});
	core.animate("opacity", [0, 0.88, 0.88, 0], {
		duration: sweepDuration,
		delay,
		loops: 1,
		timing: [0, 0.2, 0.76, 1],
	});
}

function addEpicRewardShine(
	container: GameObj,
	pos: Vec2,
	colorValues: readonly [number, number, number],
	animationDelay: number
) {
	const rayColor = new k.Color(...colorValues);
	const rayCount = 16;
	const rays = container.add([
		k.pos(pos),
		k.rotate(0),
		k.scale(0.68, 0.84),
		k.opacity(0),
		k.animate(),
		{
			burstElapsed: -animationDelay,
		},
		{
			draw() {
				const reveal = this.opacity;
				if (reveal <= 0) return;
				const startedAt = performance.now();
				incrementPerformanceCounter("uiEffectPrimitives", 42);
				const pulse = k.wave(0.86, 1.12, k.time() * 2.5);
				const burstProgress = k.clamp(this.burstElapsed / 0.55, 0, 1);
				const burstOpacity = Math.sin(burstProgress * Math.PI) * reveal;

				k.drawCircle({
					pos: k.vec2(0),
					radius: 215 * pulse,
					color: rayColor,
					opacity: 0.035 * reveal,
					anchor: "center",
				});
				k.drawCircle({
					pos: k.vec2(0),
					radius: k.lerp(80, 255, burstProgress),
					color: k.WHITE,
					opacity: 0,
					anchor: "center",
					fill: false,
					outline: {
						width: 7,
						color: k.WHITE,
						opacity: 0.8 * burstOpacity,
					},
				});
				k.drawCircle({
					pos: k.vec2(0),
					radius: 192 * pulse,
					color: rayColor,
					opacity: 0,
					anchor: "center",
					fill: false,
					outline: {
						width: 3,
						color: rayColor,
						opacity: 0.7 * reveal,
					},
				});
				k.drawCircle({
					pos: k.vec2(0),
					radius: 212 / pulse,
					color: k.WHITE,
					opacity: 0,
					anchor: "center",
					fill: false,
					outline: {
						width: 1,
						color: k.WHITE,
						opacity: 0.38 * reveal,
					},
				});

				for (let index = 0; index < rayCount; index++) {
					const angle = index * (360 / rayCount);
					const halfWidth = index % 2 === 0 ? 8 : 4;
					const innerRadius = index % 2 === 0 ? 62 : 78;
					const outerRadius = (index % 3 === 0 ? 240 : 218) * pulse;
					k.drawPolygon({
						pts: [
							k.Vec2.fromAngle(angle - halfWidth).scale(innerRadius),
							k.Vec2.fromAngle(angle).scale(outerRadius),
							k.Vec2.fromAngle(angle + halfWidth).scale(innerRadius),
						],
						color: index % 2 === 0 ? rayColor : k.WHITE,
						opacity: (index % 2 === 0 ? 0.46 : 0.28) * reveal,
						opacities: [1, 0.82, 1],
					});
				}

				for (let index = 0; index < 10; index++) {
					const angle = index * 36 - this.angle * 2 + 12;
					const halfWidth = index % 2 === 0 ? 4 : 2;
					const outerRadius = (index % 2 === 0 ? 236 : 205) * pulse;
					k.drawPolygon({
						pts: [
							k.Vec2.fromAngle(angle - halfWidth).scale(88),
							k.Vec2.fromAngle(angle).scale(outerRadius),
							k.Vec2.fromAngle(angle + halfWidth).scale(88),
						],
						color: index % 3 === 0 ? k.WHITE : rayColor,
						opacity: (index % 3 === 0 ? 0.25 : 0.32) * reveal,
						opacities: [1, 0.65, 1],
					});
				}

				for (let index = 0; index < 12; index++) {
					const sparklePhase = k.time() * 2.8 + index * 0.7;
					const angle = index * 30 - this.angle * 1.5;
					const radius = 195 + Math.sin(sparklePhase) * 24;
					k.drawCircle({
						pos: k.Vec2.fromAngle(angle).scale(radius),
						radius: index % 3 === 0 ? 4 : 2,
						color: k.WHITE,
						opacity:
							(0.4 + (Math.sin(sparklePhase) + 1) * 0.3) * reveal,
						anchor: "center",
					});
				}
				recordSectionTime("uiEffectsDraw", performance.now() - startedAt);
			},
		},
	]);
	registerBatchedUiUpdate("overlay", rays, () => {
		const startedAt = performance.now();
		rays.angle += 14 * k.dt();
		rays.burstElapsed += k.dt();
		recordSectionTime("uiEffectsUpdate", performance.now() - startedAt);
	});
	rays.animate("opacity", [0, 1], {
		duration: 0.42,
		delay: animationDelay,
		loops: 1,
	});
	rays.animate(
		"scale",
		[k.vec2(0.68, 0.84), k.vec2(1.08, 1.32), k.vec2(0.96, 1.18)],
		{
			duration: 0.65,
			delay: animationDelay,
			loops: 1,
			timing: [0, 0.7, 1],
			easing: k.easings.easeOutCubic,
		}
	);

	return rays;
}

function startRevealShakeRamp(
	duration: number,
	maxIntensity: number,
	panel?: GameObj
) {
	let elapsed = 0;
	let shakeCooldown = 0;
	const controller = k.add(["chestUI"]);
	const cancelUpdate = registerBatchedUiUpdate("modal", controller, () => {
		elapsed += k.dt();
		shakeCooldown -= k.dt();
		if (shakeCooldown > 0) return;

		const progress = k.clamp(elapsed / Math.max(duration, 0.01), 0, 1);
		const intensity = k.lerp(0.2, maxIntensity, progress * progress);
		k.shake(intensity);
		if (panel?.exists() && panel.shake) {
			panel.shake(intensity * 0.28);
		}
		shakeCooldown = k.lerp(0.16, 0.035, progress);
		if (progress >= 1) k.destroy(controller);
	});
	return {
		cancel() {
			cancelUpdate();
			if (controller.exists()) k.destroy(controller);
		},
	};
}

function getRewardCardLayout(boxWidth: number, choiceCount: number) {
	const gap = 18;
	const cardWidth = Math.min(
		270,
		(boxWidth - 60 - gap * (choiceCount - 1)) / choiceCount
	);
	const cardHeight = 360;
	const rowWidth = cardWidth * choiceCount + gap * (choiceCount - 1);

	return {
		cardWidth,
		cardHeight,
		iconY: -120,
		cardX: (index: number) =>
			-rowWidth / 2 + cardWidth / 2 + index * (cardWidth + gap),
	};
}

function cubicBezierPoint(
	p0: Vec2,
	p1: Vec2,
	p2: Vec2,
	p3: Vec2,
	t: number
) {
	const inverse = 1 - t;
	return p0
		.scale(inverse * inverse * inverse)
		.add(p1.scale(3 * inverse * inverse * t))
		.add(p2.scale(3 * inverse * t * t))
		.add(p3.scale(t * t * t));
}

function spawnRewardRevealBurst(
	pos: Vec2,
	colorValues: readonly [number, number, number],
	profile: RewardRevealProfile
) {
	const rarityColor = new k.Color(...colorValues);
	const burst = k.add([
		k.pos(pos),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.opacity(1),
		k.lifespan(1.4),
		k.particles(
			{
				max: profile.particleCount,
				speed: [70 + profile.shake * 12, 150 + profile.shake * 28],
				angle: [0, 360],
				angularVelocity: [-220, 220],
				lifeTime: [0.35, 0.85 + profile.shake * 0.04],
				colors: [k.WHITE, rarityColor],
				opacities: [1, 0.9, 0],
				scales: [0.5, 2 + profile.shake * 0.2, 0.1],
				damping: [2, 4],
				texture: k.getSprite("particle4")!.data!.frames[0].tex,
				quads: [k.getSprite("particle4")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: 0,
				spread: 360,
				position: k.vec2(0),
			}
		),
		"chestUI",
	]);
	burst.emit(profile.particleCount);

	const flash = k.add([
		k.pos(pos),
		k.circle(18 + profile.shake * 2),
		k.anchor("center"),
		k.color(rarityColor),
		k.opacity(0.8),
		k.scale(0.25),
		k.animate(),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.lifespan(0.35, { fade: 0.25 }),
		"chestUI",
	]);
	flash.animate(
		"scale",
		[k.vec2(0.25), k.vec2(2.2 + profile.shake * 0.16)],
		{
			duration: 0.32,
			loops: 1,
			easing: k.easings.easeOutCubic,
		}
	);
}

function spawnChestGravityBurst(pos: Vec2) {
	const burst = k.add([
		k.pos(pos),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.opacity(1),
		k.lifespan(4),
		k.particles(
			{
				max: 128,
				speed: [150, 340],
				acceleration: [k.vec2(-18, 100), k.vec2(18, 230)],
				lifeTime: [1.8, 3.2],
				angle: [0, 360],
				angularVelocity: [-260, 260],
				colors: [k.WHITE],
				opacities: [1, 1, 0.8, 0],
				scales: [2.6, 2, 1.1, 0.2],
				texture: k.getSprite("particle4")!.data!.frames[0].tex,
				quads: [k.getSprite("particle4")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 360,
				position: k.vec2(0, 0),
			}
		),
		"chestUI",
	]);
	burst.emit(96);
}

function spawnChestExplosionEffect(pos: Vec2) {
	const flash = k.add([
		k.pos(pos),
		k.circle(42),
		k.anchor("center"),
		k.color(k.WHITE),
		k.opacity(0.9),
		k.scale(0.35),
		k.animate(),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.lifespan(0.32, { fade: 0.24 }),
		"chestUI",
	]);
	flash.animate("scale", [k.vec2(0.35), k.vec2(2.4)], {
		duration: 0.3,
		loops: 1,
		easing: k.easings.easeOutCubic,
	});
}
