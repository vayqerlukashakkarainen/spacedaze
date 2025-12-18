import { playerObj, checkProjectileIntersection } from "../game";
import { dt, dtScaled, k, mainSoundVolume } from "../main";
import { audioService } from "../services/audioService";
import { starsEmitter } from "../particles";
import { player } from "../player";
import { PowerupKey, powerups, powerupsSprites } from "../powerups";
import { tags } from "../tags";
import { Vec2 } from "kaplay";
import { timescale } from "../comp/timescale";

export function spawnPowerup(pos: Vec2, powerupKey: PowerupKey) {
	const m = k.add([
		k.pos(pos),
		k.sprite(powerupsSprites[powerupKey]),
		k.rotate(0),
		k.anchor("center"),
		timescale(),
		k.offscreen({ destroy: true }),
		{
			dir: k.rand(k.vec2(-1, -1), k.vec2(1, 1)),
			speed: k.rand(40, 60),
			lifeSpan: 0,
		},
		tags.props,
		tags.unit,
		tags.gameLoop,
	]);

	const c = m.add([
		k.circle(16),
		k.scale(1),
		k.anchor("center"),
		k.opacity(0.2),
	]);

	// Helper function to collect the powerup
	const collectPowerup = () => {
		const powerupPos = m.pos.clone();
		starsEmitter.emitter.position = powerupPos;
		starsEmitter.emit(20);
		audioService.playSound("powerup1", { volume: mainSoundVolume });
		k.destroy(m);
		powerups[powerupKey](powerupPos);
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
			collectPowerup();
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
				collectPowerup();
			}
		}
	});
}
