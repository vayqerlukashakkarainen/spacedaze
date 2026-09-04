import type {
	GameObj,
	OpacityComp,
	PosComp,
	RotateComp,
	ScaleComp,
	Vec2,
} from "kaplay";
import {
	k,
	layers,
	mainSoundVolume,
	WORLD_CAMERA_SCALE,
} from "../main";
import { transitionToLevel, type LevelKey } from "../levels/levels";
import { starsEmitter } from "../particles";
import { tags } from "../tags";
import { audioService } from "./audioService";
import { profileSection } from "./frameProfilerService";

const chargeDuration = 0.2;
const entryDuration = 0.3;
const shutterDuration = 0.2;
const arrivalDuration = 0.4;
const cameraFollowSpeed = 8;

type TransitionPlayer = GameObj<
	PosComp | RotateComp | ScaleComp | OpacityComp
>;

interface TransitionOptions {
	portal: GameObj<PosComp | ScaleComp>;
	player: TransitionPlayer;
	targetLevel: LevelKey;
}

let transitionActive = false;

export function levelTransitionActive() {
	return transitionActive;
}

export function startLevelTransition(options: TransitionOptions) {
	if (transitionActive) return;
	transitionActive = true;

	let phase: "charge" | "entry" | "shutter" | "arrival" = "charge";
	let phaseTime = 0;
	let levelSwapped = false;
	let cameraPos = k.getCamPos().clone();
	const cameraStartScale = k.getCamScale().x;
	const portalPos = options.portal.pos.clone();
	const playerStartPos = options.player.pos.clone();
	const playerStartScale = options.player.scale.clone();
	const playerStartAngle = options.player.angle;
	const halfHeight = k.height() / 2;

	const topShutter = k.add([
		k.pos(0, 0),
		k.rect(k.width(), 0),
		k.color(k.BLACK),
		k.fixed(),
		k.layer(layers.ui),
		k.z(10000),
		tags.levelTransition,
	]);
	const bottomShutter = k.add([
		k.pos(0, k.height()),
		k.rect(k.width(), 0),
		k.anchor("botleft"),
		k.color(k.BLACK),
		k.fixed(),
		k.layer(layers.ui),
		k.z(10000),
		tags.levelTransition,
	]);
	const transitionLine = k.add([
		k.pos(0, halfHeight - 1),
		k.rect(k.width(), 2),
		k.color(k.WHITE),
		k.opacity(0),
		k.fixed(),
		k.layer(layers.ui),
		k.z(10001),
		tags.levelTransition,
	]);
	const controller = k.add([tags.levelTransition]);

	audioService.playSound("swap_level", { volume: mainSoundVolume });
	starsEmitter.emitter.position = portalPos;
	starsEmitter.emit(20);

	controller.onUpdate(() => profileSection("external:levelTransition", () => {
		phaseTime += k.dt();

		if (phase === "charge") {
			const progress = k.clamp(phaseTime / chargeDuration, 0, 1);
			setPortalIntensity(options.portal, progress);
			options.portal.scale = k.vec2(k.lerp(1, 1.25, progress));
			k.setCamScale(
				k.lerp(cameraStartScale, WORLD_CAMERA_SCALE * 1.08, progress)
			);
			cameraPos = followCamera(cameraPos, portalPos);

			if (progress >= 1) {
				phase = "entry";
				phaseTime = 0;
			}
			return;
		}

		if (phase === "entry") {
			const progress = k.clamp(phaseTime / entryDuration, 0, 1);
			const easedProgress = progress * progress * (3 - 2 * progress);
			options.player.pos = playerStartPos.lerp(portalPos, easedProgress);
			options.player.scale = playerStartScale.scale(1 - easedProgress * 0.94);
			options.player.opacity = 1 - easedProgress;
			options.player.angle = playerStartAngle + easedProgress * 120;
			setPortalIntensity(options.portal, 1 + progress * 2);
			k.setCamScale(WORLD_CAMERA_SCALE * 1.08);
			cameraPos = followCamera(cameraPos, portalPos);

			if (progress >= 1) {
				phase = "shutter";
				phaseTime = 0;
			}
			return;
		}

		if (phase === "shutter") {
			const progress = k.clamp(phaseTime / shutterDuration, 0, 1);
			topShutter.height = halfHeight * progress;
			bottomShutter.height = halfHeight * progress;
			transitionLine.opacity = progress > 0.72 ? (progress - 0.72) / 0.28 : 0;
			k.setCamScale(
				k.lerp(
					WORLD_CAMERA_SCALE * 1.08,
					WORLD_CAMERA_SCALE * 1.12,
					progress
				)
			);
			cameraPos = followCamera(cameraPos, portalPos);

			if (progress >= 1 && !levelSwapped) {
				levelSwapped = true;
				transitionToLevel(options.targetLevel);
				cameraPos = options.player.pos.clone();
				k.setCamPos(cameraPos);
				k.setCamScale(WORLD_CAMERA_SCALE * 1.06);
				options.player.angle = playerStartAngle;
				spawnArrivalEffect(options.player.pos);
				phase = "arrival";
				phaseTime = 0;
			}
			return;
		}

		const progress = k.clamp(phaseTime / arrivalDuration, 0, 1);
		const revealProgress = progress * progress * (3 - 2 * progress);
		topShutter.height = halfHeight * (1 - revealProgress);
		bottomShutter.height = halfHeight * (1 - revealProgress);
		transitionLine.opacity = k.clamp(1 - progress * 5, 0, 1);
		options.player.scale = playerStartScale.scale(
			k.lerp(0.06, 1, revealProgress)
		);
		options.player.opacity = revealProgress;
		k.setCamScale(
			k.lerp(
				WORLD_CAMERA_SCALE * 1.06,
				WORLD_CAMERA_SCALE,
				revealProgress
			)
		);
		cameraPos = followCamera(cameraPos, options.player.pos);

		if (progress >= 1) finishTransition();
	}));

	function followCamera(current: Vec2, target: Vec2) {
		const next = current.lerp(
			target,
			1 - Math.exp(-cameraFollowSpeed * k.dt())
		);
		k.setCamPos(next);
		return next;
	}

	function finishTransition() {
		options.player.scale = playerStartScale;
		options.player.opacity = 1;
		options.player.angle = playerStartAngle;
		k.setCamScale(WORLD_CAMERA_SCALE);
		transitionActive = false;
		k.destroy(topShutter);
		k.destroy(bottomShutter);
		k.destroy(transitionLine);
		k.destroy(controller);
	}
}

function setPortalIntensity(portal: GameObj, intensity: number) {
	(portal as GameObj & { transitionIntensity?: number }).transitionIntensity =
		intensity;
}

function spawnArrivalEffect(pos: Vec2) {
	starsEmitter.emitter.position = pos;
	starsEmitter.emit(32);
}
