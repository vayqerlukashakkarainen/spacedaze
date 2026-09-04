import { Vec2 } from "kaplay";
import {
	changeGameState,
	GameState,
	getScore,
	k,
	layers,
	mainSoundVolume,
	spendScore,
} from "../main";
import { starsEmitter } from "../particles";
import { spawnBuilding } from "./spawnBuilding";
import {
	setNextChestDifficulty,
	setNextChestRewardType,
	type ChestRewardType,
} from "../ui/chestChallenge";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";
import { audioService } from "../services/audioService";
import { spawnCurrencyBurst } from "./spawnCurrencyBurst";

const CHEST_SCALE = 0.75;

interface ChestOptions {
	rewardType?: ChestRewardType;
	purchaseCost?: number | (() => number);
	ghostCost?: number;
	debreeBurstCount?: number;
	onPurchased?: () => void;
	onOpened?: () => void;
}

export function spawnChest(
	pos: Vec2,
	difficulty: number = 1,
	options: ChestOptions = {}
) {
	let opened = false;
	const rewardType = options.rewardType ?? "salvage";
	const weaponChest = rewardType === "weapon";
	const ghost = options.ghostCost !== undefined;
	const requiresPurchase = ghost || options.purchaseCost !== undefined;
	let purchased = !requiresPurchase;
	const getPurchaseCost = () => {
		const configuredCost = options.purchaseCost ?? options.ghostCost ?? 0;
		const cost = typeof configuredCost === "function"
			? configuredCost()
			: configuredCost;
		return Math.max(0, Math.round(cost));
	};
	const chestTitle = ghost
		? weaponChest ? "GHOST WEAPON CACHE" : "GHOST CHEST"
		: weaponChest ? "WEAPON CACHE" : "SALVAGE CHEST";
	const chest = spawnBuilding({
		pos,
		sprite: "crate1",
		interactRadius: 60,
		scale: CHEST_SCALE,
		interactPromptOffset: k.vec2(0, -78),
		interactionPrompt: requiresPurchase
			? () => purchased
				? {
					title: chestTitle,
					action: weaponChest ? "OPEN CACHE" : "OPEN CHEST",
				}
				: {
					title: chestTitle,
					action: weaponChest ? "BUY CACHE" : "BUY CHEST",
					detailLeft: `COST ${getPurchaseCost()} SCRAP`,
					detailRight: `${getScore()} AVAILABLE`,
				}
			: weaponChest
				? {
					title: "WEAPON CACHE",
					action: "OPEN CACHE",
					detailLeft: "PRIMARY / SECONDARY",
				}
				: {
					title: "SALVAGE CHEST",
					action: "OPEN CHEST",
				},
		onInteract: () => {
			if (opened) return;
			if (!purchased && requiresPurchase) {
				const purchaseCost = getPurchaseCost();
				if (!spendScore(purchaseCost)) {
					audioService.playSound("error", {
						volume: mainSoundVolume * 0.5,
					});
					return;
				}
				purchased = true;
				chest.opacity = 1;
				spawnCurrencyBurst(chest.pos.clone(), {
					particleCount: options.debreeBurstCount ??
						12 + Math.round(purchaseCost * 0.7),
				});
				starsEmitter.emitter.position = chest.pos.clone();
				starsEmitter.emit(18);
				audioService.playSound("purchase1", {
					volume: mainSoundVolume,
				});
				options.onPurchased?.();
				return;
			}
			opened = true;
			openChest();
		},
	});
	chest.use(k.opacity(ghost ? 0.38 : 1));

	function openChest() {
		if (!chest.exists()) return;
		setNextChestDifficulty(difficulty);
		setNextChestRewardType(rewardType);
		starsEmitter.emitter.position = chest.pos.clone();
		starsEmitter.emit(32);
		k.destroy(chest);
		options.onOpened?.();
		changeGameState(GameState.ChestOpening);
	}
	if (weaponChest) {
		chest.add([
			k.sprite("weapon_standard_blaster", { width: 18, height: 18 }),
			k.pos(0, 0),
			k.anchor("center"),
			k.z(2),
		]);
	}
	const aura = chest.add([
		k.circle(14),
		k.anchor("center"),
		k.color(k.WHITE),
		k.opacity(0.08),
		k.z(-1),
		k.layer(layers.gameEffects),
	]);
	const auraRing = chest.add([
		k.circle(17, { fill: false }),
		k.anchor("center"),
		k.opacity(0.3),
		k.outline(1, k.WHITE),
		k.layer(layers.gameEffects),
		k.z(-1),
	]);

	chest.add([
		k.pos(),
		k.z(-1),
		k.particles(
			{
				max: 32,
				speed: [3, 10],
				angle: [0, 360],
				lifeTime: [0.7, 1.4],
				colors: [k.WHITE],
				opacities: [0, 0.9, 0],
				scales: [0.2, 0.8, 0.1],
				angularVelocity: [-60, 60],
				texture: k.getSprite("particle4")!.data!.frames[0].tex,
				quads: [k.getSprite("particle4")!.data!.frames[0].q],
			},
			{
				rate: 7,
				direction: -90,
				spread: 360,
				position: k.vec2(),
			}
		),
	]);

	registerBatchedEntityUpdate("world", chest, () => {
		const pulse = k.wave(0.92, 1.08, k.time() * 2.5);
		aura.scale = k.vec2(pulse);
		auraRing.scale = k.vec2(k.wave(0.96, 1.12, k.time() * 2));
		auraRing.opacity = k.wave(0.15, 0.4, k.time() * 2);
		if (ghost && !purchased && !opened) {
			chest.opacity = k.wave(0.28, 0.5, k.time() * 1.8);
		}
	});

	return chest;
}
