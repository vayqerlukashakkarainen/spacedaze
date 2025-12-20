import { Vec2 } from "kaplay";
import { playerObj } from "../../game";
import { dt, k, mainSoundVolume } from "../../main";
import { audioService } from "../../services/audioService";
import { explosionEmitter } from "../../particles";
import { tags } from "../../tags";

interface ShrineProps {
	pos: Vec2;
	radius: number;
	captureTime: number;
}

export function spawnShrine(props: ShrineProps) {
	const shrine = k.add([
		k.pos(props.pos),
		k.sprite("crate1"), // Using crate as placeholder sprite
		k.anchor("center"),
		k.scale(1.5),
		k.opacity(1),
		{
			timer: 0,
			maxTimer: props.captureTime,
			isPlayerInside: false,
		},
		tags.props,
		tags.gameLoop,
	]);

	// Create circle to show radius
	const circle = shrine.add([
		k.circle(props.radius),
		k.anchor("center"),
		k.outline(3, k.rgb(255, 255, 255)),
		k.opacity(0.3),
		k.color(255, 255, 255),
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
			console.log("Shrine captured!");

			// Spawn particles
			explosionEmitter.pos = shrine.pos;
			explosionEmitter.emit(30);

			// Play sound
			audioService.playSound("powerup1", { volume: mainSoundVolume });

			// Destroy shrine
			k.destroy(shrine);
		}
	});

	return shrine;
}
