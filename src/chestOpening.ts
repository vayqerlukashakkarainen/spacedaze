import { GameObj, PosComp } from "kaplay";
import { k, layers, mainSoundVolume } from "./main";
import { ChestReward, generateChestReward } from "./chestRewards";
import { audioService } from "./services/audioService";
import { powerups } from "./powerups";

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
		k.layer(layers.ui),
		k.z(100),
		"chestUI",
	]);

	// Main container with state machine
	const chestController = k.add([
		k.pos(center),
		k.layer(layers.ui),
		k.z(101),
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
			crateSprite: null as GameObj | null,
			timingBarObj: null as GameObj | null,
			explosionStarted: false,
			explosionElapsed: 0,
			explosionScale: 1,
			spaceKeyHandler: undefined as any,
			barScale: k.vec2(1, 1),
			barTargetScale: k.vec2(1, 1),
		},
		k.state("initial", ["initial", "timingGame", "explosion", "reveal"]),
		"chestUI",
	]);

	// State: Initial - Display chest briefly
	chestController.onStateEnter("initial", async () => {
		// White border box
		const boxWidth = 400;
		const boxHeight = 400;
		chestController.uiContainer = chestController.add([
			k.rect(boxWidth, boxHeight),
			k.anchor("center"),
			k.color(0, 0, 0),
			k.outline(4, new k.Color(255, 255, 255)),
		]);

		// Upscaled crate sprite
		chestController.crateSprite = chestController.uiContainer.add([
			k.sprite("crate1", { width: 64, height: 64 }),
			k.pos(0, 0),
			k.anchor("center"),
			k.scale(1),
		]);

		// Wait briefly then transition to timing game
		await k.wait(0.5);
		chestController.enterState("timingGame");
	});

	// State: Timing Game
	chestController.onStateEnter("timingGame", () => {
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
					audioService.playSound("explosion1", { volume: mainSoundVolume });
					k.shake(5);
					// Scale up on hit
					chestController.barTargetScale = k.vec2(6, 6);

					// Update zone opacity
					if (chestController.zoneObjects[i]) {
						chestController.zoneObjects[i].opacity = 0.3;
					}

					// Spawn particles at hit position
					const hitX = -barWidth / 2 + ((zone.start + zone.end) / 2) * barWidth;
					const numParticles = 8;
					for (let p = 0; p < numParticles; p++) {
						const particle = chestController.uiContainer.add([
							k.sprite("particle2"),
							k.pos(hitX, barY),
							k.anchor("center"),
							k.rotate(k.rand(360)),
							k.opacity(1),
							{
								vel: k.Vec2.fromAngle(k.rand(0, 360)).scale(k.rand(50, 150)),
							},
						]);

						particle.onUpdate(() => {
							particle.pos = particle.pos.add(particle.vel.scale(k.dt()));
							particle.vel = particle.vel.scale(0.95);
						});

						particle.fadeOut(0.5);
						k.wait(0.5, () => k.destroy(particle));
					}

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

			// Spawn debris particles
			const numParticles = 20;
			for (let i = 0; i < numParticles; i++) {
				const particle = chestController.add([
					k.sprite("particle2"),
					k.pos(0, 0),
					k.anchor("center"),
					k.rotate(k.rand(360)),
					k.opacity(1),
					{
						vel: k.Vec2.fromAngle(k.rand(0, 360)).scale(k.rand(100, 200)),
					},
				]);

				particle.onUpdate(() => {
					particle.pos = particle.pos.add(particle.vel.scale(k.dt()));
					particle.vel = particle.vel.scale(0.95);
				});

				particle.fadeOut(0.8);
				k.wait(0.8, () => k.destroy(particle));
			}

			// Play explosion sound
			audioService.playSound("explosion4", { volume: mainSoundVolume });

			// Remove crate sprite
			if (chestController.crateSprite) {
				k.destroy(chestController.crateSprite);
				chestController.crateSprite = null;
			}

			// Wait briefly then show reward
			k.wait(0.5, () => {
				chestController.enterState("reveal");
			});
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

		// Remove old UI container
		if (chestController.uiContainer) {
			k.destroy(chestController.uiContainer);
		}

		// Create new container for reward screen
		const boxWidth = 400;
		const boxHeight = 500;
		const container = chestController.add([k.pos(0, 0)]);

		// White border box
		container.add([
			k.rect(boxWidth, boxHeight),
			k.anchor("center"),
			k.color(0, 0, 0),
			k.outline(4, new k.Color(255, 255, 255)),
		]);

		// Reward sprite
		container.add([
			k.sprite(reward.sprite, { width: 64, height: 64 }),
			k.pos(0, -140),
			k.anchor("center"),
		]);

		// Rarity text
		container.add([
			k.text(reward.rarity, { size: 14, font: "unscii" }),
			k.pos(0, -60),
			k.anchor("center"),
		]);

		// Reward name
		container.add([
			k.text(reward.name, { size: 18, font: "unscii" }),
			k.pos(0, -30),
			k.anchor("center"),
		]);

		// Description
		container.add([
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
		const acceptBtn = container.add([
			k.rect(300, 50),
			k.pos(0, 180),
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
