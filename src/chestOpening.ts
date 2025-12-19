import { GameObj, PosComp } from "kaplay";
import { k, layers, mainSoundVolume } from "./main";
import { ChestReward, generateChestReward } from "./chestRewards";
import { audioService } from "./services/audioService";
import { shake } from "./comp/shake";
import { powerups } from "./powerups";
import {
	explosionEmitter,
	getUiEffects,
	shineEmitter,
	sparkEmitter,
} from "./particles";

interface TimingZone {
	start: number; // 0-1
	end: number; // 0-1
	hit: boolean;
}

export function startChestOpeningSequence(onSequenceComplete?: () => void) {
	const center = k.center();

	// Dark overlay background
	k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(0, 0, 0),
		k.opacity(0.8),
		k.layer(layers.game),
		"chestUI",
	]);

	// Main container with state machine
	const chestController = k.add([
		k.pos(center),
		k.layer(layers.ui),
		{
			onComplete: onSequenceComplete,
			reward: null as ChestReward | null,
			successfulHits: 0,
			timingBarPosition: 0,
			timingBarSpeed: 0.67,
			timingZones: [] as TimingZone[],
			zoneObjects: [] as GameObj[],
			passes: 0,
			maxPasses: 3,
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
		},
		k.state("initial", [
			"initial",
			"timingGame",
			"explosion",
			"reveal",
			"showDetails",
		]),
		"chestUI",
	]);

	// State: Initial - Display chest briefly
	chestController.onStateEnter("initial", async () => {
		// White border box
		const boxWidth = 400;
		const boxHeight = 400;
		chestController.borderBox = chestController.add([
			k.rect(boxWidth, boxHeight),
			k.anchor("center"),
			k.color(0, 0, 0),
			k.outline(4, new k.Color(255, 255, 255)),
			k.scale(0.5),
			k.opacity(0),
			k.animate(),
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

		chestController.enterState("timingGame");
	});

	// State: Timing Game
	chestController.onStateEnter("timingGame", async () => {
		if (!chestController.uiContainer) return;

		// Generate random timing zones
		const numZones = 3;
		const zoneWidth = 0.15;
		chestController.timingZones = [];
		for (let i = 0; i < numZones; i++) {
			const basePos = (i + 1) / (numZones + 1);
			const offset = k.rand(-0.1, 0.1);
			const start = k.clamp(basePos + offset - zoneWidth / 2, 0, 1 - zoneWidth);
			chestController.timingZones.push({
				start: start,
				end: start + zoneWidth,
				hit: false,
			});
		}

		// Add "TIME IT" text
		chestController.uiContainer.add([
			k.text("TIME IT", { size: 20, font: "unscii" }),
			k.pos(0, -120),
			k.anchor("center"),
		]);

		// Create timing bar background (gray)
		const barWidth = 300;
		const barHeight = 10;
		const barY = 80;

		chestController.uiContainer.add([
			k.rect(barWidth, barHeight),
			k.pos(-barWidth / 2, barY),
			k.color(60, 60, 60),
		]);

		// Draw timing zones (orange)
		chestController.zoneObjects = [];
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

		// Create moving bar marker (white)
		chestController.timingBarObj = chestController.uiContainer.add([
			k.rect(4, barHeight + 10),
			k.pos(-barWidth / 2, barY - barHeight / 2),
			k.anchor("center"),
			k.color(255, 255, 255),
		]);

		// Add help text
		chestController.uiContainer.add([
			k.text("PRESS SPACE", { size: 12, font: "unscii" }),
			k.pos(0, barY + 30),
			k.anchor("center"),
		]);

		// Reset timing state
		chestController.timingBarPosition = 0;
		chestController.passes = 0;

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
					} // Spawn particles at hit position using emitter
					const hitX = -barWidth / 2 + ((zone.start + zone.end) / 2) * barWidth;
					const hitWorldPos = chestController.worldPos().add(hitX, barY);
					getUiEffects().explosionEmitter.pos = chestController.pos;
					getUiEffects().explosionEmitter.emit(15);

					break;
				}
			}
			if (!hitZone) {
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
			const newX = -barWidth / 2 + chestController.timingBarPosition * barWidth;
			const barY = 80;
			const barHeight = 10;
			chestController.timingBarObj.pos = k.vec2(newX, barY + barHeight / 2);
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

			// Spawn debris particles using emitter
			getUiEffects().explosionEmitter.pos = chestController.pos;
			getUiEffects().explosionEmitter.emit(20);

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
	chestController.onStateEnter("reveal", () => {
		// Generate reward based on performance
		const generatedReward = generateChestReward(chestController.successfulHits);
		chestController.reward = generatedReward || null;

		if (!chestController.reward) {
			if (chestController.onComplete) {
				chestController.onComplete();
			}
			return;
		}

		const reward = chestController.reward;

		// Clear old UI container content but keep the border box
		if (chestController.uiContainer) {
			chestController.uiContainer.removeAll();
		}

		// Reward sprite with animation
		chestController.rewardSprite = chestController.uiContainer.add([
			k.sprite(reward.sprite, { width: 64, height: 64 }),
			k.pos(0, 0),
			k.anchor("center"),
			k.scale(1),
			k.animate(),
		]);

		// Add shine effect behind reward sprite that follows it
		chestController.rewardSprite.onUpdate(() => {
			const spriteWorldPos = chestController.rewardSprite.pos;
			getUiEffects().shineEmitter.pos = spriteWorldPos;
			getUiEffects().shineEmitter.emit(2);
		});

		// Animate position with ease out, then start bobbing animation
		chestController.rewardSprite.animate(
			"pos",
			[k.vec2(0, 0), k.vec2(0, -100)],
			{
				duration: 1,
				loops: 1,
				easing: k.easings.easeOutCubic,
			}
		);

		chestController.rewardSprite.onAnimateChannelFinished((anim) => {
			if (anim === "pos") {
				chestController.rewardSprite.animate(
					"pos",
					[k.vec2(0, -140), k.vec2(0, -130)],
					{
						duration: 1,
						easing: k.easings.easeInOutCubic,
						direction: "ping-pong",
						timing: [0, 1],
					}
				);
			}
		});

		// Animate scale with pop effect
		chestController.rewardSprite.animate(
			"scale",
			[k.vec2(1, 1), k.vec2(1.4, 1.4), k.vec2(1, 1)],
			{
				loops: 1,
				duration: 0.8,
				timing: [0, 0.1, 1],
			}
		);

		// Wait 1 second then show details
		k.wait(1, () => {
			chestController.enterState("showDetails");
		});
	});

	// State: Show Details
	chestController.onStateEnter("showDetails", () => {
		if (!chestController.reward) return;

		const reward = chestController.reward;
		const boxWidth = chestController.borderBox.width;

		// Rarity text
		chestController.uiContainer
			.add([
				k.text(reward.rarity, { size: 14, font: "unscii" }),
				k.pos(0, -60),
				k.anchor("center"),
				k.opacity(0),
				k.animate(),
			])
			.animate("opacity", [0, 1], { duration: 0.3, loops: 1 });

		// Reward name
		chestController.uiContainer
			.add([
				k.text(reward.name, { size: 18, font: "unscii" }),
				k.pos(0, -30),
				k.anchor("center"),
				k.opacity(0),
				k.animate(),
			])
			.animate("opacity", [0, 1], { duration: 0.3, loops: 1, delay: 0.1 });

		// Description
		chestController.uiContainer.add([
			k.text(reward.description, {
				size: 12,
				font: "unscii",
				width: boxWidth - 40,
				align: "center",
				lineSpacing: 8,
			}),
			k.pos(0, 20),
			k.anchor("center"),
		]);

		// Accept button
		const acceptBtn = chestController.uiContainer.add([
			k.rect(300, 50),
			k.pos(0, 140),
			k.anchor("center"),
			k.area(),
			k.color(255, 255, 255),
			k.outline(2, new k.Color(255, 255, 255)),
		]);

		acceptBtn.add([
			k.text("ACCEPT REWARD", { size: 16, font: "unscii" }),
			k.anchor("center"),
			k.color(0, 0, 0),
		]);

		const acceptReward = () => {
			// Apply the powerup effect
			powerups[reward.powerupKey](k.center());

			// Play purchase sound
			audioService.playSound("purchase1", { volume: mainSoundVolume });

			// Destroy all chest UI
			k.destroyAll("chestUI");

			if (chestController.onComplete) {
				chestController.onComplete();
			}
		};

		acceptBtn.onClick(acceptReward);

		// Also accept with space or enter
		k.onKeyPress("space", acceptReward);
		k.onKeyPress("enter", acceptReward);
		k.onKeyPress("escape", acceptReward);
	});

	// Start state machine
	chestController.enterState("initial");
}
