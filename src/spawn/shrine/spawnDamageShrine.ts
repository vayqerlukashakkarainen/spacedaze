import { Vec2 } from "kaplay";
import { checkProjectileIntersection } from "../../game";
import { dt, k, mainSoundVolume } from "../../main";
import { audioService } from "../../services/audioService";
import { explosionEmitter } from "../../particles";
import { tags } from "../../tags";
import { registerHitAnimation } from "../../shared";
import { showDamageNumber } from "../../services/damageService";
import { tryBounceProjectile } from "../../services/projectileService";

interface DamageShrineProps {
	pos: Vec2;
	health: number;
	depleteRate: number; // damage per second that depletes
	onComplete?: (pos: Vec2) => void;
	tags?: string[];
}

export function spawnDamageShrine(props: DamageShrineProps) {
	const shrine = k.add([
		k.pos(props.pos),
		k.sprite("crate1"), // Using crate as placeholder sprite
		k.anchor("center"),
		k.scale(1.5),
		k.opacity(1),
		k.animate(),
		{
			damageReceived: 0,
			maxHealth: props.health,
			depleteRate: props.depleteRate,
		},
		tags.enemy,
		tags.props,
		tags.gameLoop,
		...(props.tags ?? []),
	]);

	registerHitAnimation(shrine);

	// Add health bar above shrine
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
		k.color(255, 100, 100),
		k.opacity(0.9),
	]);

	shrine.onUpdate(() => {
		// Deplete damage over time
		shrine.damageReceived -= props.depleteRate * dt();
		if (shrine.damageReceived < 0) shrine.damageReceived = 0;

		// Check for projectile hits
		checkProjectileIntersection(shrine.pos, 24, tags.friendly, (p) => {
			// Add damage from projectile
			const damage = p.impactDamage ?? 1;
			shrine.damageReceived += damage;
			showDamageNumber(shrine.pos, damage);

			// Trigger hit animation
			if (shrine.animation) {
				shrine.animation.seek(0);
			}

			// Play hit sound
			audioService.playSound("hit1", { volume: mainSoundVolume });

			if (!tryBounceProjectile(p, shrine)) k.destroy(p);
		});

		// Update health bar
		const progress = shrine.damageReceived / shrine.maxHealth;
		barFill.width = barWidth * progress;

		// Check if health threshold reached
		if (shrine.damageReceived >= shrine.maxHealth) {
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

	return shrine;
}
