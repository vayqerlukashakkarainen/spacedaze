import { endSong } from "../web";
import type { Color, Vec2 } from "kaplay";
import { audioService } from "../services/audio/audioService";
import {
	spawnDecorativeWormhole,
	spawnLevel,
} from "../spawn/spawnLevel";
import { getScore, k, layers, mainSoundVolume, spendScore } from "../main";
import { Level } from "./levels";
import { spawnBackgroundObject } from "../spawn/spawnBackgroundObject";
import { getReddishBackgroundTint } from "../services/world/backgroundPaletteService";
import { spawnChest } from "../spawn/spawnChest";
import { playerObj, projectiles } from "../game";
import { tags } from "../tags";
import { interactable } from "../comp/interactable";
import {
	createNpcInteractionPrompt,
	UI_COLORS,
	UI_FONT_SIZES,
} from "../ui/common";
import {
	consumeHubGhostChest,
	getFacilityConstruction,
	getHubGhostChestCapacity,
	getHubGhostChestStock,
	getHubLevel,
	hasUnseenBlueprints,
	HUB_FACILITIES,
	HubFacilityDefinition,
	HubFacilityId,
	isFacilityBuilt,
	isFacilityUnlocked,
	startFacilityConstruction,
} from "../services/hub/hubProgressService";
import {
	showRunPreparation,
	showRunTerminal,
} from "../ui/hubFacilities";
import { saveGame } from "../util";
import { starsEmitter } from "../particles";
import { beginRunSession } from "../services/runs/runDirectorService";
import { getUnlockedWarpZones } from "../services/world/warpZoneService";
import { ASTEROID_SPRITES } from "../asteroidSprites";
import { phaseJumpActive } from "../setupPlayer";
import { tryBounceProjectile } from "../services/combat/projectileService";
import { applyDamage } from "../services/combat/damageService";
import { spawnGravityPull } from "../spawn/spawnGravityPull";
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService";
import { PLANET_CHUNK_SPRITES } from "../planetChunkSprites";
import {
	purchaseBurstParticleCount,
	spawnCurrencyBurst,
} from "../spawn/spawnCurrencyBurst";
import { showPendingRunEndSummary } from "../ui/runEndSummary";
import { spawnHubRestoration } from "../spawn/spawnHubRestoration";
import {
	consumePendingHubLevelReveal,
} from "../services/runs/runCompletionService";
import {
	playHubRestorationLevelReveal,
} from "../services/hub/hubRestorationCutsceneService";
import {
	HubRepairCrew,
	spawnHubRepairCrew,
} from "../spawn/npcs/spawnHubRepairCrew";
import { playRequirementErrorSound } from "../services/audio/uiSoundService";
import { gameSoundService } from "../services/audio/gameSoundService";
import { registerHubCameraInterest } from "../services/hub/hubCameraInterestService";
import { spawnHubAsteroidRunner } from "../spawn/npcs/spawnHubAsteroidRunner";
import { spawnHubRangeKeeper } from "../spawn/npcs/spawnHubRangeKeeper";
import { spawnHubBirthdayPair } from "../spawn/npcs/spawnHubBirthdayPair";
import { spawnHubLampKeeper } from "../spawn/npcs/spawnHubLampKeeper";
import { spawnHubBurt } from "../spawn/npcs/spawnHubBurt";
import { spawnHubArmorer } from "../spawn/npcs/spawnHubArmorer";
import { spawnHubQuartermaster } from "../spawn/npcs/spawnHubQuartermaster";
import { spawnHubRace } from "../spawn/npcs/spawnHubRace";
import { getHubBurtLocation } from "../services/narrative/narrativeService";
import { spawnHubSettlement } from "../spawn/spawnHubSettlement";
import { spawnHubFiringRange } from "../spawn/spawnHubFiringRange";
import { spawnHubPuzzleStamps } from "../spawn/spawnHubPuzzleYard"
import { addBuildingPlayerDepth } from "../comp/buildingPlayerDepth";
import {
	addLocalLight,
	updateLocalLight,
} from "../services/world/localLightService";
import {
	HUB_FACILITY_OFFSETS,
	HUB_FIRING_RANGE_OFFSET,
	HUB_HALF_HEIGHT,
	HUB_HALF_WIDTH,
	HUB_PHASE_FIELD_OFFSET,
	HUB_WORMHOLE_OFFSET,
} from "../services/hub/hubLayoutService";
import { restoreStrafeTrainingSequence } from "../services/hub/strafeTrainingService";
import { hasUndiscoveredAbilities } from "../services/abilities/abilityRegistry";

let lvlData: any = {};
let bgAsteroidTimer = 0;
let phaseFieldDamageCooldown = 0;
const hubHalfWidth = HUB_HALF_WIDTH;
const hubHalfHeight = HUB_HALF_HEIGHT;
const boundaryRevealRadius = 160;
const phaseFieldOffsetX = HUB_PHASE_FIELD_OFFSET[0];
const phaseFieldOffsetY = HUB_PHASE_FIELD_OFFSET[1];
const phaseFieldInnerRadius = 162;
const phaseFieldOuterRadius = 220;
const hubFacilityBuiltScales: Record<HubFacilityId, number> = {
	contractTerminal: 1,
	trainingRange: 1,
	salvageForge: 1,
	debriefTerminal: 1,
}
const hubFacilityDestroyedScales: Record<HubFacilityId, number> = {
	contractTerminal: 1,
	trainingRange: 1,
	salvageForge: 1,
	debriefTerminal: 1,
}
const hubFacilityInteractRadius = 120;
const hubFacilityLabelMargin = 28;
const ghostChestCosts = [15, 30, 50] as const;
const ghostWeaponChestCost = 30;
const hubFacilitySprites: Record<
	HubFacilityId,
	{ built: string; destroyed: string }
> = {
	contractTerminal: {
		built: "facility_contract_terminal_1bit",
		destroyed: "facility_contract_terminal_destroyed_1bit",
	},
	trainingRange: {
		built: "facility_training_range",
		destroyed: "facility_training_range_destroyed",
	},
	salvageForge: {
		built: "facility_salvage_forge_1bit",
		destroyed: "facility_salvage_forge_destroyed_1bit",
	},
	debriefTerminal: {
		built: "facility_debrief_terminal_1bit",
		destroyed: "facility_debrief_terminal_destroyed_1bit",
	},
};
export const hub: Level = {
	reset: () => {
		lvlData = {};
		bgAsteroidTimer = 0;
		phaseFieldDamageCooldown = 0;
		audioService.stopMusic();
		endSong();
	},
	onStart: () => {
		audioService.playMusic("hub", {
			volume: 1,
			loop: true,
			continueIfPlaying: true,
		});
		spawnHubBoundaries();
		const wormholePos = getHubWormholePosition();
		const wormhole = spawnLevel({
			pos: wormholePos,
			levelName: "level1",
			visual: "wormhole",
			label: "",
			onEnter: (_portal, selectLevel, cancel) => {
				const zone = getUnlockedWarpZones()[0];
				if (!zone) {
					cancel();
					return;
				}
				showRunPreparation({
					zone,
					onLaunch: () => {
						const firstFloor = beginRunSession(zone.id);
						if (!firstFloor) {
							cancel();
							return;
						}
						selectLevel(firstFloor.levelKey);
					},
					onCancel: cancel,
				});
			},
		});
		registerHubCameraInterest(wormhole, {
			radius: 420,
			strength: 0.34,
			priority: 1.1,
		});
		const hubCenterInterest = k.add([
			k.pos(k.center()),
			tags.gameLoop,
		]);
		registerHubCameraInterest(hubCenterInterest, {
			radius: 420,
			strength: 0.18,
			priority: 0.65,
		});
		const wormholeGravity = spawnGravityPull({
			pos: wormholePos,
			radius: 130,
			strength: 14,
			falloff: 1.35,
			visualizePull: true,
			targetTags: [
				tags.unit,
				tags.friendly,
				tags.enemy,
				tags.debree,
				tags.projectile,
			],
			tagStrengthMultipliers: {
				[tags.projectile]: 10,
			},
		});
		wormhole.onDestroy(() => {
			if (wormholeGravity.exists()) k.destroy(wormholeGravity);
		});
		spawnHubGhostChest(k.center().add(-60, 20));
		spawnHubGhostWeaponChest(k.center().add(80, 20));
		const hubFacilityPositions = getHubFacilityPositions();
		const repairCrew = spawnHubRepairCrew(hubFacilityPositions.trainingRange);
		spawnHubFacilities(hubFacilityPositions, repairCrew);
		const hubSession = lvlData;
		const firingRange = spawnHubFiringRange({
			pos: k.center().add(...HUB_FIRING_RANGE_OFFSET),
			isHubSessionActive: () => lvlData === hubSession,
		});
		spawnHubArmorer(
			k.center().add(...HUB_FIRING_RANGE_OFFSET).add(-280, -238),
			firingRange.primaryWeaponsPos
		);
		spawnHubSettlement();
		spawnHubPuzzleStamps(k.center())
		const burtHomePosition = hubFacilityPositions.trainingRange.add(-260, 40);
		const burtLocation = getHubBurtLocation();
		const burtInitialPosition = burtLocation === "center"
			? k.center().add(-104, 56)
			: burtLocation === "phaseStation"
				? hubFacilityPositions.trainingRange.add(-44, -150)
				: undefined;
		spawnHubBurt(burtHomePosition, { initialPosition: burtInitialPosition });
		restoreStrafeTrainingSequence();
		const pendingHubLevelReveal = consumePendingHubLevelReveal();
		const hubRestoration = spawnHubRestoration(
			k.center(),
			hubFacilityPositions.trainingRange,
			k.vec2(hubHalfWidth, hubHalfHeight),
			{
				initialLampLevel: pendingHubLevelReveal?.previousLevel,
			}
		);
		spawnHubLampKeeper(k.center());
		spawnHubBackgroundDepth();
		spawnPhaseShiftAsteroidField();
		spawnHubAsteroidRunner(getPhaseFieldCenter());
		spawnHubRangeKeeper(firingRange);
		spawnHubBirthdayPair(k.center().add(-150, 245));
		spawnHubQuartermaster(k.center().add(150, 245));
		spawnHubRace();
		saveGame("slot1");
		k.wait(0.45, () => {
			if (!pendingHubLevelReveal) {
				showPendingRunEndSummary();
				return;
			}
			void playHubRestorationLevelReveal(
				hubRestoration,
				pendingHubLevelReveal
			).finally(showPendingRunEndSummary);
		});
	},
	lvlUpd: () => {
		const center = k.center();
		playerObj.pos.x = k.clamp(
			playerObj.pos.x,
			center.x - hubHalfWidth,
			center.x + hubHalfWidth
		);
		playerObj.pos.y = k.clamp(
			playerObj.pos.y,
			center.y - hubHalfHeight,
			center.y + hubHalfHeight
		);
		phaseFieldDamageCooldown = Math.max(
			0,
			phaseFieldDamageCooldown - k.dt()
		);
		damagePlayerInPhaseField();

		// Keep an occasional distant asteroid moving through the hub backdrop.
		bgAsteroidTimer += k.dt();

		if (bgAsteroidTimer >= 6) {
			bgAsteroidTimer = 0;

			// Randomly choose spawn side and direction
			const side = k.rand(0, 4);
			let startPos: any;
			let endPos: any;

			if (side < 1) {
				// Spawn from left, move right
				startPos = k.vec2(-50, k.rand(0, k.height()));
				endPos = k.vec2(k.width() + 50, k.rand(0, k.height()));
			} else if (side < 2) {
				// Spawn from right, move left
				startPos = k.vec2(k.width() + 50, k.rand(0, k.height()));
				endPos = k.vec2(-50, k.rand(0, k.height()));
			} else if (side < 3) {
				// Spawn from top, move down
				startPos = k.vec2(k.rand(0, k.width()), -50);
				endPos = k.vec2(k.rand(0, k.width()), k.height() + 50);
			} else {
				// Spawn from bottom, move up
				startPos = k.vec2(k.rand(0, k.width()), k.height() + 50);
				endPos = k.vec2(k.rand(0, k.width()), -50);
			}

			spawnBackgroundObject({
				pos: startPos,
				moveTo: endPos,
				speed: k.rand(1, 2),
				sprite:
					ASTEROID_SPRITES[
						Math.floor(k.rand(0, ASTEROID_SPRITES.length))
					],
				scale: k.rand(0.5, 1.5),
				color: getReddishBackgroundTint(k.rand(28, 52)),
				parallaxLevel: k.rand(4, 10),
				rotation: k.rand(0, 360),
				rotationSpeed: k.chance(0.5) ? k.rand(-0.5, 0.5) : 0,
			});
		}
	},
};

function spawnHubGhostChest(pos: Vec2) {
	const stock = getHubGhostChestStock("salvage");
	if (stock <= 0) return;
	const purchaseIndex = getHubGhostChestCapacity("salvage") - stock;
	const cost = ghostChestCosts[purchaseIndex];
	if (cost === undefined) return;
	const chest = spawnChest(pos, 1, {
		ghostCost: cost,
		debreeBurstCount: 12 + Math.round(cost * 0.7),
		onPurchased: () => {
			consumeHubGhostChest("salvage");
			saveGame("slot1");
		},
		onRewardCollected: () => {
			if (chest.exists()) k.destroy(chest);
			spawnHubGhostChest(pos);
		},
	});
}

function spawnHubGhostWeaponChest(pos: Vec2) {
	if (!hasUndiscoveredAbilities()) return;
	if (getHubGhostChestStock("weapon") <= 0) return;
	spawnChest(pos, 1, {
		rewardType: "weapon",
		ghostCost: ghostWeaponChestCost,
		debreeBurstCount: 12 + Math.round(ghostWeaponChestCost * 0.7),
		onPurchased: () => {
			consumeHubGhostChest("weapon");
			saveGame("slot1");
		},
	});
}

function spawnHubBackgroundDepth() {
	const center = k.center();
	spawnBackgroundObject({
		pos: center,
		sprite: "bg_destroyed_planet",
		scale: 1.76,
		color: k.rgb(16, 24, 32),
		parallaxLevel: 36,
		rotation: -8,
		rotationSpeed: 0,
	});

	const planetChunks = [
		[-620, -270, 7, 0.62, -18, 24, -0.025],
		[650, -230, 5, 0.52, 24, 19, 0.035],
		[-680, 280, 6, 0.48, 16, 17, 0.03],
		[660, 300, 4, 0.6, -32, 21, -0.02],
	] as const;
	for (const [x, y, spriteIndex, scale, rotation, parallaxLevel, rotationSpeed]
		of planetChunks) {
		spawnBackgroundObject({
			pos: center.add(x, y),
			sprite: PLANET_CHUNK_SPRITES[spriteIndex],
			scale,
			color: getReddishBackgroundTint(24),
			parallaxLevel,
			rotation,
			rotationSpeed,
		});
	}

	const asteroidCount = 10;
	for (let index = 0; index < asteroidCount; index++) {
		const angle = (360 / asteroidCount) * index + k.rand(-8, 8);
		const distance = 205 + (index % 4) * 78 + k.rand(-22, 22);
		spawnBackgroundObject({
			pos: center.add(k.Vec2.fromAngle(angle).scale(distance)),
			sprite:
				ASTEROID_SPRITES[
					Math.floor(k.rand(0, ASTEROID_SPRITES.length))
				],
			scale: k.rand(0.45, 1.25),
			color: getReddishBackgroundTint(k.rand(27, 46)),
			parallaxLevel: k.rand(6, 14),
			rotation: k.rand(0, 360),
			rotationSpeed: k.chance(0.45) ? k.rand(-0.9, 0.9) : 0,
		});
	}
}

function spawnPhaseShiftAsteroidField() {
	const fieldCenter = getPhaseFieldCenter();
	spawnDecorativeWormhole({
		pos: fieldCenter,
		color: k.rgb(166, 108, 112),
		scale: 0.92,
		tags: [tags.hubPhaseField],
	});
	const asteroids: PhaseFieldAsteroid[] = [];
	spawnAsteroidRing(177, 46, 0, asteroids);
	spawnAsteroidRing(207, 54, 0.5, asteroids);
	const collisionInnerRadius = 150;
	const collisionOuterRadius = 235;
	const controller = k.add([
		k.pos(fieldCenter),
		k.layer(layers.bg),
		k.z(2),
		{
			draw() {
				const camera = k.getCamPos();
				const cameraScale = k.getCamScale();
				const halfWidth = k.width() / (2 * cameraScale.x) + 48;
				const halfHeight = k.height() / (2 * cameraScale.y) + 48;
				const minX = camera.x - halfWidth;
				const maxX = camera.x + halfWidth;
				const minY = camera.y - halfHeight;
				const maxY = camera.y + halfHeight;
				for (const asteroid of asteroids) {
					const worldX = fieldCenter.x + asteroid.offset.x;
					const worldY = fieldCenter.y + asteroid.offset.y;
					const visualRadius = 24 * asteroid.scale;
					if (
						worldX + visualRadius < minX ||
						worldX - visualRadius > maxX ||
						worldY + visualRadius < minY ||
						worldY - visualRadius > maxY
					) continue;
					k.drawSprite({
						sprite: asteroid.sprite,
						pos: asteroid.offset,
						anchor: "center",
						angle: asteroid.angle,
						scale: k.vec2(asteroid.scale),
						color: asteroid.color,
					});
				}
			},
		},
		tags.hubPhaseField,
		tags.props,
		tags.gameLoop,
	]);

	registerBatchedEntityUpdate("world", controller, () => {
		for (const asteroid of asteroids) {
			asteroid.angle += asteroid.rotationSpeed * k.dt();
		}

		for (const projectile of projectiles) {
			if (
				!projectile.exists() ||
				projectile.is(tags.stressProjectile) ||
				!projectile.tags.includes(tags.friendly)
			) continue;
			const fieldDistance = projectile.pos.dist(fieldCenter);
			if (
				fieldDistance < collisionInnerRadius ||
				fieldDistance > collisionOuterRadius
			) continue;

			for (const asteroid of asteroids) {
				const asteroidPos = fieldCenter.add(asteroid.offset);
				if (
					projectile.pos.dist(asteroidPos) >= asteroid.hitRadius
				) continue;
				const normal = projectile.pos.sub(asteroidPos);
				if (!tryBounceProjectile(
					projectile,
					undefined,
					normal.len() > 0 ? normal.unit() : undefined
				)) {
					k.destroy(projectile);
				}
				break;
			}
		}
	});
}

interface PhaseFieldAsteroid {
	offset: Vec2;
	sprite: string;
	angle: number;
	scale: number;
	color: Color;
	hitRadius: number;
	rotationSpeed: number;
}

function spawnAsteroidRing(
	radius: number,
	count: number,
	angleOffset: number,
	asteroids: PhaseFieldAsteroid[]
) {
	for (let index = 0; index < count; index++) {
		const angle = ((index + angleOffset) / count) * 360;
		const radialJitter = k.rand(-5, 5);
		const asteroidScale = k.rand(1.35, 1.9);
		const shade = k.rand(220, 256);
		asteroids.push({
			offset: k.Vec2.fromAngle(angle).scale(radius + radialJitter),
			sprite:
				ASTEROID_SPRITES[
					Math.floor(k.rand(0, ASTEROID_SPRITES.length))
				],
			angle: k.rand(0, 360),
			scale: asteroidScale,
			color: k.rgb(shade, shade, shade),
			hitRadius: 8 * asteroidScale,
			rotationSpeed: k.chance(0.65) ? k.rand(-5, 5) : 0,
		});
	}
}

function damagePlayerInPhaseField() {
	if (phaseJumpActive()) return;
	if (phaseFieldDamageCooldown > 0) return;

	const fieldCenter = getPhaseFieldCenter();
	const offset = playerObj.pos.sub(fieldCenter);
	const distance = offset.len();
	if (
		distance <= phaseFieldInnerRadius ||
		distance >= phaseFieldOuterRadius
	) return;

	phaseFieldDamageCooldown = 0.3;
	applyDamage(playerObj, 99, {
		source: {
			name: "PHASE-FIELD ASTEROID",
			sprite: ASTEROID_SPRITES[0],
		},
	});
}

function getPhaseFieldCenter() {
	return k.center().add(phaseFieldOffsetX, phaseFieldOffsetY);
}

export function getHubFacilityPositions() {
	const center = k.center();
	return {
		contractTerminal: center.add(...HUB_FACILITY_OFFSETS.contractTerminal),
		trainingRange: center.add(...HUB_FACILITY_OFFSETS.trainingRange),
		salvageForge: center.add(...HUB_FACILITY_OFFSETS.salvageForge),
		debriefTerminal: center.add(...HUB_FACILITY_OFFSETS.debriefTerminal),
	} satisfies Record<HubFacilityId, ReturnType<typeof k.vec2>>;
}

export function getHubWormholePosition() {
	return k.center().add(...HUB_WORMHOLE_OFFSET);
}

function spawnHubFacilities(
	positions: Record<HubFacilityId, ReturnType<typeof k.vec2>>,
	repairCrew: HubRepairCrew
) {
	for (const facility of HUB_FACILITIES) {
		if (facility.id === "trainingRange") continue;
		spawnHubFacility(facility, positions[facility.id], repairCrew);
	}
}

function spawnHubFacility(
	facility: HubFacilityDefinition,
	pos: ReturnType<typeof k.vec2>,
	repairCrew: HubRepairCrew
) {
	let built = isFacilityBuilt(facility.id);
	const unlocked = () => isFacilityUnlocked(facility.id);
	const sprites = hubFacilitySprites[facility.id];
	const building = k.add([
		k.pos(pos),
		interactable(hubFacilityInteractRadius, () => {
			if (!built) {
				const activeConstruction = getFacilityConstruction();
				if (activeConstruction || !unlocked() || getScore() < facility.cost) {
					playRequirementErrorSound();
					return;
				}
				if (!startFacilityConstruction(facility.id)) return;
				if (!spendScore(facility.cost)) {
					playRequirementErrorSound();
					return;
				}
				if (facility.cost > 0) {
					spawnCurrencyBurst(building.pos.clone(), {
						particleCount: purchaseBurstParticleCount(facility.cost),
					});
				}
				saveGame("slot1");
				repairCrew.setRepairTarget(building.pos);
				return;
			}
			openHubFacility(facility.id);
		}),
		tags.gameLoop,
		tags.props,
	]);
	registerHubCameraInterest(building, {
		radius: 360,
		strength: 0.3,
	});
	const buildingVisual = building.add([
		k.pos(0, 0),
		k.sprite(built ? sprites.built : sprites.destroyed),
		k.anchor("center"),
		k.layer(layers.game),
		k.scale(getHubFacilityVisualScale(facility.id, built)),
		k.color(getHubFacilityVisualColor(facility.id, built)),
		k.opacity(1),
	]);
	const facilityPromptOffset = k.vec2();
	const updateFacilityPromptOffset = () => {
		const renderedHalfHeight = buildingVisual.height
			* Math.abs(buildingVisual.scale.y)
			* k.getCamScale().y
			/ 2;
		facilityPromptOffset.y = -(renderedHalfHeight + hubFacilityLabelMargin);
	};
	updateFacilityPromptOffset();
	let constructionSmoke: ReturnType<typeof spawnFacilityConstructionSmoke> | undefined;
	let constructionSmokeTimer = 0;
	const ensureConstructionSmoke = () => {
		if (constructionSmoke?.exists()) return constructionSmoke;
		constructionSmoke = spawnFacilityConstructionSmoke(building.pos);
		return constructionSmoke;
	};
	let phaseStationRingLight: ReturnType<typeof addLocalLight> | undefined;
	const addPhaseStationRingGlow = () => {
		if (facility.id !== "trainingRange" || phaseStationRingLight) return;
		const ringCenter = k.vec2(-37, 15);
		phaseStationRingLight = addLocalLight(buildingVisual, {
			size: 84,
			color: [90, 210, 255],
			opacity: 0.82,
			pulse: {
				scaleMin: 0.92,
				scaleMax: 1.18,
				scaleSpeed: 3.4,
				opacityMin: 0.72,
				opacityMax: 1,
				opacitySpeed: 2.8,
			},
		});
		phaseStationRingLight.object.pos = ringCenter;
	};
	if (built) addPhaseStationRingGlow();
	addBuildingPlayerDepth(buildingVisual, {
		centerY: () => building.pos.y + buildingVisual.pos.y,
		renderedHeight: () =>
			buildingVisual.height * Math.abs(buildingVisual.scale.y),
	})
	const newInfoMarker = facility.id === "trainingRange"
		? building.add([
			k.text("!", { size: UI_FONT_SIZES.display, font: "unscii" }),
			k.pos(0, -150),
			k.anchor("center"),
			k.color(...UI_COLORS.warning),
			k.opacity(1),
			k.layer(layers.gameText),
			k.z(210),
		])
		: undefined;
	if (newInfoMarker) {
		newInfoMarker.hidden = !built || !hasUnseenBlueprints();
	}
	if (getFacilityConstruction()?.facilityId === facility.id) {
		repairCrew.setRepairTarget(pos);
		ensureConstructionSmoke();
	}
	const finishBuilding = () => {
		if (built) return;
		built = true;
		buildingVisual.use(k.sprite(sprites.built));
		buildingVisual.scale = k.vec2(getHubFacilityVisualScale(facility.id, true));
		buildingVisual.color = getHubFacilityVisualColor(facility.id, true);
		buildingVisual.opacity = 1;
		repairCrew.setRepairTarget(undefined);
		if (constructionSmoke?.exists()) {
			const completedSmoke = constructionSmoke;
			constructionSmoke = undefined;
			k.wait(1.7, () => {
				if (completedSmoke.exists()) k.destroy(completedSmoke);
			});
		}
		starsEmitter.emitter.position = building.pos;
		starsEmitter.emit(28);
		gameSoundService.play("run_level_up", {
			volume: mainSoundVolume * 0.85,
		});
		k.shake(7);
		if (facility.id === "trainingRange") {
			addPhaseStationRingGlow();
		}
		saveGame("slot1");
	};
	const prompt = createNpcInteractionPrompt({
		target: building,
		offset: facilityPromptOffset,
		label: () => {
			if (built) return { text: `OPEN ${facility.name}` }
			if (getFacilityConstruction()?.facilityId === facility.id) {
				return {
					text: "DRONES REPAIRING",
					color: k.rgb(...UI_COLORS.muted),
				}
			}
			if (getFacilityConstruction()) {
				return {
					text: "REPAIR CREW BUSY",
					color: k.rgb(...UI_COLORS.danger),
				}
			}
			if (!unlocked()) {
				return {
					text: `LOCKED: HUB LEVEL ${facility.requiredHubLevel}`,
					color: k.rgb(...UI_COLORS.danger),
				}
			}
			return {
				text: facility.cost === 0
					? `BUILD ${facility.name}`
					: `BUILD FOR ${facility.cost} SALVAGE`,
				color: getScore() >= facility.cost
					? k.rgb(...UI_COLORS.text)
					: k.rgb(...UI_COLORS.danger),
			}
		},
	});

	registerBatchedEntityUpdate("world", building, () => {
		updateFacilityPromptOffset();
		const construction = getFacilityConstruction();
		if (!built && isFacilityBuilt(facility.id)) finishBuilding();
		if (!built && construction?.facilityId === facility.id) {
			const repairPulse = k.wave(96, 132, k.time() * 5);
			buildingVisual.color = k.rgb(repairPulse, repairPulse + 10, repairPulse + 20);
			const smoke = ensureConstructionSmoke();
			constructionSmokeTimer -= k.dt();
			if (constructionSmokeTimer <= 0) {
				smoke.emitter.position = k.vec2(
					k.rand(-96, 96),
					k.rand(-42, 38)
				);
				smoke.emit(4);
				constructionSmokeTimer = k.rand(0.055, 0.09);
			}
		}
		if (newInfoMarker) {
			const visible = built && hasUnseenBlueprints();
			newInfoMarker.hidden = !visible;
			if (visible) {
				newInfoMarker.pos.y = -150 + Math.sin(k.time() * 3.2) * 4;
				newInfoMarker.opacity = k.wave(0.55, 1, k.time() * 5);
			}
		}
		if (phaseStationRingLight) updateLocalLight(phaseStationRingLight);
		prompt.update(building.isInRange);
	});
}

function spawnFacilityConstructionSmoke(pos: Vec2) {
	return k.add([
		k.pos(pos.clone()),
		k.particles(
			{
				max: 150,
				speed: [8, 26],
				acceleration: [k.vec2(-5, -20), k.vec2(5, -42)],
				angle: [0, 360],
				lifeTime: [0.9, 1.65],
				colors: [k.rgb(190, 200, 205), k.rgb(62, 72, 80)],
				opacities: [0, 0.78, 0.62, 0],
				scales: [1.4, 3.4, 5.6],
				angularVelocity: [-75, 75],
				texture: k.getSprite("particle3")!.data!.frames[0].tex,
				quads: [k.getSprite("particle3")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 100,
				position: k.vec2(),
			}
		),
		k.layer(layers.gameEffects),
		k.z(0),
		tags.props,
		tags.gameLoop,
	]);
}

function getHubFacilityVisualScale(id: HubFacilityId, built: boolean) {
	if (built) return hubFacilityBuiltScales[id]
	return hubFacilityDestroyedScales[id]
}

function getHubFacilityVisualColor(id: HubFacilityId, built: boolean) {
	if (!built) return k.rgb(100, 110, 120)
	if (id === "trainingRange") return k.rgb(200, 208, 213)
	return k.rgb(145, 160, 170)
}

function openHubFacility(id: HubFacilityId) {
	if (id === "contractTerminal") showRunTerminal("contracts");
	if (id === "salvageForge") showRunTerminal("forge");
	if (id === "debriefTerminal") showRunTerminal("debrief");
}

function spawnHubBoundaries() {
	const center = k.center();
	const minX = center.x - hubHalfWidth;
	const maxX = center.x + hubHalfWidth;
	const minY = center.y - hubHalfHeight;
	const maxY = center.y + hubHalfHeight;
	const edgeThickness = 5;

	const edges = [
		{
			pos: k.vec2(minX, center.y),
			size: k.vec2(edgeThickness, hubHalfHeight * 2),
		},
		{
			pos: k.vec2(maxX, center.y),
			size: k.vec2(edgeThickness, hubHalfHeight * 2),
		},
		{
			pos: k.vec2(center.x, minY),
			size: k.vec2(hubHalfWidth * 2, edgeThickness),
		},
		{
			pos: k.vec2(center.x, maxY),
			size: k.vec2(hubHalfWidth * 2, edgeThickness),
		},
	];

	for (const edge of edges) {
		k.add([
			k.rect(edge.size.x, edge.size.y),
			k.pos(edge.pos),
			k.anchor("center"),
			k.color(k.WHITE),
			k.shader("hubBoundaryFade", () => ({
				u_time: k.time(),
				u_playerPos: playerObj.pos,
				u_revealRadius: boundaryRevealRadius,
			})),
			tags.runtimeCullable,
			tags.hubBoundary,
			tags.props,
		]);
	}
}
