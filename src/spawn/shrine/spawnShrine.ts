import { Vec2 } from "kaplay";
import { playerObj } from "../../game";
import { dt, k, layers, mainSoundVolume } from "../../main";
import { audioService } from "../../services/audioService";
import { explosionEmitter } from "../../particles";
import { tags } from "../../tags";
import { spawnThreatEncounter } from "../../services/enemyEncounterService";
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService";
import { createChargeZoneFeedback } from "../../services/chargeZoneFeedbackService";
import {
	addLocalLight,
	updateLocalLight,
} from "../../services/localLightService";
import { spawnRing } from "../spawnRing";

const SHRINE_VISUAL_SCALE = 1.5;

interface ShrineProps {
	pos: Vec2;
	radius: number;
	captureTime: number;
	level?: number;
	enemySpawnDelay?: number;
	enemySpawnInterval?: number;
	enemySpawnDistance?: number;
	enemySpawnSpacing?: number;
	enemyWaveMultiplier?: number;
	onComplete?: (pos: Vec2) => void;
	tags?: string[];
}

export function spawnShrine(props: ShrineProps) {
	const shrine = k.add([
		k.pos(props.pos),
		k.sprite("shrine_capture"),
		k.anchor("center"),
		k.layer(layers.buildings),
		k.scale(SHRINE_VISUAL_SCALE),
		k.color(k.WHITE),
		k.opacity(1),
		{
			timer: 0,
			maxTimer: props.captureTime,
			isPlayerInside: false,
			completed: false,
			enemySpawnTimer: props.enemySpawnDelay ?? 1.5,
			wavesSpawned: 0,
		},
		tags.props,
		tags.gameLoop,
		tags.runtimeCullable,
		{ runtimeCullRadius: props.radius },
		...(props.tags ?? []),
	]);

	// Create circle to show radius
	const circle = shrine.add([
		k.circle(props.radius / SHRINE_VISUAL_SCALE),
		k.anchor("center"),
		k.outline(2, k.rgb(120, 155, 175)),
		k.opacity(0.18),
		k.color(45, 60, 72),
		k.layer(layers.gameEffects),
	]);
	// Add timer bar above shrine
	const barWidth = 60;
	const barHeight = 8;
	const barBg = shrine.add([
		k.rect(barWidth, barHeight),
		k.pos(0, -50),
		k.anchor("center"),
		k.color(60, 60, 60),
		k.opacity(0.8),
		k.layer(layers.gameEffects),
	]);

	const barFill = shrine.add([
		k.rect(0, barHeight),
		k.pos(-barWidth / 2, -50),
		k.anchor("left"),
		k.color(100, 200, 255),
		k.opacity(0.9),
		k.layer(layers.gameEffects),
	]);
	const chargeFeedback = createChargeZoneFeedback();
	let completedLight: ReturnType<typeof addLocalLight> | undefined;
	let completedCore: ReturnType<typeof shrine.add> | undefined;

	registerBatchedEntityUpdate("world", shrine, () => {
		if (shrine.completed) {
			if (completedLight) updateLocalLight(completedLight);
			if (completedCore) {
				completedCore.scale = k.vec2(k.wave(0.85, 1.2, k.time() * 4));
				completedCore.opacity = k.wave(0.72, 1, k.time() * 5);
			}
			return;
		}

		// Check if player is inside radius
		const distToPlayer = playerObj.pos.dist(shrine.pos);
		shrine.isPlayerInside = distToPlayer < props.radius;

		if (shrine.isPlayerInside) {
			// Player inside: increase timer
			shrine.timer += dt();
			shrine.enemySpawnTimer -= dt();
			if (
				props.enemySpawnInterval !== undefined &&
				shrine.enemySpawnTimer <= 0
			) {
				spawnShrineEnemyWave();
				shrine.enemySpawnTimer += props.enemySpawnInterval;
			}
			// Increase circle opacity
			circle.opacity = k.lerp(circle.opacity, 0.42, 5 * dt());
		} else {
			// Player outside: decrease timer quickly
			shrine.timer -= dt() * 3;
			if (shrine.timer < 0) shrine.timer = 0;
			// Decrease circle opacity
			circle.opacity = k.lerp(circle.opacity, 0.18, 5 * dt());
		}

		// Update timer bar
		const progress = k.clamp(shrine.timer / shrine.maxTimer, 0, 1);
		barFill.width = barWidth * progress;
		chargeFeedback.update(shrine.isPlayerInside, progress);

		// Check if capture complete
		if (shrine.timer >= shrine.maxTimer) {
			shrine.completed = true;
			shrine.isPlayerInside = false;
			chargeFeedback.stop("charge-zone-complete");
			k.destroy(circle);
			k.destroy(barBg);
			k.destroy(barFill);
			shrine.color = k.rgb(175, 225, 255);

			// Spawn particles
			explosionEmitter.pos = shrine.pos;
			explosionEmitter.emit(30);
			spawnRing({
				pos: shrine.pos,
				speed: 270,
				intensity: 0.48,
				maxRadius: Math.max(190, props.radius * 1.12),
				color: k.rgb(90, 205, 255),
				visualOpacity: 0.9,
				outlineWidth: 4,
			});
			k.shake(6);
			completedLight = addLocalLight(shrine, {
				size: 46,
				color: [70, 185, 255],
				opacity: 0.72,
				pulse: {
					scaleMin: 0.82,
					scaleMax: 1.2,
					scaleSpeed: 3.2,
					opacityMin: 0.48,
					opacityMax: 0.82,
					opacitySpeed: 4.1,
				},
			});
			completedCore = shrine.add([
				k.circle(4),
				k.anchor("center"),
				k.color(125, 225, 255),
				k.opacity(1),
				k.scale(1),
				k.layer(layers.gameEffects),
				k.z(1001),
				k.blend(k.BlendMode.Add),
			]);

			// Play sound
			audioService.playSound("powerup1", { volume: mainSoundVolume });
			props.onComplete?.(shrine.pos.clone());
		}
	});

	shrine.onDestroy(() => chargeFeedback.stop("charge-zone-destroyed"));

	function spawnShrineEnemyWave() {
		const spawnDistance = props.enemySpawnDistance ?? props.radius + 120;
		const baseAngle = k.rand(0, 360);
		const encounterCount = Math.max(1, Math.round(props.enemyWaveMultiplier ?? 1));
		shrine.wavesSpawned++;

		for (let index = 0; index < encounterCount; index++) {
			const angle = baseAngle + index * (360 / encounterCount);
			const spawnPos = shrine.pos.add(
				k.Vec2.fromAngle(angle).scale(spawnDistance)
			);
			k.add([
				k.pos(spawnPos),
				k.circle((props.enemySpawnSpacing ?? 48) * 0.55, { fill: false }),
				k.outline(3, k.rgb(255, 70, 70)),
				k.anchor("center"),
				k.opacity(0.9),
				k.layer(layers.gameEffects),
				k.lifespan(0.8, { fade: 0.55 }),
				tags.gameLoop,
				...(props.tags ?? []),
			]);
			spawnThreatEncounter(spawnPos, props.enemySpawnSpacing ?? 48);
		}
	}

	return shrine;
}
