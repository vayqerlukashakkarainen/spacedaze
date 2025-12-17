import { Vec2 } from "kaplay";
import { checkProjectileIntersection, playerObj } from "../game";
import { dt, dtScaled, k, mainSoundVolume } from "../main";
import { audioService } from "../services/audioService";
import { starsEmitter } from "../particles";
import { player } from "../player";
import { tags } from "../tags";
import { timescale } from "../comp/timescale";
import { spawnRing } from "./spawnRing";
import { LevelKey, loadLevel } from "../levels/levels";

interface Props {
	pos: Vec2;
	levelName: LevelKey;
	spriteName: string;
}

export function spawnLevel(props: Props) {
	const m = k.add([
		k.pos(props.pos),
		k.sprite(props.spriteName),
		k.rotate(0),
		k.anchor("center"),
		timescale(),
		k.offscreen({ destroy: true }),
		{
			dir: k.rand(k.vec2(-1, -1), k.vec2(1, 1)),
			speed: k.rand(40, 60),
			lifeSpan: 0,
			levelName: props.levelName,
		},
		tags.props,
		tags.unit,
	]);

	const c = m.add([
		k.circle(16),
		k.scale(1),
		k.anchor("center"),
		k.opacity(0.2),
	]);

	// Helper function to collect the level portal
	const collectPortal = () => {
		const portalPos = m.pos.clone();

		// Visual effects (3A: Same as powerups)
		starsEmitter.emitter.position = portalPos;
		starsEmitter.emit(20);

		// Custom portal effect (3C: Ring effect)
		spawnRing({
			pos: portalPos,
			speed: 300,
			intensity: 0.8,
			maxRadius: 500,
			visualize: true,
		});

		// Play swap level sound (4C: New sound)
		audioService.playSound("swap_level", { volume: mainSoundVolume });

		// Destroy the portal
		k.destroy(m);

		// Wait 3 seconds, then start the level (5a)
		k.wait(3, () => {
			loadLevel(props.levelName);
		});
	};

	m.onUpdate(() => {
		if (m.lifeSpan < m.speed) {
			m.move(
				k
					.vec2(
						m.dir.x * (m.speed - m.lifeSpan),
						m.dir.y * (m.speed - m.lifeSpan)
					)
					.scale(dtScaled() * m.getTimescale())
			);

			m.lifeSpan += dt() * 45;
		}

		// Check if hit by player projectiles
		checkProjectileIntersection(m.pos, 16, tags.friendly, (p) => {
			k.destroy(p);
			collectPortal();
		});

		const dist = m.pos.dist(playerObj.pos);

		if (
			dist <
			player.debreeSeekDistance * player.debreeSeekDistanceMultiplier
		) {
			m.moveTo(
				playerObj.pos,
				player.debreeSeekSpeed * player.debreeSeekSpeedMultiplier
			);

			if (dist < player.debreePickupDistance) {
				collectPortal();
			}
		}
	});
}
