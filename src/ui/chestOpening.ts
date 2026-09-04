import { AudioPlay, GameObj, Vec2 } from "kaplay";
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
	generateWeaponChestRewardChoices,
	Rarity,
} from "../chestRewards";
import { audioService } from "../services/audioService";
import { shake } from "../comp/shake";
import {
	applyReward,
	getAbilityRewardDefinitionIds,
	isAbilityReward,
	REWARD_RARITY_COLORS,
} from "../services/rewardService";
import { getUiEffects } from "../particles";
import { addCollectedPowerup } from "./gameUi";
import {
	consumeNextChestDifficulty,
	consumeNextChestRewardType,
	createChestChallengeConfig,
	normalizeChestChallengeHits,
	type ChestChallengeConfig,
	type ChestChallengeType,
} from "./chestChallenge";
import {
	addThemedText,
	createInputPromptRow,
	createUiActionButton,
	createUiBadge,
	createUiPanel,
	createUiSectionHeader,
	createUiSelectableCard,
	UI_COLORS,
	UI_FONT_SIZES,
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
import {
	purchaseBurstParticleCount,
	spawnCurrencyBurst,
} from "../spawn/spawnCurrencyBurst";
import { playRequirementErrorSound } from "../services/uiSoundService";

interface TimingZone {
	start: number; // 0-1
	end: number; // 0-1
	hit: boolean;
}

interface RewardRevealProfile {
	suspense: number;
	postRevealHold: number;
	riserSound?: string;
	revealSound?: {
		volume: number;
		detune: number;
		speed: number;
	};
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
		revealSound: {
			volume: 0.38,
			detune: -100,
			speed: 0.96,
		},
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
		revealSound: {
			volume: 0.82,
			detune: 400,
			speed: 1.05,
		},
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
	const challengeTypes: ChestChallengeType[] = [
		"linear",
		"bezier",
		"frequency",
		"capacitor",
	];
	const challengeType = k.choose(challengeTypes);
	const challengeConfig = createChestChallengeConfig(
		consumeNextChestDifficulty(),
		challengeType
	);
	const rewardType = consumeNextChestRewardType();
	const generateRewards = (
		successfulHits: number,
		failedAttempts: number,
		excludedRewardIds: readonly string[] = []
	) => rewardType === "weapon"
		? generateWeaponChestRewardChoices(
			successfulHits,
			failedAttempts,
			excludedRewardIds
		)
		: generateChestRewardChoices(
			successfulHits,
			failedAttempts,
			excludedRewardIds
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
			frequencyPosition: 0.5,
			frequencyTarget: 0.5,
			frequencyRound: 0,
			capacitorCharge: 0,
			capacitorCharging: false,
			capacitorResolved: false,
			capacitorChargeSound: null as AudioPlay | null,
			uiContainer: null as GameObj | null,
			borderBox: null as GameObj | null,
			crateSprite: null as GameObj | null,
			timingBarObj: null as GameObj | null,
			explosionStarted: false,
			explosionElapsed: 0,
			explosionScale: 1,
			challengeFinished: false,
			challengeActive: false,
			perfectOpenSoundPlayed: false,
			spaceKeyHandler: undefined as any,
			barScale: k.vec2(1, 1),
			barTargetScale: k.vec2(1, 1),
			multiplierText: null as GameObj | null,
			rewardSprite: null as GameObj | null,
			detailControllers: [] as { cancel: () => void }[],
			detailObjects: [] as GameObj[],
			rerollExcludedIds: [] as string[],
			claimedDiscoveryIds: [] as string[],
			fixedDiscoveries: [] as ChestReward[],
		},
		k.state("initial", [
			"initial",
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
	const stopCapacitorChargeSound = () => {
		if (!chestController.capacitorChargeSound) return;
		chestController.capacitorChargeSound.stop();
		chestController.capacitorChargeSound = null;
	};
	const claimDiscoveryReward = (reward: ChestReward) => {
		if (
			!isAbilityReward(reward) ||
			chestController.claimedDiscoveryIds.includes(reward.id)
		) return;
		if (!applyReward(reward, k.center())) return;
		chestController.claimedDiscoveryIds.push(reward.id);
		addCollectedPowerup(reward);
	};
	const claimDiscoveryRewards = (rewards: readonly ChestReward[]) => {
		for (const reward of rewards) claimDiscoveryReward(reward);
	};
	let sequenceFinished = false;
	const finishSequence = () => {
		if (sequenceFinished) return;
		sequenceFinished = true;
		clearDetailInteractions();
		stopCapacitorChargeSound();
		chestController.removeAll();
		k.destroyAll("chestUI");
		chestController.onComplete?.();
	};
	const finishChallenge = () => {
		if (chestController.challengeFinished) return;
		chestController.challengeFinished = true;
		stopCapacitorChargeSound();
		const normalizedHits = normalizeChestChallengeHits(
			challengeConfig.type,
			chestController.successfulHits
		);
		const missedZones = Math.max(0, 3 - Math.floor(normalizedHits));
		if (
			chestController.failedAttempts + missedZones === 0 &&
			!chestController.perfectOpenSoundPlayed
		) {
			chestController.perfectOpenSoundPlayed = true;
			audioService.playSound("perfect_chest_open", {
				volume: mainSoundVolume * 0.85,
			});
		}
		chestController.enterState("explosion");
		if (chestController.spaceKeyHandler) {
			chestController.spaceKeyHandler.cancel();
			chestController.spaceKeyHandler = undefined;
		}
	};
	const registerChallengeHit = (amount: number = 1, zoneIndex?: number) => {
		chestController.successfulHits = Math.min(
			3,
			chestController.successfulHits + amount
		);
		audioService.playSound("explosion1", {
			volume: mainSoundVolume,
			detune: chestController.successfulHits * 200,
		});
		k.shake(amount >= 3 ? 8 : 5);
		chestController.barTargetScale = k.vec2(
			amount >= 3 ? 8 : 6,
			amount >= 3 ? 8 : 6
		);
		if (chestController.crateSprite?.shake) {
			chestController.crateSprite.shake(amount >= 3 ? 14 : 10);
		}
		if (chestController.multiplierText) {
			const hitCount = chestController.successfulHits;
			chestController.multiplierText.text = `x${hitCount}`;
			chestController.multiplierText.opacity = 1;
			const targetScale = 1 + (hitCount - 1) * 0.3;
			chestController.multiplierText.animate(
				"scale",
				[
					k.vec2(targetScale),
					k.vec2(targetScale * 1.5),
					k.vec2(targetScale),
				],
				{
					loops: 1,
					duration: 0.3,
					timing: [0, 0.3, 1],
				}
			);
		}
		if (zoneIndex !== undefined && chestController.zoneObjects[zoneIndex]) {
			chestController.zoneObjects[zoneIndex].opacity = 0.3;
		}
		getUiEffects().explosionEmitter.pos = chestController.pos;
		getUiEffects().explosionEmitter.emit(15 + amount * 5);
	};
	const registerChallengeMiss = () => {
		chestController.failedAttempts++;
		audioService.playSound("collect1", { volume: mainSoundVolume });
		chestController.barTargetScale = k.vec2(0.3);
	};
	const startChallengeCountdown = async () => {
		if (!chestController.uiContainer) return;
		if (chestController.crateSprite) {
			chestController.crateSprite.hidden = true;
		}
		const modeLabel = chestController.uiContainer.add([
			k.text(
				`${getChallengeTitle(challengeConfig.type)}  •  DIFFICULTY ${challengeConfig.difficulty}`,
				{ size: UI_FONT_SIZES.subheading, font: "unscii" }
			),
			k.pos(0, -165),
			k.anchor("center"),
			k.color(150, 205, 255),
			k.z(20),
		]);
		const countdown = chestController.uiContainer.add([
			k.text("3", { size: UI_FONT_SIZES.countdown, font: "unscii" }),
			k.pos(0, 0),
			k.anchor("center"),
			k.color(k.WHITE),
			k.scale(1),
			k.z(20),
			k.animate(),
		]);

		for (const value of [3, 2, 1]) {
			if (!chestController.exists() || chestController.state !== "timingGame") {
				return;
			}
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

		if (!countdown.exists() || chestController.state !== "timingGame") return;
		countdown.text = "GO";
		countdown.color = k.rgb(255, 165, 0);
		await k.wait(0.3);
		if (!chestController.exists() || chestController.state !== "timingGame") {
			return;
		}
		k.destroy(countdown);
		k.destroy(modeLabel);
		chestController.challengeActive = true;
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
			k.z(-10),
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
		if (rewardType === "weapon") {
			chestController.crateSprite.add([
				k.sprite("weapon_standard_blaster", { width: 26, height: 26 }),
				k.anchor("center"),
				k.z(2),
			]);
		}

		// Multiplier text below crate
		chestController.multiplierText = chestController.uiContainer.add([
			k.text("x0", { size: UI_FONT_SIZES.display, font: "unscii" }),
			k.pos(0, 50),
			k.anchor("center"),
			k.scale(1),
			k.opacity(0),
			k.animate(),
		]);

		chestController.enterState("timingGame");
	});

	// State: Timing Game
	chestController.onStateEnter("timingGame", () => {
		if (!chestController.uiContainer) return;

		const barWidth = 300;
		const barHeight = 10;
		const barY = 80;
		const isBezier = challengeConfig.type === "bezier";
		chestController.timingZones = [];
		chestController.zoneObjects = [];
		chestController.timingBarPosition = 0;
		chestController.passes = 0;
		chestController.successfulHits = 0;
		chestController.failedAttempts = 0;
		chestController.challengeFinished = false;
		chestController.challengeActive = false;
		chestController.perfectOpenSoundPlayed = false;

		if (challengeConfig.type === "frequency") {
			chestController.frequencyPosition = k.rand(0.2, 0.8);
			chestController.frequencyTarget = k.rand(0.15, 0.85);
			chestController.frequencyRound = 0;
			chestController.uiContainer.add([
				k.pos(0, 28),
				{
					draw() {
						drawFrequencyTuner(
							chestController.frequencyPosition,
							chestController.frequencyTarget,
							challengeConfig.frequencyHitWindow,
							chestController.frequencyRound
						);
					},
				},
			]);
			addChallengeInstructions(
				chestController.uiContainer,
				"FREQUENCY TUNING",
				[
					{ action: "tune", label: "TO TUNE" },
					{ action: "lock", label: "TO LOCK" },
				]
			);
			const lockFrequency = () => {
				if (!chestController.challengeActive) return;
				const distance = Math.abs(
					chestController.frequencyPosition -
					chestController.frequencyTarget
				);
				if (distance <= challengeConfig.frequencyHitWindow / 2) {
					registerChallengeHit();
				} else {
					registerChallengeMiss();
				}
				chestController.frequencyRound++;
				if (chestController.frequencyRound >= 3) {
					finishChallenge();
					return;
				}
				chestController.frequencyTarget = k.rand(0.12, 0.88);
			};
			chestController.spaceKeyHandler = k.onKeyPress(
				"space",
				lockFrequency
			);
			void startChallengeCountdown();
			return;
		}

		if (challengeConfig.type === "capacitor") {
			chestController.capacitorCharge = 0;
			chestController.capacitorCharging = false;
			chestController.capacitorResolved = false;
			chestController.uiContainer.add([
				k.pos(0, 65),
				{
					draw() {
						drawRiskCapacitor(
							chestController.capacitorCharge,
							challengeConfig
						);
					},
				},
			]);
			addChallengeInstructions(
				chestController.uiContainer,
				"RISK CAPACITOR",
				[{ action: "charge", label: "HOLD / RELEASE TO CHARGE" }]
			);
			const resolveCapacitor = () => {
				if (!chestController.challengeActive) return;
				if (
					chestController.capacitorResolved ||
					!chestController.capacitorCharging
				) return;
				stopCapacitorChargeSound();
				chestController.capacitorResolved = true;
				chestController.capacitorCharging = false;
				const charge = chestController.capacitorCharge;
				const hits = charge >= challengeConfig.capacitorPerfectCharge
					? 3
					: charge >= challengeConfig.capacitorGoodCharge
						? 2
						: charge >= challengeConfig.capacitorMinimumCharge
							? 1
							: 0;
				if (hits > 0) registerChallengeHit(hits);
				else registerChallengeMiss();
				finishChallenge();
			};
			const pressController = k.onKeyPress("space", () => {
				if (!chestController.challengeActive) return;
				if (chestController.capacitorResolved) return;
				chestController.capacitorCharging = true;
				stopCapacitorChargeSound();
				chestController.capacitorChargeSound = audioService.playSound(
					"wormhole_ambience",
					{
						volume: mainSoundVolume * 0.18,
						loop: true,
						speed: 0.75,
						detune: -500,
					}
				);
			});
			const releaseController = k.onKeyRelease("space", resolveCapacitor);
			chestController.spaceKeyHandler = {
				cancel: () => {
					pressController.cancel();
					releaseController.cancel();
				},
			};
			void startChallengeCountdown();
			return;
		}

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
				size: UI_FONT_SIZES.title,
				font: "unscii",
			}),
			k.pos(0, -120),
			k.anchor("center"),
		]);

		// Add help text
		createInputPromptRow(chestController.uiContainer, {
			pos: k.vec2(0, isBezier ? 175 : barY + 30),
			prompts: [{ action: "timingHit", label: "HIT" }],
			color: [255, 255, 255],
			fontSize: UI_FONT_SIZES.body,
			iconHeight: 28,
		});

		// Handle space key press
		const checkTimingHit = () => {
			if (!chestController.challengeActive) return;
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
				finishChallenge();
			}
		};

		chestController.spaceKeyHandler = k.onKeyPress("space", checkTimingHit);
		void startChallengeCountdown();
	});

	chestController.onStateUpdate("timingGame", () => {
		if (!chestController.challengeActive) return;
		if (challengeConfig.type === "frequency") {
			chestController.timingBarPosition += k.dt();
			if (chestController.timingBarPosition >= 6) {
				chestController.failedAttempts +=
					3 - chestController.frequencyRound;
				finishChallenge();
				return;
			}
			const direction =
				(k.isKeyDown("d") || k.isKeyDown("right") ? 1 : 0) -
				(k.isKeyDown("a") || k.isKeyDown("left") ? 1 : 0);
			chestController.frequencyPosition = k.clamp(
				chestController.frequencyPosition +
					direction * challengeConfig.frequencyTuneSpeed * k.dt(),
				0,
				1
			);
			return;
		}

		if (challengeConfig.type === "capacitor") {
			chestController.timingBarPosition += k.dt();
			if (
				chestController.timingBarPosition >= 5 &&
				!chestController.capacitorResolved
			) {
				chestController.capacitorResolved = true;
				registerChallengeMiss();
				finishChallenge();
				return;
			}
			if (
				chestController.capacitorCharging &&
				!chestController.capacitorResolved
			) {
				chestController.capacitorCharge +=
					challengeConfig.capacitorChargeSpeed * k.dt();
				if (chestController.capacitorChargeSound) {
					const chargeProgress = k.clamp(
						chestController.capacitorCharge,
						0,
						1
					);
					chestController.capacitorChargeSound.detune = k.lerp(
						-500,
						1000,
						chargeProgress
					);
					chestController.capacitorChargeSound.speed = k.lerp(
						0.75,
						1.25,
						chargeProgress
					);
				}
				if (chestController.capacitorCharge >= 1) {
					chestController.capacitorCharge = 1;
					chestController.capacitorResolved = true;
					chestController.capacitorCharging = false;
					registerChallengeMiss();
					k.shake(9);
					finishChallenge();
				}
			}
			return;
		}

		const barWidth = 300;
		chestController.timingBarPosition +=
			chestController.timingBarSpeed * k.dt();

		if (chestController.timingBarPosition >= 1) {
			chestController.timingBarPosition = 0;
			chestController.passes++;

			if (chestController.passes >= chestController.maxPasses) {
				finishChallenge();
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
		if (chestController.crateSprite) {
			chestController.crateSprite.hidden = false;
		}
		k.wait(0.35, () => {
			if (
				chestController.exists() &&
				chestController.state === "explosion"
			) {
				completeChestExplosion();
			}
		});
	});

	const completeChestExplosion = () => {
		if (!chestController.explosionStarted) return;
		chestController.explosionStarted = false;

		spawnCurrencyBurst(chestController.pos, {
			particleCount: 96,
			fixed: true,
			tags: ["chestUI"],
		});
		spawnChestExplosionEffect(chestController.pos);
		k.shake(7);
		if (chestController.borderBox?.shake) {
			chestController.borderBox.shake(5);
		}

		audioService.playSound("explosion4", { volume: mainSoundVolume });

		if (chestController.crateSprite) {
			k.destroy(chestController.crateSprite);
			chestController.crateSprite = null;
		}

		chestController.enterState("reveal");
	};

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
			completeChestExplosion();
		}
	});

	// State: Reveal
	chestController.onStateEnter("reveal", async () => {
		const normalizedHits = normalizeChestChallengeHits(
			challengeConfig.type,
			chestController.successfulHits
		);
		chestController.normalizedHits = normalizedHits;
		const result = generateRewards(
			normalizedHits,
			chestController.failedAttempts,
			chestController.fixedDiscoveries.length > 0
				? getAbilityRewardDefinitionIds()
				: []
		);
		if (chestController.fixedDiscoveries.length === 0) {
			chestController.fixedDiscoveries = result.discoveries.slice(0, 1);
		}
		const selectableSlotCount = Math.max(
			0,
			result.rewards.length - chestController.fixedDiscoveries.length
		);
		chestController.rewards = [
			...chestController.fixedDiscoveries,
			...result.choices.slice(0, selectableSlotCount),
		];
		chestController.totalFailures = result.failures;
		chestController.quality = result.quality;

		if (chestController.rewards.length === 0) {
			finishSequence();
			return;
		}

		// Clear old UI container content but keep the border box
		if (chestController.uiContainer) {
			chestController.uiContainer.removeAll();
		}

		chestController.uiContainer.add([
			k.text(
				rewardType === "weapon" ? "WEAPON CACHE OPENED" : "CRATE OPENED",
				{ size: UI_FONT_SIZES.display, font: "unscii" }
			),
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
				k.text("?", { size: UI_FONT_SIZES.hero, font: "unscii" }),
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
				k.text(reward.rarity, { size: UI_FONT_SIZES.small, font: "unscii" }),
				k.pos(target.x, target.y + 52),
				k.anchor("center"),
				k.color(...rarityColor),
				k.opacity(0),
				k.animate(),
			]).animate("opacity", [0, 1], {
				duration: 0.18,
				loops: 1,
			});

			if (profile.revealSound) {
				audioService.playSound("high_rarity_reveal", {
					volume: mainSoundVolume * profile.revealSound.volume,
					detune: profile.revealSound.detune,
					speed: profile.revealSound.speed,
				});
			} else {
				audioService.playSound("powerup1", {
					volume: mainSoundVolume,
					detune: profile.detune,
				});
			}
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
			claimDiscoveryReward(reward);
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
		const retainedDiscoveries = chestController.rewards.filter(isAbilityReward);
		const result = generateRewards(
			chestController.normalizedHits,
			chestController.failedAttempts,
			[
				...chestController.rerollExcludedIds,
				...(retainedDiscoveries.length > 0
					? getAbilityRewardDefinitionIds()
					: []),
			]
		);
		const selectableCount = Math.max(
			0,
			chestController.rewards.length - retainedDiscoveries.length
		);
		const rerolledChoices = result.rewards
			.filter((reward) => !isAbilityReward(reward))
			.slice(0, selectableCount);
		const newDiscoveries = retainedDiscoveries.length === 0
			? result.rewards.filter(isAbilityReward).slice(0, 1)
			: [];
		if (newDiscoveries.length > 0) {
			chestController.fixedDiscoveries = newDiscoveries;
		}
		chestController.rewards = [
			...retainedDiscoveries,
			...newDiscoveries,
			...rerolledChoices,
		];
		claimDiscoveryRewards(newDiscoveries);
		chestController.totalFailures = result.failures;
		chestController.quality = result.quality;
		chestController.enterState("showDetails");
	});

	// State: Show Details
	chestController.onStateEnter("showDetails", () => {
		if (!chestController.uiContainer || chestController.rewards.length === 0) {
			finishSequence();
			return;
		}
		clearDetailInteractions();
		chestController.uiContainer.removeAll();
		if (chestController.borderBox) chestController.borderBox.opacity = 0;
		const selectableRewards = chestController.rewards.filter(
			(reward) => !isAbilityReward(reward)
		);
		const choiceCount = selectableRewards.length;
		const slotCount = chestController.rewards.length;
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
			title: choiceCount > 0
				? `SELECT REWARD  /  1 OF ${choiceCount}`
				: "DISCOVERY SECURED",
			action: `${rerollTokenCount} REROLL TOKEN${rerollTokenCount === 1 ? "" : "S"}`,
		});

		const layout = getRewardCardLayout(
			panelWidth - 32,
			slotCount
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
			if (accepted || isAbilityReward(reward)) return;
			accepted = true;

			if (!applyReward(reward, k.center())) {
				accepted = false;
				return;
			}
			addCollectedPowerup(reward);

			// Play purchase sound
			audioService.playSound("purchase1", { volume: mainSoundVolume });

			finishSequence();
		};
		const rerollRewards = () => {
			if (accepted) return;
			if (!spendRerollToken()) {
				playRequirementErrorSound();
				return;
			}
			accepted = true;
			chestController.rerollExcludedIds = selectableRewards.map(
				(reward) => reward.id
			);
			clearDetailInteractions();
			audioService.playSound("purchase1", { volume: mainSoundVolume });
			chestController.enterState("reroll");
		};
		const retryChallenge = () => {
			if (accepted) return;
			if (!spendScore(CHEST_RETRY_COST)) {
				playRequirementErrorSound();
				return;
			}
			accepted = true;
			spawnCurrencyBurst(k.mousePos(), {
				particleCount: purchaseBurstParticleCount(CHEST_RETRY_COST),
				fixed: true,
			});
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
		const actionCount = 2;
		const actionWidth = Math.min(
			240,
			(panelWidth - 64 - actionGap * (actionCount - 1)) / actionCount
		);
		const actionRowWidth =
			actionWidth * actionCount + actionGap * (actionCount - 1);
		const actionStartX = (panelWidth - actionRowWidth) / 2;
		if (choiceCount > 0) {
			createUiActionButton(panel, {
				pos: k.vec2(actionStartX, panelHeight - 50),
				size: k.vec2(actionWidth, 32),
				text: `REROLL  //  ${rerollTokenCount} ${tokenLabel}`,
				disabled: rerollTokenCount === 0,
				onDisabledClick: playRequirementErrorSound,
				promptAction: "reroll",
				onClick: rerollRewards,
			});
			createUiActionButton(panel, {
				pos: k.vec2(actionStartX + actionWidth + actionGap, panelHeight - 50),
				size: k.vec2(actionWidth, 32),
				text: `RETRY  //  ${CHEST_RETRY_COST} SALVAGE`,
				disabled: availableSalvage < CHEST_RETRY_COST,
				onDisabledClick: playRequirementErrorSound,
				promptAction: "retry",
				onClick: retryChallenge,
			});
		}
		if (choiceCount > 0 && rerollTokenCount > 0) {
			acceptControllers.push(k.onKeyPress("r", rerollRewards));
		}
		if (choiceCount > 0 && availableSalvage >= CHEST_RETRY_COST) {
			acceptControllers.push(k.onKeyPress("t", retryChallenge));
		}

		chestController.rewards.forEach((reward, index) => {
			const rarityColor = REWARD_RARITY_COLORS[reward.rarity];
			const isPermanent = reward.progression.persistence === "permanent";
			const isDiscovery = isAbilityReward(reward);
			const selectableIndex = selectableRewards.indexOf(reward);
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
				disabled: isDiscovery,
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
			if (isPermanent) {
				card.add([
					k.pos(4, 4),
					k.rect(cardWidth - 8, cardHeight - 8, { fill: false }),
					k.outline(1, k.WHITE),
					k.z(2),
				]);
			}

			card.add([
				k.sprite(reward.sprite, { width: 56, height: 56 }),
				k.pos(cardWidth / 2, 42),
				k.anchor("center"),
				k.z(3),
			]);
			createUiBadge(card, {
				pos: k.vec2(12, 76),
				width: cardWidth - 24,
				text: `${reward.rarity} ${reward.abilitySlot
					? `${reward.abilitySlot.toUpperCase()} ABILITY`
					: reward.kind.toUpperCase()}`,
				color: rarityColor,
			});
			if (isPermanent) {
				createUiBadge(card, {
					pos: k.vec2(12, cardHeight - 66),
					width: cardWidth - 24,
					text: isDiscovery
						? "DISCOVERED  //  ADDED TO PHASE STATION"
						: "PERMANENT",
					color: isDiscovery ? UI_COLORS.success : [255, 255, 255],
				});
			}
			addThemedText(card, {
				text: reward.name,
				pos: k.vec2(12, 108),
				variant: "heading",
				size: UI_FONT_SIZES.body,
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
				size: UI_FONT_SIZES.small,
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
				size: UI_FONT_SIZES.small,
				width: cardWidth - 28,
				align: "center",
				color: k.rgb(100, 200, 255),
				z: 3,
			});
			if (!isDiscovery) {
				createInputPromptRow(card, {
					pos: k.vec2(cardWidth / 2, cardHeight - 28),
					prompts: [{
						action: `select${selectableIndex + 1}` as "select1" | "select2" | "select3",
						label: "TO SELECT",
					}],
					color: UI_COLORS.accent,
				});
			}
			if (reward.rarity === Rarity.Legendary) {
				addLegendaryCardSweep(
					card,
					cardWidth,
					cardHeight,
					animationDelay + 0.18
				);
			}
			if (!isDiscovery) {
				acceptControllers.push(
					k.onKeyPress(`${selectableIndex + 1}`, () => acceptReward(reward))
				);
			}
		});

		if (selectableRewards.length > 0) {
			acceptControllers.push(k.onKeyPress("enter", () => {
				acceptReward(selectableRewards[0]);
			}));
		} else {
			k.wait(1.2, () => {
				if (chestController.exists()) finishSequence();
			});
		}
	});

	// Start state machine
	chestController.enterState("initial");
	chestController.onDestroy(stopCapacitorChargeSound);
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

function getChallengeTitle(type: ChestChallengeType) {
	switch (type) {
		case "bezier":
			return "CURVE LOCK";
		case "frequency":
			return "FREQUENCY TUNING";
		case "capacitor":
			return "RISK CAPACITOR";
		default:
			return "TIMING LOCK";
	}
}

function addChallengeInstructions(
	parent: GameObj,
	title: string,
	prompts: readonly {
		action: "tune" | "lock" | "charge"
		label: string
	}[]
) {
	parent.add([
		k.text(title, { size: UI_FONT_SIZES.title, font: "unscii" }),
		k.pos(0, -120),
		k.anchor("center"),
	]);
	createInputPromptRow(parent, {
		pos: k.vec2(0, 150),
		prompts,
		color: [150, 205, 255],
		fontSize: UI_FONT_SIZES.body,
		iconHeight: 28,
	})
}

function drawFrequencyTuner(
	position: number,
	target: number,
	hitWindow: number,
	round: number,
	opacity: number = 1
) {
	const width = 300;
	const left = -width / 2;
	const targetStart = left + (target - hitWindow / 2) * width;
	k.drawRect({
		pos: k.vec2(left, 54),
		width,
		height: 8,
		color: k.rgb(45, 60, 70),
		opacity: 0.8 * opacity,
	});
	k.drawRect({
		pos: k.vec2(targetStart, 54),
		width: hitWindow * width,
		height: 8,
		color: k.rgb(255, 165, 0),
		opacity: 0.9 * opacity,
	});
	k.drawRect({
		pos: k.vec2(left + position * width - 2, 47),
		width: 4,
		height: 22,
		color: k.WHITE,
		opacity,
	});

	const targetWave: Vec2[] = [];
	const currentWave: Vec2[] = [];
	for (let index = 0; index <= 40; index++) {
		const progress = index / 40;
		const x = left + progress * width;
		targetWave.push(k.vec2(
			x,
			Math.sin(progress * Math.PI * (4 + target * 8)) * 16 - 12
		));
		currentWave.push(k.vec2(
			x,
			Math.sin(progress * Math.PI * (4 + position * 8)) * 16 - 12
		));
	}
	k.drawLines({
		pts: targetWave,
		width: 2,
		color: k.rgb(255, 165, 0),
		opacity: 0.5 * opacity,
	});
	k.drawLines({
		pts: currentWave,
		width: 2,
		color: k.rgb(150, 215, 255),
		opacity,
	});
	for (let index = 0; index < 3; index++) {
		k.drawCircle({
			pos: k.vec2(-14 + index * 14, 82),
			radius: 3,
			color: index < round ? k.rgb(150, 215, 255) : k.rgb(55, 70, 78),
			opacity,
			anchor: "center",
		});
	}
}

function drawRiskCapacitor(
	charge: number,
	config: ChestChallengeConfig,
	opacity: number = 1
) {
	const width = 300;
	const left = -width / 2;
	const clampedCharge = k.clamp(charge, 0, 1);
	k.drawRect({
		pos: k.vec2(left, 0),
		width,
		height: 18,
		color: k.rgb(35, 45, 52),
		opacity,
	});
	k.drawRect({
		pos: k.vec2(left + config.capacitorMinimumCharge * width, 0),
		width: (config.capacitorGoodCharge - config.capacitorMinimumCharge) * width,
		height: 18,
		color: k.rgb(70, 150, 255),
		opacity: 0.35 * opacity,
	});
	k.drawRect({
		pos: k.vec2(left + config.capacitorGoodCharge * width, 0),
		width: (config.capacitorPerfectCharge - config.capacitorGoodCharge) * width,
		height: 18,
		color: k.rgb(190, 90, 255),
		opacity: 0.45 * opacity,
	});
	k.drawRect({
		pos: k.vec2(left + config.capacitorPerfectCharge * width, 0),
		width: (1 - config.capacitorPerfectCharge) * width,
		height: 18,
		color: k.rgb(255, 185, 45),
		opacity: 0.55 * opacity,
	});
	k.drawRect({
		pos: k.vec2(left, 3),
		width: clampedCharge * width,
		height: 12,
		color: clampedCharge >= config.capacitorPerfectCharge
			? k.rgb(255, 230, 140)
			: k.rgb(120, 210, 255),
		opacity: 0.9 * opacity,
	});
	k.drawRect({
		pos: k.vec2(left + width - 3, -5),
		width: 3,
		height: 28,
		color: k.rgb(255, 70, 55),
		opacity,
	});
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
