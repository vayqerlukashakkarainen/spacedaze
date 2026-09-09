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
	setNextChestRewardCollectedCallback,
	setNextChestRewardType,
	setNextChestWorldOpenAnimation,
	setNextChestWorldPosition,
	type ChestRewardType,
} from "../ui/chestChallenge";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";
import { gameSoundService } from "../services/gameSoundService"
import { spawnCurrencyBurst } from "./spawnCurrencyBurst";
import { playRequirementErrorSound } from "../services/uiSoundService";
import { createNpcInteractionPrompt, UI_COLORS } from "../ui/common";
import { getPickupVisual } from "../visuals/pickupVisualCatalog";
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation";

const CHEST_AURA_RADIUS = 20;
const CHEST_RING_RADIUS = 25;
const CHEST_OPEN_ANTICIPATION_DURATION = 0.22;
const CHEST_OPEN_RELEASE_DURATION = 0.28;

interface ChestOptions {
	rewardType?: ChestRewardType;
	purchaseCost?: number | (() => number);
	ghostCost?: number;
	available?: boolean | (() => boolean);
	ghostWhenUnavailable?: boolean;
	debreeBurstCount?: number;
	onPurchased?: () => void;
	onOpened?: () => void;
	onRewardCollected?: () => void;
	tags?: string[];
}

export function spawnChest(
	pos: Vec2,
	difficulty: number = 1,
	options: ChestOptions = {}
) {
	let opened = false;
	const rewardType = options.rewardType ?? "salvage";
	const weaponChest = rewardType === "weapon";
	const chestVisual = getPickupVisual(weaponChest ? "weapon-chest" : "salvage-chest");
	const openedChestVisual = getPickupVisual(
		weaponChest ? "weapon-chest-open" : "salvage-chest-open"
	);
	const chestSprite = requirePrimaryVisualSprite(chestVisual);
	const openedChestSprite = requirePrimaryVisualSprite(openedChestVisual);
	const ghost = options.ghostCost !== undefined;
	const isAvailable = () => typeof options.available === "function"
		? options.available()
		: options.available ?? true;
	let available = isAvailable();
	const requiresPurchase = ghost || options.purchaseCost !== undefined;
	let purchased = !requiresPurchase;
	const getPurchaseCost = () => {
		const configuredCost = options.purchaseCost ?? options.ghostCost ?? 0;
		const cost = typeof configuredCost === "function"
			? configuredCost()
			: configuredCost;
		return Math.max(0, Math.round(cost));
	};
	const chest = spawnBuilding({
		pos,
		sprite: chestSprite,
		interactRadius: available ? 60 : 0,
		scale: chestVisual.worldScale,
		interactionPrompt: false,
		tags: options.tags,
		onInteract: () => {
			if (opened || !isAvailable()) return;
			if (!purchased && requiresPurchase) {
				const purchaseCost = getPurchaseCost();
				if (!spendScore(purchaseCost)) {
					playRequirementErrorSound();
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
				gameSoundService.play("purchase1", {
					volume: mainSoundVolume,
				});
				options.onPurchased?.();
				return;
			}
			opened = true;
			startChestSequence();
		},
	});
	const interactionPrompt = createNpcInteractionPrompt({
		target: chest,
		offset: k.vec2(0, -48),
		label: () => requiresPurchase && !purchased
			? {
				text: `${getPurchaseCost()}`,
				color: getScore() >= getPurchaseCost()
					? k.rgb(...UI_COLORS.text)
					: k.rgb(...UI_COLORS.danger),
			}
			: undefined,
	});
	chest.use(k.opacity(
		ghost || (options.ghostWhenUnavailable && !available) ? 0.38 : 1
	));

	function startChestSequence() {
		if (!chest.exists()) return;
		setNextChestDifficulty(difficulty);
		setNextChestRewardType(rewardType);
		setNextChestWorldPosition(chest.pos.clone());
		setNextChestWorldOpenAnimation(playChestOpenAnimation);
		setNextChestRewardCollectedCallback(options.onRewardCollected);
		chest.isInRange = false;
		chest.setInteractRadius(0);
		chest.setOnInteract(() => {});
		if (aura.exists()) k.destroy(aura);
		if (auraRing.exists()) k.destroy(auraRing);
		if (sparkles.exists()) k.destroy(sparkles);
		changeGameState(GameState.ChestOpening);
	}

	async function playChestOpenAnimation() {
		if (!chest.exists()) return;
		const chestScale = chestVisual.worldScale;
		chest.use(k.animate());
		chest.animate(
			"scale",
			[
				k.vec2(chestScale),
				k.vec2(chestScale * 1.12, chestScale * 0.72),
			],
			{
				duration: CHEST_OPEN_ANTICIPATION_DURATION,
				loops: 1,
				easing: k.easings.easeInCubic,
			}
		);
		gameSoundService.play("chest_open_charge", {
			volume: mainSoundVolume * 0.4,
			speed: 1.45,
		});
		await k.wait(CHEST_OPEN_ANTICIPATION_DURATION);
		if (!chest.exists()) return;
		chest.use(k.sprite(openedChestSprite));
		chest.animate(
			"scale",
			[
				k.vec2(chestScale * 1.24, chestScale * 0.82),
				k.vec2(chestScale * 0.92, chestScale * 1.08),
				k.vec2(chestScale),
			],
			{
				duration: CHEST_OPEN_RELEASE_DURATION,
				loops: 1,
				timing: [0, 0.55, 1],
				easing: k.easings.easeOutCubic,
			}
		);
		starsEmitter.emitter.position = chest.pos.clone();
		starsEmitter.emit(32);
		gameSoundService.play("powerup1", {
			volume: mainSoundVolume * 0.65,
			detune: 80,
		});
		chest.opacity = 0.72;
		await k.wait(CHEST_OPEN_RELEASE_DURATION);
		if (!chest.exists()) return;
		chest.scale = k.vec2(chestScale);
		options.onOpened?.();
	}
	const aura = chest.add([
		k.circle(CHEST_AURA_RADIUS),
		k.anchor("center"),
		k.color(k.WHITE),
		k.opacity(0.08),
		k.z(-1),
		k.layer(layers.gameEffects),
	]);
	const auraRing = chest.add([
		k.circle(CHEST_RING_RADIUS, { fill: false }),
		k.anchor("center"),
		k.opacity(0.3),
		k.outline(1, k.WHITE),
		k.layer(layers.gameEffects),
		k.z(-1),
	]);

	const sparkles = chest.add([
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
		const nextAvailable = isAvailable();
		if (nextAvailable !== available) {
			available = nextAvailable;
			chest.setInteractRadius(available && !opened ? 60 : 0);
			if (available && !opened) chest.opacity = 1;
		}
		interactionPrompt.update(available && chest.isInRange);
		if (opened) return;
		const pulse = k.wave(0.92, 1.08, k.time() * 2.5);
		aura.scale = k.vec2(pulse);
		auraRing.scale = k.vec2(k.wave(0.96, 1.12, k.time() * 2));
		auraRing.opacity = k.wave(0.15, 0.4, k.time() * 2);
		if (ghost && !purchased && !opened) {
			chest.opacity = k.wave(0.28, 0.5, k.time() * 1.8);
		} else if (options.ghostWhenUnavailable && !available) {
			chest.opacity = k.wave(0.2, 0.38, k.time() * 1.8);
		}
	});

	return chest;
}
