import { playerObj, checkProjectileIntersection } from "../game";
import { dt, k, layers, mainSoundVolume, velocityScale } from "../main";
import { audioService } from "../services/audioService";
import { starsEmitter } from "../particles";
import { player } from "../player";
import { PowerupKey } from "../powerups";
import { tags } from "../tags";
import { Vec2 } from "kaplay";
import { timescale } from "../comp/timescale";
import {
	addCollectedPowerup,
	showRewardAcquisitionPopover,
} from "../ui/gameUi";
import { UI_FONT_SIZES } from "../ui/common";
import {
	applyReward,
	createReward,
	REWARD_RARITY_COLORS,
	Reward,
	RewardRarity,
} from "../services/rewardService";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";

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
	applyEffect?: (reward: Reward, pos: Vec2) => boolean;
	onCollected?: (reward: Reward) => void;
}

export function spawnRerollTokenPickup(
	pos: Vec2,
	options: Pick<RewardPickupOptions, "stationary" | "label"> = {}
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
	let collected = false;
	let armed = !options.armWhenPlayerLeaves;
	const feedback = RARITY_FEEDBACK[reward.rarity];
	const rarityColor = k.rgb(...REWARD_RARITY_COLORS[reward.rarity]);
	const m = k.add([
		k.pos(pos),
		k.sprite(reward.sprite, { width: 24, height: 24 }),
		k.outline(1, rarityColor),
		k.rotate(0),
		k.scale(REWARD_PICKUP_SCALE),
		k.anchor("center"),
		timescale(),
		k.offscreen({ destroy: true }),
		{
			dir: k.rand(k.vec2(-1, -1), k.vec2(1, 1)),
			speed: options.stationary ? 0 : k.rand(40, 60),
			lifeSpan: 0,
		},
		tags.props,
		tags.unit,
		tags.gameLoop,
	]);
	const pickupBackdrop = m.add([
		k.circle(feedback.auraRadius - 3),
		k.anchor("center"),
		k.scale(1),
		k.color(rarityColor),
		k.opacity(feedback.auraOpacity * 0.65),
		k.outline(2, rarityColor),
		k.z(-1),
		k.layer(layers.gameEffects),
	]);

	const auraRings = Array.from({ length: feedback.tier }, (_, index) =>
		m.add([
			k.circle(feedback.auraRadius + index * 5, { fill: false }),
			k.scale(1),
			k.anchor("center"),
			k.opacity(feedback.auraOpacity / (index + 1)),
			k.outline(1, rarityColor),
			k.layer(layers.gameEffects),
		])
	);

	if (options.label) {
		m.add([
			k.text(options.label, {
				font: "unscii",
				size: UI_FONT_SIZES.tiny,
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
		collected = true;
		const powerupPos = m.pos.clone();
		starsEmitter.emitter.position = powerupPos;
		starsEmitter.emit(feedback.pickupParticles);
		audioService.playSound("powerup1", {
			volume: mainSoundVolume * POWERUP_PICKUP_VOLUME,
			detune: feedback.soundDetune,
		});
		if (feedback.pickupShake > 0) k.shake(feedback.pickupShake);
		k.destroy(m);
		const applied = options.applyEffect
			? options.applyEffect(reward, powerupPos)
			: applyReward(reward, powerupPos);
		if (!applied) return;
		if (reward.kind === "item" && reward.id === "rerollToken") {
			showRewardAcquisitionPopover(reward);
		} else {
			addCollectedPowerup(reward);
		}
		options.onCollected?.(reward);
	};

	registerBatchedEntityUpdate("world", m, () => {
		const dist = m.pos.dist(playerObj.pos);
		if (!armed && dist > 40) armed = true;

		const pulse = k.wave(
			REWARD_PICKUP_SCALE * (1 - feedback.pulseAmount),
			REWARD_PICKUP_SCALE * (1 + feedback.pulseAmount),
			k.time() * feedback.pulseSpeed
		);
		m.scale = k.vec2(pulse);
		pickupBackdrop.scale = k.vec2(k.wave(0.96, 1.04, k.time() * 2));
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
}
