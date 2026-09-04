import {
	AnimateComp,
	Color,
	GameObj,
	OpacityComp,
	RectComp,
	Vec2,
} from "kaplay";
import { getScore, k, layers } from "../main";
import {
	getRewardDefinition,
	isAbilityReward,
	Reward,
	REWARD_RARITY_COLORS,
} from "../services/rewardService";
import { tags } from "../tags";
import { uiState } from "./uiState";
import { recordRunReward } from "../services/runInventoryService";
import { discoverBlueprint } from "../services/hubProgressService";
import { recordRunReward as recordRunRewardStat } from "../services/runStatsService";
import {
	showCollectedRewardPopover,
	showDiscoveredRewardPopover,
} from "../services/popoverService";
import { createUiPanel } from "./common/panel";
import { createUiDetailCard } from "./common/detailCard";
import { UI_COLORS, UI_FONT_SIZES } from "./common/theme";
import { registerBatchedUiUpdate } from "../services/uiUpdateService";
import { uiHitRegion } from "./common/hitRegion";
import { getRerollTokens } from "../player";
import type { ActiveModuleDefinition } from "../services/activeModuleService";
import { getEquippedWeapon } from "../services/weaponService";
import { debreeRunActive } from "../services/debreeEconomyService";
import type { AbilityDefinition } from "../services/abilityRegistry";
import { getAbilityDefinition } from "../services/abilityRegistry";
import {
	getEquippedMobilityAbilityId,
} from "../services/abilityLoadoutService";

let healthBars: GameObj<OpacityComp>[] = [];
let specialBar: GameObj<RectComp> | null = null;
let missileCooldownGroup: GameObj | null = null;
let activeModuleIcon: GameObj | null = null;
let primaryWeaponIcon: GameObj | null = null;
let secondaryWarning: GameObj<OpacityComp> | null = null;
let secondaryEmptyRing: GameObj<OpacityComp> | null = null;
let phaseJumpIcon: GameObj | null = null;
let phaseJumpSegments: GameObj<OpacityComp>[] = [];
let phaseJumpChargeLabel: GameObj | null = null;
let mobilityNameLabel: GameObj | null = null;
let mobilityWarning: GameObj<OpacityComp> | null = null;
let ultimateIcon: GameObj | null = null;
let ultimateEmptyRing: GameObj<OpacityComp> | null = null;
let ultimateBar: GameObj<RectComp> | null = null;
let ultimateWarning: GameObj<OpacityComp> | null = null;
let shipStatusPanel: GameObj | null = null;
let salvageDisplay: GameObj | null = null;
let rerollDisplay: GameObj | null = null;
let systemsPanel: GameObj | null = null;
let runLoadoutPanel: GameObj | null = null;
let loadoutIconsContainer: GameObj | null = null;
const collectedItems = new Map<
	string,
	{
		count: number;
		countLabel: GameObj;
		reward: Reward;
		tile: GameObj;
		icon: GameObj;
	}
>();

const rewardTooltipTag = "rewardTooltip";

const statusPanelWidth = 228;
const statusPanelHeight = 30;
const systemsPanelWidth = 286;
const systemsPanelHeight = 32;
const abilityBarWidth = 100;
const weaponSocketSize = 28;
const weaponSocketGap = 14;
const secondaryCooldownWidth = 24;
const ultimateBarWidth = 24;
const upgradeTileSize = 28;
const upgradeTileGap = 6;
const phaseJumpSegmentCount = 10;
const HUD_SCALE = 1.5;
const HUD_MARGIN = 12;
const SALVAGE_GAIN_LIFETIME = 0.7;
let displayedSalvage = Number.NaN;
let displayedDebreeMode = "";
let displayedRerollTokens = Number.NaN;
let displayedSpecialWidth = Number.NaN;
let displayedMissileVisibility: boolean | undefined;
let displayedActiveModuleId = "";
let displayedPrimaryWeaponId = "";
let emptySecondaryFlashRemaining = 0;
let emptyMobilityFlashRemaining = 0;
let emptyUltimateFlashRemaining = 0;
let displayedJumpCharges = Number.NaN;
let displayedJumpMaxCharges = Number.NaN;
let displayedJumpProgress = Number.NaN;
let displayedMobilityId = "";
let displayedUltimateId = "";
let displayedUltimateProgress = Number.NaN;
export function setupGameLoopUi(health: number, missilesUnlocked = false) {
	shipStatusPanel = createUiPanel({
		pos: k.vec2(
			HUD_MARGIN,
			k.height() - statusPanelHeight * HUD_SCALE - HUD_MARGIN
		),
		size: k.vec2(statusPanelWidth, statusPanelHeight),
		tags: [tags.gameLoopUi],
		frameless: true,
		scale: HUD_SCALE,
	});
	shipStatusPanel.add([
		k.pos(116, 5),
		k.rect(1, 20),
		k.color(...UI_COLORS.border),
	]);
	shipStatusPanel.add([
		k.pos(180, 5),
		k.rect(1, 20),
		k.color(...UI_COLORS.border),
	]);
	salvageDisplay = shipStatusPanel.add([
		k.pos(172, 15),
		k.scale(1),
		{
			pulseScale: 1,
		},
	]);
	const salvageIcon = salvageDisplay.add([
		k.sprite("debree_part1", { width: 18, height: 18 }),
		k.pos(-33, 0),
		k.anchor("center"),
		k.color(...UI_COLORS.accent),
	]);
	const salvageLabel = salvageDisplay.add([
		k.text("", { size: UI_FONT_SIZES.small, font: "unscii" }),
		k.pos(0, 0),
		k.anchor("right"),
		k.color(...UI_COLORS.accent),
	]);
	const salvageModeLabel = salvageDisplay.add([
		k.text("", { size: UI_FONT_SIZES.micro, font: "unscii" }),
		k.pos(0, -10),
		k.anchor("right"),
		k.color(...UI_COLORS.muted),
	]);
	rerollDisplay = shipStatusPanel.add([
		k.pos(statusPanelWidth - 5, 15),
		k.scale(1),
		{
			pulseScale: 1,
		},
	]);
	const rerollIcon = rerollDisplay.add([
		k.sprite("reroll_token", { width: 16, height: 16 }),
		k.pos(-26, 0),
		k.anchor("center"),
		k.color(190, 75, 255),
	]);
	const rerollLabel = rerollDisplay.add([
		k.text("", { size: UI_FONT_SIZES.small, font: "unscii" }),
		k.pos(0, 0),
		k.anchor("right"),
		k.color(190, 75, 255),
	]);
	registerBatchedUiUpdate("hud", salvageDisplay, () => {
		const score = getScore();
		const debreeMode = debreeRunActive() ? "CARRIED" : "";
		if (debreeMode !== displayedDebreeMode) {
			displayedDebreeMode = debreeMode;
			salvageModeLabel.text = debreeMode;
		}
		if (score !== displayedSalvage) {
			displayedSalvage = score;
			salvageLabel.text = `${score}`;
			salvageIcon.pos.x = salvageLabel.pos.x - salvageLabel.width - 12;
		}
		salvageDisplay!.pulseScale = k.lerp(
			salvageDisplay!.pulseScale,
			1,
			k.clamp(14 * k.dt(), 0, 1)
		);
		salvageDisplay!.scale = k.vec2(salvageDisplay!.pulseScale);

		const rerollTokens = getRerollTokens();
		if (rerollTokens !== displayedRerollTokens) {
			if (!Number.isNaN(displayedRerollTokens)) {
				rerollDisplay!.pulseScale = Math.min(
					1.45,
					rerollDisplay!.pulseScale + 0.3
				);
			}
			displayedRerollTokens = rerollTokens;
			rerollLabel.text = `${rerollTokens}`;
			rerollIcon.pos.x = rerollLabel.pos.x - rerollLabel.width - 11;
		}
		rerollDisplay!.pulseScale = k.lerp(
			rerollDisplay!.pulseScale,
			1,
			k.clamp(14 * k.dt(), 0, 1)
		);
		rerollDisplay!.scale = k.vec2(rerollDisplay!.pulseScale);
	});

	systemsPanel = createUiPanel({
		pos: k.vec2(
			k.width() - systemsPanelWidth * HUD_SCALE - HUD_MARGIN,
			k.height() - systemsPanelHeight * HUD_SCALE - HUD_MARGIN
		),
		size: k.vec2(systemsPanelWidth, systemsPanelHeight),
		tags: [tags.gameLoopUi],
		frameless: true,
		scale: HUD_SCALE,
	});
	primaryWeaponIcon = systemsPanel.add([
		k.sprite(getEquippedWeapon().icon, { width: 20, height: 20 }),
		k.pos(weaponSocketSize / 2, weaponSocketSize / 2),
		k.anchor("center"),
	]);
	systemsPanel.add([
		k.pos(34, 4),
		k.rect(1, 22),
		k.color(...UI_COLORS.border),
	]);
	missileCooldownGroup = systemsPanel.add([
		k.pos(weaponSocketSize + weaponSocketGap, 0),
	]);
	secondaryEmptyRing = missileCooldownGroup.add([
		k.pos(weaponSocketSize / 2, weaponSocketSize / 2 - 1),
		k.circle(9),
		k.anchor("center"),
		k.color(...UI_COLORS.muted),
		k.opacity(missilesUnlocked ? 0 : 0.18),
		k.outline(1, k.rgb(...UI_COLORS.muted)),
	]);
	activeModuleIcon = missileCooldownGroup.add([
		k.sprite("rocket_upg1", { width: 20, height: 20 }),
		k.pos(weaponSocketSize / 2, weaponSocketSize / 2 - 2),
		k.anchor("center"),
		k.opacity(missilesUnlocked ? 1 : 0),
	]);
	missileCooldownGroup.add([
		k.pos(2, weaponSocketSize - 3),
		k.rect(secondaryCooldownWidth, 3),
		k.color(...UI_COLORS.muted),
	]);
	specialBar = missileCooldownGroup.add([
		k.pos(2, weaponSocketSize - 3),
		k.rect(secondaryCooldownWidth, 3),
		k.color(...UI_COLORS.accent),
	]);
	secondaryWarning = missileCooldownGroup.add([
		k.pos(0, 0),
		k.rect(weaponSocketSize, weaponSocketSize),
		k.color(...UI_COLORS.danger),
		k.opacity(0),
	]);
	systemsPanel.add([
		k.pos(76, 4),
		k.rect(1, 22),
		k.color(...UI_COLORS.border),
	]);
	registerBatchedUiUpdate("hud", systemsPanel, () => {
		emptySecondaryFlashRemaining = updateEmptySlotWarning(
			secondaryWarning,
			emptySecondaryFlashRemaining
		);
		emptyMobilityFlashRemaining = updateEmptySlotWarning(
			mobilityWarning,
			emptyMobilityFlashRemaining
		);
		emptyUltimateFlashRemaining = updateEmptySlotWarning(
			ultimateWarning,
			emptyUltimateFlashRemaining
		);
	});

	runLoadoutPanel = createUiPanel({
		pos: k.vec2(
			HUD_MARGIN,
			k.height() - statusPanelHeight * HUD_SCALE - HUD_MARGIN * 2 -
				upgradeTileSize * HUD_SCALE
		),
		size: k.vec2(k.width() - HUD_MARGIN * 2, upgradeTileSize * HUD_SCALE),
		tags: [tags.gameLoopUi],
		frameless: true,
	});
	loadoutIconsContainer = runLoadoutPanel.add([k.pos(0, 0)]);

	for (let i = 0; i < health; i++) {
		addHealthBar(i);
	}
}

export function showSalvageGain(
	amount: number,
	color: Color = k.rgb(...UI_COLORS.accent),
	pos: Vec2 = k.center()
) {
	if (!Number.isFinite(amount) || amount <= 0) return;
	if (salvageDisplay?.exists()) {
		salvageDisplay.pulseScale = Math.min(
			1.6,
			salvageDisplay.pulseScale + 0.32
		);
	}

	const gain = k.add([
		k.text(`+${amount}`, { size: UI_FONT_SIZES.tiny, font: "unscii" }),
		k.pos(pos.add(k.rand(-7, 7), k.rand(-25, -19))),
		k.anchor("center"),
		k.color(color),
		k.opacity(1),
		k.scale(1.35),
		k.z(100),
		k.layer(layers.gameText),
		{
			elapsed: 0,
			startY: 0,
		},
		tags.gameLoop,
	]);
	gain.startY = gain.pos.y;

	registerBatchedUiUpdate("overlay", gain, () => {
		gain.elapsed += k.dt();
		const progress = k.clamp(gain.elapsed / SALVAGE_GAIN_LIFETIME, 0, 1);
		const rise = 1 - Math.pow(1 - progress, 3);
		gain.pos.y = gain.startY - rise * 24;
		gain.opacity = 1 - progress * progress;
		const popScale = progress < 0.18
			? k.lerp(1.35, 1.65, progress / 0.18)
			: k.lerp(1.65, 0.85, (progress - 0.18) / 0.82);
		gain.scale = k.vec2(popScale);

		if (progress >= 1) k.destroy(gain);
	});
}

export function addHealthBar(healthValue: number) {
	if (!shipStatusPanel) return;
	const pipWidth = 8;
	const pipGap = 3;
	const c = shipStatusPanel.add([
		k.pos(0 + healthValue * (pipWidth + pipGap), 11),
		k.rect(pipWidth, 8),
		k.color(k.WHITE),
		k.opacity(1),
	]);

	healthBars.push(c);
}

export function updatePlayerHealthBar(currentHealth: number) {
	for (let i = 0; i < healthBars.length; i++) {
		if (i < currentHealth) {
			healthBars[i].opacity = 1;
			continue;
		}
		healthBars[i].opacity = 0.2;
	}
}

export function syncPlayerHealthBarCapacity(maxHealth: number) {
	while (healthBars.length > maxHealth) {
		const bar = healthBars.pop();
		if (bar) k.destroy(bar);
	}
	while (healthBars.length < maxHealth) {
		addHealthBar(healthBars.length);
	}
}

export function updateSpecialBar(
	current: number,
	max: number,
	module?: ActiveModuleDefinition
) {
	const weapon = getEquippedWeapon();
	if (weapon.id !== displayedPrimaryWeaponId) {
		displayedPrimaryWeaponId = weapon.id;
		if (primaryWeaponIcon) primaryWeaponIcon.sprite = weapon.icon;
	}
	const moduleAvailable = module !== undefined;
	if (missileCooldownGroup && displayedMissileVisibility !== moduleAvailable) {
		displayedMissileVisibility = moduleAvailable;
		if (activeModuleIcon) activeModuleIcon.opacity = moduleAvailable ? 1 : 0;
		if (secondaryEmptyRing) secondaryEmptyRing.opacity = moduleAvailable ? 0 : 0.18;
	}
	if (module && displayedActiveModuleId !== module.id) {
		displayedActiveModuleId = module.id;
		if (activeModuleIcon) activeModuleIcon.sprite = module.icon;
	}
	if (!specialBar) return;
	const width = moduleAvailable
		? secondaryCooldownWidth * k.clamp(current / max, 0, 1)
		: 0;
	if (Math.abs(width - displayedSpecialWidth) < 0.05) return;
	displayedSpecialWidth = width;
	specialBar.width = width;
}

export function flashEmptySecondarySocket() {
	emptySecondaryFlashRemaining = 0.42;
}

export function flashEmptyMobilitySocket() {
	emptyMobilityFlashRemaining = 0.42;
}

export function flashEmptyUltimateSocket() {
	emptyUltimateFlashRemaining = 0.42;
}

function updateEmptySlotWarning(
	warning: GameObj<OpacityComp> | null,
	remaining: number
) {
	if (!warning) return remaining;
	if (remaining <= 0) {
		warning.opacity = 0;
		return 0;
	}
	const nextRemaining = Math.max(0, remaining - k.dt());
	const envelope = nextRemaining / 0.42;
	warning.opacity = k.wave(0.08, 0.34, k.time() * 26) * envelope;
	return nextRemaining;
}

export function updatePhaseJumpUi(
	charges: number,
	maxCharges: number,
	rechargeProgress: number
) {
	const mobilityId = getEquippedMobilityAbilityId();
	const mobility = mobilityId ? getAbilityDefinition(mobilityId) : undefined;
	if (!phaseJumpIcon && systemsPanel) {
		phaseJumpIcon = systemsPanel.add([
			k.sprite(mobility?.icon ?? "space_jump_upg1", { width: 16, height: 16 }),
			k.pos(88, 15),
			k.anchor("center"),
			k.opacity(1),
		]);

		mobilityNameLabel = systemsPanel.add([
			k.text(mobility?.name ?? "EMPTY MOBILITY", {
				size: UI_FONT_SIZES.tiny,
				font: "unscii",
			}),
			k.pos(101, 1),
			k.color(k.WHITE),
		]);

		const segmentGap = 2;
		const segmentWidth =
			(abilityBarWidth - segmentGap * (phaseJumpSegmentCount - 1)) /
			phaseJumpSegmentCount;
		for (let index = 0; index < phaseJumpSegmentCount; index++) {
			phaseJumpSegments.push(systemsPanel.add([
				k.pos(101 + index * (segmentWidth + segmentGap), 19),
				k.rect(segmentWidth, 7),
				k.color(...UI_COLORS.accent),
				k.opacity(0.22),
			]));
		}

		phaseJumpChargeLabel = systemsPanel.add([
			k.text("", { size: UI_FONT_SIZES.tiny, font: "unscii" }),
			k.pos(240, 18),
			k.anchor("right"),
			k.color(k.WHITE),
		]);
		mobilityWarning = systemsPanel.add([
			k.pos(79, 0),
			k.rect(166, weaponSocketSize),
			k.color(...UI_COLORS.danger),
			k.opacity(0),
			k.z(20),
		]);
	}
	if (mobilityId !== displayedMobilityId) {
		displayedMobilityId = mobilityId ?? "";
		if (phaseJumpIcon && mobility) phaseJumpIcon.sprite = mobility.icon;
		if (mobilityNameLabel) {
			mobilityNameLabel.text = mobility?.name ?? "EMPTY MOBILITY";
		}
	}

	if (
		charges === displayedJumpCharges &&
		maxCharges === displayedJumpMaxCharges &&
		Math.abs(rechargeProgress - displayedJumpProgress) < 0.001
	) return;
	displayedJumpCharges = charges;
	displayedJumpMaxCharges = maxCharges;
	displayedJumpProgress = rechargeProgress;
	phaseJumpIcon.opacity = mobility ? charges > 0 ? 1 : 0.25 : 0.18;
	const filledSegments = rechargeProgress * phaseJumpSegmentCount;
	for (let index = 0; index < phaseJumpSegments.length; index++) {
		phaseJumpSegments[index].opacity = index < filledSegments ? 1 : 0.22;
	}
	if (phaseJumpChargeLabel) {
		phaseJumpChargeLabel.text = mobilityId === "thrusterOverdrive"
			? "READY"
			: mobility ? `${charges}/${maxCharges}` : "EMPTY";
	}
}

export function updateUltimateUi(
	progress: number,
	ability?: AbilityDefinition
) {
	if (!systemsPanel) return;
	if (!ultimateIcon) {
		systemsPanel.add([
			k.pos(248, 4),
			k.rect(1, 22),
			k.color(...UI_COLORS.border),
		]);
		ultimateEmptyRing = systemsPanel.add([
			k.pos(267, 13),
			k.circle(9),
			k.anchor("center"),
			k.color(...UI_COLORS.muted),
			k.opacity(0.18),
			k.outline(1, k.rgb(...UI_COLORS.muted)),
		]);
		ultimateIcon = systemsPanel.add([
			k.sprite(ability?.icon ?? "space_jump_upg1", { width: 18, height: 18 }),
			k.pos(267, 12),
			k.anchor("center"),
			k.opacity(ability ? 1 : 0),
		]);
		systemsPanel.add([
			k.pos(255, 27),
			k.rect(ultimateBarWidth, 3),
			k.color(...UI_COLORS.muted),
		]);
		ultimateBar = systemsPanel.add([
			k.pos(255, 27),
			k.rect(0, 3),
			k.color(190, 90, 255),
		]);
		ultimateWarning = systemsPanel.add([
			k.pos(251, 0),
			k.rect(32, weaponSocketSize),
			k.color(...UI_COLORS.danger),
			k.opacity(0),
			k.z(20),
		]);
	}
	const abilityId = ability?.id ?? "";
	if (abilityId !== displayedUltimateId) {
		displayedUltimateId = abilityId;
		if (ability && ultimateIcon) ultimateIcon.sprite = ability.icon;
		if (ultimateIcon) ultimateIcon.opacity = ability ? 1 : 0;
		if (ultimateEmptyRing) ultimateEmptyRing.opacity = ability ? 0 : 0.18;
	}
	const normalizedProgress = ability ? k.clamp(progress, 0, 1) : 0;
	if (Math.abs(normalizedProgress - displayedUltimateProgress) >= 0.001) {
		displayedUltimateProgress = normalizedProgress;
		if (ultimateBar) ultimateBar.width = ultimateBarWidth * normalizedProgress;
	}
	if (ultimateIcon) {
		ultimateIcon.opacity = ability
			? normalizedProgress >= 1
				? k.wave(0.65, 1, k.time() * 8)
				: 0.45 + normalizedProgress * 0.55
			: 0;
	}
}

export function addCollectedPowerup(rewardOrId: Reward | string) {
	const reward = typeof rewardOrId === "string"
		? getRewardDefinition(rewardOrId)
		: rewardOrId;
	if (!reward) return;
	showRewardAcquisitionPopover(reward);
	recordRunReward(reward);
	recordRunRewardStat(reward.rarity);
	if (isAbilityReward(reward)) return;
	const collectionKey = reward.weaponId
		? "primaryWeapon"
		: reward.activeModuleId
			? "secondaryWeapon"
		: reward.upgradeKey ?? reward.powerupKey ?? reward.id;

	const existing = collectedItems.get(collectionKey);
	if (existing) {
		const replacesLoadoutSlot = reward.weaponId || reward.activeModuleId;
		existing.count = replacesLoadoutSlot ? 1 : existing.count + 1;
		existing.reward = reward;
		if (replacesLoadoutSlot) {
			existing.icon.use(k.sprite(reward.sprite, {
				width: 22 * HUD_SCALE,
				height: 22 * HUD_SCALE,
			}));
		}
		existing.tile.outline.color = k.rgb(...REWARD_RARITY_COLORS[reward.rarity]);
		existing.countLabel.text = `x${existing.count}`;
		if (existing.tile.isHovering()) {
			showRewardTooltip(
				existing.reward,
				existing.count,
				(runLoadoutPanel?.pos.x ?? 0) + existing.tile.pos.x
			);
		}
		return;
	}

	if (!runLoadoutPanel || !loadoutIconsContainer) {
		return;
	}
	const rarityColor = k.rgb(...REWARD_RARITY_COLORS[reward.rarity]);
	const tileSize = upgradeTileSize * HUD_SCALE;
	const tile = loadoutIconsContainer.add([
		k.rect(tileSize, tileSize),
		k.color(...UI_COLORS.panel),
		k.opacity(0.88),
		k.outline(1, rarityColor),
		k.pos(0, 0),
		k.anchor("center"),
		uiHitRegion(k.vec2(tileSize), true),
	]);
	const icon = tile.add([
		k.sprite(reward.sprite, { width: 20 * HUD_SCALE, height: 20 * HUD_SCALE }),
		k.pos(0, 0),
		k.anchor("center"),
		k.color(k.WHITE),
	]);
	const countLabel = tile.add([
		k.text("x1", { size: UI_FONT_SIZES.tiny * HUD_SCALE, font: "unscii" }),
		k.pos(tileSize / 2 - 1, tileSize / 2 - 1),
		k.anchor("center"),
		k.color(k.WHITE),
	]);

	const collectedItem = { count: 1, countLabel, reward, tile, icon };
	collectedItems.set(collectionKey, collectedItem);
	layoutCollectedUpgrades();

	tile.onHover(() => {
		uiState.isOverUI = true;
		showRewardTooltip(
			collectedItem.reward,
			collectedItem.count,
			runLoadoutPanel!.pos.x + tile.pos.x
		);
	});
	tile.onHoverEnd(() => {
		uiState.isOverUI = false;
		hideRewardTooltip();
	});
}

export function showRewardAcquisitionPopover(reward: Reward) {
	if (reward.newDiscovery) {
		reward.newDiscovery = false;
		showDiscoveredRewardPopover(reward);
		return;
	}
	const blueprintKey = reward.upgradeKey ?? reward.powerupKey ?? reward.id;
	if (discoverBlueprint(blueprintKey)) {
		showDiscoveredRewardPopover(reward);
		return;
	}
	showCollectedRewardPopover(reward);
}

function layoutCollectedUpgrades() {
	if (!runLoadoutPanel) return;
	const tileSize = upgradeTileSize * HUD_SCALE;
	const stride = (upgradeTileSize + upgradeTileGap) * HUD_SCALE;
	const availableWidth = k.width() - HUD_MARGIN * 2;
	const columns = Math.max(
		1,
		Math.floor((availableWidth + upgradeTileGap * HUD_SCALE) / stride)
	);
	const rows = Math.max(1, Math.ceil(collectedItems.size / columns));

	runLoadoutPanel.pos.y =
		k.height() - statusPanelHeight * HUD_SCALE - HUD_MARGIN * 2 -
			(rows - 1) * stride - tileSize;

	let index = 0;
	for (const item of collectedItems.values()) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		item.tile.pos = k.vec2(
			tileSize / 2 + column * stride,
			tileSize / 2 + row * stride
		);
		index++;
	}
}

function showRewardTooltip(
	reward: Reward,
	count: number,
	iconX: number
) {
	hideRewardTooltip();
	const panelWidth = 400;
	const rarityColor = k.rgb(...REWARD_RARITY_COLORS[reward.rarity]);
	const root = k.add([
		k.pos(0, 0),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(300),
		tags.gameLoopUi,
		rewardTooltipTag,
	]);
	const levelText =
		reward.levelIndex === undefined ? "" : `  LEVEL ${reward.levelIndex + 1}`;
	const card = createUiDetailCard(root, {
		pos: k.vec2(0, 0),
		width: panelWidth,
		minHeight: 72,
		anchor: "center",
		title: reward.name.toUpperCase(),
		meta: `${reward.rarity.toUpperCase()}  x${count}${levelText}`,
		description: reward.description,
		sectionTitle: "EFFECT",
		rows: Object.entries(reward.stats).map(([stat, value]) =>
			`${formatRewardStat(stat)}  ${value}`
		),
		icon: reward.sprite,
		accent: rarityColor,
		frameless: true,
		iconBorder: true,
	});
	const panelHeight = card.getHeight();
	root.pos = k.vec2(
		k.clamp(
			iconX,
			panelWidth / 2 + 8,
			k.width() - panelWidth / 2 - 8
		),
		(runLoadoutPanel?.pos.y ?? 0) - panelHeight / 2 - 8
	);
}

function hideRewardTooltip() {
	k.destroyAll(rewardTooltipTag);
}

function formatRewardStat(stat: string) {
	return stat
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (character) => character.toUpperCase());
}

export function clearGameLoopUi() {
	hideRewardTooltip();
	k.destroyAll(tags.gameLoopUi);
	healthBars = [];
	specialBar = null;
	missileCooldownGroup = null;
	activeModuleIcon = null;
	primaryWeaponIcon = null;
	secondaryWarning = null;
	secondaryEmptyRing = null;
	phaseJumpIcon = null;
	phaseJumpSegments = [];
	phaseJumpChargeLabel = null;
	mobilityNameLabel = null;
	mobilityWarning = null;
	ultimateIcon = null;
	ultimateEmptyRing = null;
	ultimateBar = null;
	ultimateWarning = null;
	shipStatusPanel = null;
	salvageDisplay = null;
	rerollDisplay = null;
	systemsPanel = null;
	runLoadoutPanel = null;
	loadoutIconsContainer = null;
	displayedSalvage = Number.NaN;
	displayedDebreeMode = "";
	displayedRerollTokens = Number.NaN;
	displayedSpecialWidth = Number.NaN;
	displayedMissileVisibility = undefined;
	displayedActiveModuleId = "";
	displayedPrimaryWeaponId = "";
	emptySecondaryFlashRemaining = 0;
	emptyMobilityFlashRemaining = 0;
	emptyUltimateFlashRemaining = 0;
	displayedJumpCharges = Number.NaN;
	displayedJumpMaxCharges = Number.NaN;
	displayedJumpProgress = Number.NaN;
	displayedMobilityId = "";
	displayedUltimateId = "";
	displayedUltimateProgress = Number.NaN;
	collectedItems.clear();
}
