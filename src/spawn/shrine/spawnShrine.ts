import { Vec2 } from "kaplay";
import { playerObj } from "../../game";
import { dt, k, mainSoundVolume } from "../../main";
import { audioService } from "../../services/audioService";
import { explosionEmitter } from "../../particles";
import { tags } from "../../tags";
import { spawnThreatEncounter } from "../../services/enemyEncounterService";

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
	onComplete?: (pos: Vec2) => void;
	tags?: string[];
}

export function spawnShrine(props: ShrineProps) {
	const shrineLevel = Math.max(1, Math.floor(props.level ?? 1));
	const shrine = k.add([
		k.pos(props.pos),
		k.sprite("crate1"), // Using crate as placeholder sprite
		k.anchor("center"),
		k.scale(SHRINE_VISUAL_SCALE),
		k.opacity(1),
		{
			timer: 0,
			maxTimer: props.captureTime,
			isPlayerInside: false,
			enemySpawnTimer: props.enemySpawnDelay ?? 1.5,
			wavesSpawned: 0,
		},
		tags.props,
		tags.gameLoop,
		...(props.tags ?? []),
	]);

	// Create circle to show radius
	const circle = shrine.add([
		k.circle(props.radius / SHRINE_VISUAL_SCALE),
		k.anchor("center"),
		k.outline(3, k.rgb(255, 255, 255)),
		k.opacity(0.3),
		k.color(255, 255, 255),
	]);
	shrine.add([
		k.text(`SHRINE LVL ${shrineLevel}`, { size: 7, font: "unscii" }),
		k.pos(0, 27),
		k.anchor("center"),
		k.color(100, 200, 255),
		k.z(2),
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
	]);

	const barFill = shrine.add([
		k.rect(0, barHeight),
		k.pos(-barWidth / 2, -50),
		k.anchor("left"),
		k.color(100, 200, 255),
		k.opacity(0.9),
	]);

	shrine.onUpdate(() => {
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
			circle.opacity = k.lerp(circle.opacity, 0.8, 5 * dt());
		} else {
			// Player outside: decrease timer quickly
			shrine.timer -= dt() * 3;
			if (shrine.timer < 0) shrine.timer = 0;
			// Decrease circle opacity
			circle.opacity = k.lerp(circle.opacity, 0.3, 5 * dt());
		}

		// Update timer bar
		const progress = shrine.timer / shrine.maxTimer;
		barFill.width = barWidth * progress;

		// Check if capture complete
		if (shrine.timer >= shrine.maxTimer) {
			// Spawn particles
			explosionEmitter.pos = shrine.pos;
			explosionEmitter.emit(30);

			// Play sound
			audioService.playSound("powerup1", { volume: mainSoundVolume });
			props.onComplete?.(shrine.pos.clone());

			// Destroy shrine
			k.destroy(shrine);
		}
	});

	function spawnShrineEnemyWave() {
		const spawnDistance = props.enemySpawnDistance ?? props.radius + 120;
		const angle = k.rand(0, 360);
		const spawnPos = shrine.pos.add(
			k.Vec2.fromAngle(angle).scale(spawnDistance)
		);
		shrine.wavesSpawned++;

		k.add([
			k.pos(spawnPos),
			k.circle((props.enemySpawnSpacing ?? 48) * 0.55, { fill: false }),
			k.outline(3, k.rgb(255, 70, 70)),
			k.anchor("center"),
			k.opacity(0.9),
			k.lifespan(0.8, { fade: 0.55 }),
			tags.gameLoop,
			...(props.tags ?? []),
		]);

		spawnThreatEncounter(spawnPos, props.enemySpawnSpacing ?? 48);
	}

	return shrine;
}
