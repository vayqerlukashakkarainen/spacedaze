import { playerObj, checkProjectileIntersection } from "../game";
import { dt, k, layers, mainSoundVolume, velocityScale } from "../main";
import { audioService } from "../services/audioService";
import { starsEmitter } from "../particles";
import { player } from "../player";
import { PowerupKey } from "../powerups";
import { tags } from "../tags";
import { type Color, Vec2 } from "kaplay";
import { timescale } from "../comp/timescale";
import {
	addCollectedPowerup,
	showRewardAcquisitionPopover,
} from "../ui/gameUi";
import {
	applyReward,
	createReward,
	REWARD_RARITY_COLORS,
	Reward,
	RewardRarity,
} from "../services/rewardService";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";
import {
	recordTelemetryRewardOffered,
	recordTelemetryRewardSelected,
	type RewardTelemetrySource,
} from "../services/runTelemetryService";
import { interactable } from "../comp/interactable";
import {
	createInteractionPrompt,
	createNpcInteractionPrompt,
} from "../ui/common";
import {
	addLocalLight,
	updateLocalLight,
} from "../services/localLightService";

interface RarityFeedback {
	tier: number;
	auraRadius: number;
	auraOpacity: number;
	pulseAmount: number;
	pulseSpeed: number;
	pickupParticles: number;
	pickupShake: number;
	soundDetune: number;
}

const REWARD_PICKUP_SCALE = 0.7;
const REWARD_PICKUP_LABEL_SIZE = 7;
const POWERUP_PICKUP_VOLUME = 0.8;

const RARITY_FEEDBACK: Record<RewardRarity, RarityFeedback> = {
	[RewardRarity.Common]: {
		tier: 1,
		auraRadius: 24,
		auraOpacity: 0.22,
		pulseAmount: 0.02,
		pulseSpeed: 2,
		pickupParticles: 12,
		pickupShake: 0,
		soundDetune: 0,
	},
	[RewardRarity.Uncommon]: {
		tier: 2,
		auraRadius: 27,
		auraOpacity: 0.26,
		pulseAmount: 0.04,
		pulseSpeed: 2.5,
		pickupParticles: 20,
		pickupShake: 0,
		soundDetune: 100,
	},
	[RewardRarity.Rare]: {
		tier: 3,
		auraRadius: 30,
		auraOpacity: 0.3,
		pulseAmount: 0.07,
		pulseSpeed: 3,
		pickupParticles: 32,
		pickupShake: 2,
		soundDetune: 250,
	},
	[RewardRarity.Epic]: {
		tier: 4,
		auraRadius: 34,
		auraOpacity: 0.36,
		pulseAmount: 0.1,
		pulseSpeed: 3.5,
		pickupParticles: 50,
		pickupShake: 4,
		soundDetune: 450,
	},
	[RewardRarity.Legendary]: {
		tier: 5,
		auraRadius: 39,
		auraOpacity: 0.44,
		pulseAmount: 0.14,
		pulseSpeed: 4,
		pickupParticles: 72,
		pickupShake: 7,
		soundDetune: 650,
	},
};

export function spawnPowerup(pos: Vec2, powerupKey: PowerupKey) {
	const reward = createReward(powerupKey);
	if (!reward) return;
	return spawnRewardPickup(pos, reward);
}

interface RewardPickupOptions {
	stationary?: boolean;
	label?: string;
	armWhenPlayerLeaves?: boolean;
	interactionOnly?: boolean;
	interactionRadius?: number;
	interactionPromptStyle?: "detail" | "key";
	interactionPromptLabel?: {
		text: string;
		color?: Color;
	} | (() => { text: string; color?: Color } | undefined);
	compactAura?: boolean;
	persistent?: boolean;
	suppressAcquisition?: boolean;
	beforeCollect?: () => boolean;
	tags?: string[];
	applyEffect?: (reward: Reward, pos: Vec2) => boolean;
	onCollected?: (reward: Reward) => void;
	telemetrySource?: RewardTelemetrySource;
	recordOffer?: boolean;
	launch?: {
		endOffset?: Vec2;
		height?: number;
		duration?: number;
	};
}

export function spawnRerollTokenPickup(
	pos: Vec2,
	options: Pick<
		RewardPickupOptions,
		"stationary" | "label" | "telemetrySource"
	> = {}
) {
	const reward = createReward("rerollToken");
	if (!reward) return;
	return spawnRewardPickup(pos, reward, options);
}

export function spawnRewardPickup(
	pos: Vec2,
	reward: Reward,
	options: RewardPickupOptions = {}
) {
	if (
		options.telemetrySource &&
		!options.suppressAcquisition &&
		options.recordOffer !== false
	) {
		recordTelemetryRewardOffered(reward.id, {
			source: options.telemetrySource,
			category: reward.kind,
			rarity: reward.rarity,
		});
	}
	let collected = false;
	let armed = !options.armWhenPlayerLeaves && !options.launch;
	const feedback = RARITY_FEEDBACK[reward.rarity];
	const rarityColor = k.rgb(...REWARD_RARITY_COLORS[reward.rarity]);
	const compactAura = options.compactAura ?? true;
	const auraRadius = compactAura ? 18 : feedback.auraRadius;
	const components: any[] = [
		k.pos(pos),
		k.sprite(reward.sprite, { width: 24, height: 24 }),
		k.outline(1, rarityColor),
		k.rotate(0),
		k.scale(REWARD_PICKUP_SCALE),
		k.anchor("center"),
		timescale(),
		k.offscreen({ destroy: !options.interactionOnly }),
		{
			dir: k.rand(k.vec2(-1, -1), k.vec2(1, 1)),
			speed: options.stationary ? 0 : k.rand(40, 60),
			lifeSpan: 0,
		},
		tags.props,
		tags.unit,
		tags.gameLoop,
		tags.runtimeCullable,
		...(options.tags ?? []),
	];
	if (options.interactionOnly) {
		components.push(interactable(
			options.interactionRadius ?? 48,
			() => collectPowerup()
		));
	}
	const m = k.add(components);
	const launchStart = pos.clone();
	const launchEnd = pos.add(options.launch?.endOffset ?? k.vec2(0, -48));
	const launchDuration = options.launch?.duration ?? 0.52;
	const launchHeight = options.launch?.height ?? 34;
	let launchElapsed = 0;
	const pickupBackdrop = m.add([
		k.circle(compactAura ? auraRadius : auraRadius - 3),
		k.anchor("center"),
		k.scale(1),
		k.color(rarityColor),
		k.opacity(compactAura ? 0.16 : feedback.auraOpacity * 0.65),
		k.outline(compactAura ? 1 : 2, rarityColor),
		k.z(-1),
		k.layer(layers.gameEffects),
	]);

	const auraRings = Array.from({
		length: compactAura ? 0 : feedback.tier,
	}, (_, index) =>
		m.add([
			k.circle(auraRadius + index * 5, { fill: false }),
			k.scale(1),
			k.anchor("center"),
			k.opacity(feedback.auraOpacity / (index + 1)),
			k.outline(1, rarityColor),
			k.layer(layers.gameEffects),
		])
	);
	const interactionGlow = options.interactionOnly && !compactAura
		? addLocalLight(m, {
			size: feedback.auraRadius * 2.2,
			color: REWARD_RARITY_COLORS[reward.rarity],
			opacity: Math.max(0.35, feedback.auraOpacity),
			pulse: {
				scaleMin: 0.9,
				scaleMax: 1.12,
				scaleSpeed: 3.4,
				opacityMin: 0.3,
				opacityMax: 0.62,
				opacitySpeed: 2.8,
			},
		})
		: undefined;
	if (options.interactionOnly && !compactAura) {
		m.add([
			k.pos(),
			k.z(-1),
			k.particles(
				{
					max: 18,
					speed: [4, 11],
					angle: [0, 360],
					lifeTime: [0.6, 1.15],
					colors: [rarityColor, k.WHITE],
					opacities: [0, 0.9, 0],
					scales: [0.15, 0.65, 0],
					angularVelocity: [-90, 90],
					texture: k.getSprite("particle4")!.data!.frames[0].tex,
					quads: [k.getSprite("particle4")!.data!.frames[0].q],
				},
				{
					rate: 2 + feedback.tier,
					direction: -90,
					spread: 360,
					position: k.vec2(),
				}
			),
		]);
	}
	const interactionPrompt = !options.interactionOnly
		? undefined
		: options.interactionPromptStyle === "key"
			? createNpcInteractionPrompt({
				target: m,
				offset: k.vec2(0, -34),
				label: options.interactionPromptLabel,
			})
			: createInteractionPrompt({
				target: m,
				offset: k.vec2(0, -48),
				content: {
					title: reward.name,
					action: "EQUIP",
					detailLeft: reward.abilitySlot ?? "EQUIPMENT",
					detailRight: reward.rarity,
				},
			});

	if (options.label) {
		m.add([
			k.text(options.label, {
				font: "unscii",
				size: REWARD_PICKUP_LABEL_SIZE,
				width: 140,
				align: "center",
			}),
			k.pos(0, -28),
			k.anchor("center"),
			k.color(rarityColor),
			k.layer(layers.gameText),
		]);
	}

	// Helper function to collect the powerup
	const collectPowerup = () => {
		if (collected || !armed) return;
		if (options.beforeCollect && !options.beforeCollect()) return;
		collected = true;
		const powerupPos = m.pos.clone();
		starsEmitter.emitter.position = powerupPos;
		starsEmitter.emit(feedback.pickupParticles);
		audioService.playSound("powerup1", {
			volume: mainSoundVolume * POWERUP_PICKUP_VOLUME,
			detune: feedback.soundDetune,
		});
		if (feedback.pickupShake > 0) k.shake(feedback.pickupShake);
		if (!options.persistent) k.destroy(m);
		const applied = options.applyEffect
			? options.applyEffect(reward, powerupPos)
			: applyReward(reward, powerupPos);
		if (!applied) {
			if (options.persistent) collected = false;
			return;
		}
		if (options.suppressAcquisition) {
			// Equipment swaps move an existing ability rather than granting it again.
		} else if (reward.kind === "item" && reward.id === "rerollToken") {
			showRewardAcquisitionPopover(reward);
			recordTelemetryRewardSelected(reward.id, reward.rarity, false, {
				source: options.telemetrySource ?? "world-pickup",
				category: reward.kind,
			});
		} else {
			addCollectedPowerup(reward, {
				source: options.telemetrySource ?? "world-pickup",
				category: reward.kind,
				rarity: reward.rarity,
			});
		}
		options.onCollected?.(reward);
		if (options.persistent) collected = false;
	};

	registerBatchedEntityUpdate("world", m, () => {
		const dist = m.pos.dist(playerObj.pos);
		interactionPrompt?.update(m.isInRange === true);
		if (interactionGlow) updateLocalLight(interactionGlow);
		if (options.launch && launchElapsed < launchDuration) {
			launchElapsed = Math.min(
				launchDuration,
				launchElapsed + dt() * m.getTimescale()
			);
			const progress = k.clamp(launchElapsed / launchDuration, 0, 1);
			m.pos = launchStart.lerp(launchEnd, progress);
			m.pos.y -= Math.sin(progress * Math.PI) * launchHeight;
			const popScale = progress < 0.24
				? k.lerp(0.35, 1.12, progress / 0.24)
				: k.lerp(1.12, 1, (progress - 0.24) / 0.76);
			m.scale = k.vec2(REWARD_PICKUP_SCALE * popScale);
			if (progress >= 1) armed = true;
			return;
		}
		if (!armed && dist > 40) armed = true;

		const pulseAmount = compactAura ? 0.015 : feedback.pulseAmount;
		const pulse = k.wave(
			REWARD_PICKUP_SCALE * (1 - pulseAmount),
			REWARD_PICKUP_SCALE * (1 + pulseAmount),
			k.time() * feedback.pulseSpeed
		);
		m.scale = k.vec2(pulse);
		pickupBackdrop.scale = k.vec2(compactAura
			? k.wave(0.98, 1.02, k.time() * 2)
			: k.wave(0.96, 1.04, k.time() * 2));
		for (let index = 0; index < auraRings.length; index++) {
			const ringPulse = k.wave(
				0.94,
				1.06,
				k.time() * feedback.pulseSpeed + index * 0.8
			);
			auraRings[index].scale = k.vec2(ringPulse);
		}

		if (m.lifeSpan < m.speed) {
			m.move(
				k
					.vec2(
						m.dir.x * (m.speed - m.lifeSpan),
						m.dir.y * (m.speed - m.lifeSpan)
					)
					.scale(velocityScale() * m.getTimescale())
			);

			m.lifeSpan += dt() * 45;
		}
		if (options.interactionOnly) return;

		// Check if hit by player projectiles
		checkProjectileIntersection(m.pos, 16, tags.friendly, (p) => {
			collectPowerup();
		});

		if (
			dist <
			player.debreeSeekDistance * player.debreeSeekDistanceMultiplier
		) {
			collectPowerup();
		}
	});
	return m;
}
