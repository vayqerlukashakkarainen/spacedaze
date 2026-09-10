import {
	AnimateComp,
	Color,
	GameObj,
	OpacityComp,
	RectComp,
	Vec2,
} from "kaplay";
import { getScore, k, layers, mainSoundVolume } from "../main";
import {
	getRewardDefinition,
	isAbilityReward,
	Reward,
	REWARD_RARITY_COLORS,
} from "../services/economy/rewardService";
import { tags } from "../tags";
import { uiState } from "./uiState";
import { recordRunReward } from "../services/runs/runInventoryService";
import { discoverBlueprint } from "../services/hub/hubProgressService";
import { recordRunReward as recordRunRewardStat } from "../services/runs/runStatsService";
import {
	recordTelemetryRewardSelected,
	type RewardTelemetryDetails,
} from "../services/runs/runTelemetryService";
import {
	showCollectedRewardPopover,
	showDiscoveredRewardPopover,
} from "../services/ui/popoverService";
import { createUiPanel } from "./common/panel";
import { UI_COLORS, UI_FONT_SIZES } from "./common/theme";
import { getScaledLineSpacing } from "./common/text";
import { registerBatchedUiUpdate } from "../services/ui/uiUpdateService";
import { uiHitRegion } from "./common/hitRegion";
import { getRerollTokens, player } from "../player";
import type { ActiveModuleDefinition } from "../services/abilities/activeModuleService";
import { getPickupVisual } from "../visuals/pickupVisualCatalog";
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation";
import { getEquippedWeapon } from "../services/player/weaponService";
import { debreeRunActive } from "../services/economy/debreeEconomyService";
import type { AbilityDefinition } from "../services/abilities/abilityRegistry";
import { getAbilityDefinition } from "../services/abilities/abilityRegistry";
import {
	getEquippedMobilityAbilityId,
} from "../services/abilities/abilityLoadoutService";
import { gameSoundService } from "../services/audio/gameSoundService"
import { getRunLevelSnapshot } from "../services/runs/runLevelService";
import { createUiProgressBar } from "./common/progressBar";
import {
	drawRewardTypeFrame,
	getRewardTypeShape,
	type RewardTypeShape,
} from "./common/rewardTypeFrame";
import { hideRunLevelChoice, showRunLevelChoice } from "./runLevelChoice";
import { RewardRarity } from "../types/rewardTypes";
import {
	getStackingRewardFeedbackSnapshot,
	type StackingRewardFeedbackSnapshot,
} from "../services/abilities/passiveUpgradeRuntimeService";
import {
	getActiveRoomFloor,
	getFloorKeyCount,
} from "../services/world/roomFloorService";

let healthBarBaseFill: GameObj<RectComp> | null = null;
let healthBarBonusFill: GameObj<RectComp> | null = null;
let healthBarLabel: GameObj | null = null;
let steeringModeLabel: GameObj | null = null;
let healthCapacity = 0;
let displayedHealth = 0;
let specialBar: GameObj<RectComp> | null = null;
let missileCooldownGroup: GameObj | null = null;
let activeModuleIcon: GameObj | null = null;
let primaryWeaponIcon: GameObj | null = null;
let secondaryWarning: GameObj<OpacityComp> | null = null;
let secondaryEmptyRing: GameObj<OpacityComp> | null = null;
let phaseJumpIcon: GameObj | null = null;
let phaseJumpSegments: GameObj<OpacityComp>[] = [];
let mobilityChargeLabel: GameObj | null = null;
let mobilityWarning: GameObj<OpacityComp> | null = null;
let ultimateIcon: GameObj | null = null;
let ultimateEmptyRing: GameObj<OpacityComp> | null = null;
let ultimateBar: GameObj<RectComp> | null = null;
let ultimateWarning: GameObj<OpacityComp> | null = null;
let shipStatusPanel: GameObj | null = null;
let salvageDisplay: GameObj | null = null;
let rerollDisplay: GameObj | null = null;
let roomKeyDisplay: GameObj | null = null;
let systemsPanel: GameObj | null = null;
let runLoadoutPanel: GameObj | null = null;
let loadoutIconsContainer: GameObj | null = null;
let runLevelHud: GameObj | null = null;
const collectedItems = new Map<
	string,
	{
		count: number;
		countText: string;
		reward: Reward;
		tile: GameObj;
		shape: RewardTypeShape;
		frameColor: Color;
		iconSize: number;
		iconScale: number;
		iconOpacity: number;
		statusText: string;
		statusColor: Color;
		lastProcSerial: number;
	}
>();
let rewardTooltipPool: RewardTooltipPool | undefined;

const statusPanelWidth = 264;
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
const HEALTH_BAR_X = 4;
const HEALTH_BAR_Y = 17;
const HEALTH_BAR_WIDTH = 104;
const HEALTH_BAR_HEIGHT = 7;
const HEALTH_BAR_SEGMENTS = 10;
const LOW_HEALTH_COLOR_THRESHOLD = 0.7;
const LOW_HEALTH_COLOR = [255, 70, 70] as const;
const REWARD_TOOLTIP_POOL_SIZE = 2;
const REWARD_TOOLTIP_WIDTH = 400;
const REWARD_TOOLTIP_MIN_HEIGHT = 72;
const REWARD_TOOLTIP_PADDING = 12;
const REWARD_TOOLTIP_ICON_COLUMN_WIDTH = 48;
const REWARD_TOOLTIP_RESPONSE = 12;

interface RewardTooltipContent {
	key: string;
	reward: Reward;
	count: number;
	iconX: number;
}

interface RewardTooltipSlot {
	root: GameObj;
	title: GameObj;
	meta: GameObj;
	description: GameObj;
	sectionTitle: GameObj;
	stats: GameObj;
	content: RewardTooltipContent | undefined;
	reveal: number;
	visible: boolean;
	height: number;
	accent: Color;
}

interface RewardTooltipPool {
	show(content: RewardTooltipContent): void;
	hide(key?: string): void;
	destroy(): void;
}
let displayedSalvage = Number.NaN;
let displayedDebreeMode = "";
let displayedRerollTokens = Number.NaN;
let displayedRoomKeys = Number.NaN;
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
let displayedSteeringMode = "";
export function setupGameLoopUi(health: number, missilesUnlocked = false) {
	setupRunLevelHud();
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
	setupPlayerHealthBar(health);
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
	const roomKeySeparator = shipStatusPanel.add([
		k.pos(228, 5),
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
		k.sprite("salvage_shard", { width: 16, height: 16 }),
		k.pos(-33, 0),
		k.anchor("center"),
		k.color(...UI_COLORS.accent),
	]);
	const salvageLabel = salvageDisplay.add([
		k.text("", { size: 7, font: "unscii" }),
		k.pos(0, 0),
		k.anchor("right"),
		k.color(...UI_COLORS.accent),
	]);
	const salvageModeLabel = salvageDisplay.add([
		k.text("", { size: 7, font: "unscii" }),
		k.pos(0, -10),
		k.anchor("right"),
		k.color(...UI_COLORS.muted),
	]);
	rerollDisplay = shipStatusPanel.add([
		k.pos(223, 15),
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
	roomKeyDisplay = shipStatusPanel.add([
		k.pos(statusPanelWidth - 5, 15),
		k.scale(1),
		{
			pulseScale: 1,
		},
	]);
	const roomKeyIcon = roomKeyDisplay.add([
		k.sprite(requirePrimaryVisualSprite(getPickupVisual("room-key")), { width: 16, height: 16 }),
		k.pos(-25, 0),
		k.anchor("center"),
		k.color(...UI_COLORS.warning),
	]);
	const roomKeyLabel = roomKeyDisplay.add([
		k.text("", { size: UI_FONT_SIZES.small, font: "unscii" }),
		k.pos(0, 0),
		k.anchor("right"),
		k.color(...UI_COLORS.warning),
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
	registerBatchedUiUpdate("hud", roomKeyDisplay, () => {
		const visible = getActiveRoomFloor() !== undefined;
		roomKeyDisplay!.hidden = !visible;
		roomKeySeparator.hidden = !visible;
		if (!visible) return;
		const keys = getFloorKeyCount();
		if (keys !== displayedRoomKeys) {
			if (!Number.isNaN(displayedRoomKeys)) {
				roomKeyDisplay!.pulseScale = Math.min(
					1.45,
					roomKeyDisplay!.pulseScale + 0.3
				);
			}
			displayedRoomKeys = keys;
			roomKeyLabel.text = `${keys}`;
			roomKeyIcon.pos.x = roomKeyLabel.pos.x - roomKeyLabel.width - 11;
		}
		roomKeyDisplay!.pulseScale = k.lerp(
			roomKeyDisplay!.pulseScale,
			1,
			k.clamp(14 * k.dt(), 0, 1)
		);
		roomKeyDisplay!.scale = k.vec2(roomKeyDisplay!.pulseScale);
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
	loadoutIconsContainer = runLoadoutPanel.add([
		k.pos(0, 0),
		{
			draw() {
				drawCollectedUpgrades();
			},
		},
	]);
	registerBatchedUiUpdate("hud", runLoadoutPanel, updateStackingRewardFeedback);

}

function setupRunLevelHud() {
	runLevelHud = createUiPanel({
		pos: k.vec2(0, k.height() - 8),
		size: k.vec2(k.width(), 6),
		tags: [tags.gameLoopUi],
		frameless: true,
	});
	const progress = createUiProgressBar(runLevelHud, {
		pos: k.vec2(HUD_MARGIN, 0),
		width: k.width() - HUD_MARGIN * 2,
		height: 4,
		value: 0,
	});
	const levelLabel = runLevelHud.add([
		k.text("", { size: UI_FONT_SIZES.small, font: "unscii" }),
		k.pos(k.width() / 2, -8),
		k.anchor("bot"),
		k.color(...UI_COLORS.accent),
	]);
	let displayedLevel = Number.NaN;
	let displayedXp = Number.NaN;
	let displayedRequiredXp = Number.NaN;
	let displayedProgress = 0;
	registerBatchedUiUpdate("hud", runLevelHud, () => {
		const snapshot = getRunLevelSnapshot();
		runLevelHud!.hidden = !snapshot.active;
		if (!snapshot.active) return;
		if (!Number.isNaN(displayedLevel) && snapshot.level > displayedLevel) {
			const gainedLevels = snapshot.level - displayedLevel;
			const levelHud = runLevelHud;
			for (let index = 0; index < gainedLevels; index++) {
				k.wait(index * 0.12, () => {
					if (!levelHud?.exists() || runLevelHud !== levelHud) return;
					gameSoundService.play("run_level_up", {
						volume: mainSoundVolume * 0.85,
						detune: index * 120,
					});
				});
			}
		}
		if (
			snapshot.level !== displayedLevel ||
			snapshot.xp !== displayedXp ||
			snapshot.requiredXp !== displayedRequiredXp
		) {
			displayedLevel = snapshot.level;
			displayedXp = snapshot.xp;
			displayedRequiredXp = snapshot.requiredXp;
			levelLabel.text = `LEVEL ${snapshot.level}`;
		}
		displayedProgress = k.lerp(
			displayedProgress,
			snapshot.progress,
			k.clamp(k.dt() * 10, 0, 1)
		);
		progress.setValue(displayedProgress);
		if (snapshot.pendingSelections > 0) showRunLevelChoice();
	});
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
		k.text(`+${amount}`, { size: 7, font: "unscii" }),
		k.pos(pos.add(k.rand(-7, 7), k.rand(-25, -19))),
		k.anchor("center"),
		k.color(color),
		k.opacity(1),
		k.scale(1),
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
			? k.lerp(1, 1.15, progress / 0.18)
			: k.lerp(1.15, 0.75, (progress - 0.18) / 0.82);
		gain.scale = k.vec2(popScale);

		if (progress >= 1) k.destroy(gain);
	});
}

function setupPlayerHealthBar(maxHealth: number) {
	if (!shipStatusPanel) return;
	healthCapacity = Math.max(1, maxHealth);
	steeringModeLabel = shipStatusPanel.add([
		k.pos(HEALTH_BAR_X, -5),
		k.text("", { size: 6, font: "unscii" }),
		k.color(...UI_COLORS.text),
	]);
	displayedSteeringMode = "";
	updatePlayerSteeringModeUi(false);
	healthBarLabel = shipStatusPanel.add([
		k.pos(HEALTH_BAR_X, 4),
		k.text("", { size: 6, font: "unscii" }),
		k.color(...UI_COLORS.text),
	]);
	shipStatusPanel.add([
		k.pos(HEALTH_BAR_X, HEALTH_BAR_Y),
		k.rect(HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT),
		k.color(...UI_COLORS.muted),
		k.opacity(0.22),
	]);
	healthBarBaseFill = shipStatusPanel.add([
		k.pos(HEALTH_BAR_X, HEALTH_BAR_Y),
		k.rect(HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT),
		k.color(...UI_COLORS.text),
	]);
	healthBarBonusFill = shipStatusPanel.add([
		k.pos(HEALTH_BAR_X, HEALTH_BAR_Y),
		k.rect(0, HEALTH_BAR_HEIGHT),
		k.color(...REWARD_RARITY_COLORS[RewardRarity.Rare]),
	]);
	for (let index = 1; index < HEALTH_BAR_SEGMENTS; index++) {
		shipStatusPanel.add([
			k.pos(
				HEALTH_BAR_X + Math.round(HEALTH_BAR_WIDTH * index / HEALTH_BAR_SEGMENTS),
				HEALTH_BAR_Y
			),
			k.rect(1, HEALTH_BAR_HEIGHT),
			k.color(...UI_COLORS.panel),
			k.opacity(0.9),
		]);
	}
	updatePlayerHealthBar(maxHealth);
}

export function updatePlayerSteeringModeUi(strafeModeActive: boolean) {
	const mode = strafeModeActive ? "STRAFE" : "NORMAL";
	if (!steeringModeLabel || displayedSteeringMode === mode) return;
	displayedSteeringMode = mode;
	steeringModeLabel.text = `MODE: ${mode}`;
	steeringModeLabel.color = strafeModeActive
		? k.rgb(...UI_COLORS.accent)
		: k.rgb(...UI_COLORS.text);
}

export function updatePlayerHealthBar(currentHealth: number) {
	displayedHealth = k.clamp(currentHealth, 0, healthCapacity);
	if (!healthBarBaseFill || !healthBarBonusFill || !healthBarLabel) return;
	const healthRatio = displayedHealth / healthCapacity;
	const lowHealthProgress = k.clamp(
		(LOW_HEALTH_COLOR_THRESHOLD - healthRatio) / LOW_HEALTH_COLOR_THRESHOLD,
		0,
		1
	);
	const healthColor = k.rgb(
		255,
		k.lerp(255, LOW_HEALTH_COLOR[1], lowHealthProgress),
		k.lerp(255, LOW_HEALTH_COLOR[2], lowHealthProgress)
	);
	const baseCapacity = Math.min(player.maxHealth, healthCapacity);
	const baseHealth = Math.min(displayedHealth, baseCapacity);
	const bonusHealth = Math.max(0, displayedHealth - baseCapacity);
	const baseWidth = HEALTH_BAR_WIDTH * baseHealth / healthCapacity;
	const bonusStart = HEALTH_BAR_WIDTH * baseCapacity / healthCapacity;
	healthBarBaseFill.width = baseWidth;
	healthBarBaseFill.color = healthColor;
	healthBarBonusFill.pos.x = HEALTH_BAR_X + bonusStart;
	healthBarBonusFill.width = HEALTH_BAR_WIDTH * bonusHealth / healthCapacity;
	healthBarBonusFill.color = healthRatio < LOW_HEALTH_COLOR_THRESHOLD
		? healthColor
		: k.rgb(...REWARD_RARITY_COLORS[RewardRarity.Rare]);
	healthBarLabel.color = healthColor;
	healthBarLabel.text = `HULL ${formatHullValue(displayedHealth)} / ${formatHullValue(healthCapacity)}`;
}

function formatHullValue(value: number) {
	return `${Math.round(value * 100) / 100}`;
}

export function syncPlayerHealthBarCapacity(maxHealth: number) {
	healthCapacity = Math.max(1, maxHealth);
	updatePlayerHealthBar(displayedHealth);
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
		mobilityChargeLabel = systemsPanel.add([
			k.text("", { size: UI_FONT_SIZES.micro, font: "unscii" }),
			k.pos(240, 15),
			k.anchor("right"),
			k.color(...UI_COLORS.accent),
			k.opacity(0),
		]);

		mobilityWarning = systemsPanel.add([
			k.pos(79, 0),
			k.rect(166, weaponSocketSize),
			k.color(...UI_COLORS.danger),
			k.opacity(0),
			k.z(20),
		]);
	}
	const mobilityChanged = mobilityId !== displayedMobilityId;
	if (mobilityChanged) {
		displayedMobilityId = mobilityId ?? "";
		if (phaseJumpIcon && mobility) phaseJumpIcon.sprite = mobility.icon;
	}

	if (
		!mobilityChanged &&
		charges === displayedJumpCharges &&
		maxCharges === displayedJumpMaxCharges &&
		Math.abs(rechargeProgress - displayedJumpProgress) < 0.001
	) return;
	displayedJumpCharges = charges;
	displayedJumpMaxCharges = maxCharges;
	displayedJumpProgress = rechargeProgress;
	phaseJumpIcon.opacity = mobility ? charges > 0 ? 1 : 0.25 : 0.18;
	if (mobilityChargeLabel) {
		const hasMultipleCharges = mobility !== undefined && maxCharges > 1;
		mobilityChargeLabel.text = hasMultipleCharges
			? `x${Math.max(0, Math.floor(charges))}`
			: "";
		mobilityChargeLabel.color = charges > 0
			? k.rgb(...UI_COLORS.accent)
			: k.rgb(...UI_COLORS.danger);
		mobilityChargeLabel.opacity = hasMultipleCharges
			? charges > 0 ? 1 : 0.55
			: 0;
	}
	const filledSegments = rechargeProgress * phaseJumpSegmentCount;
	const overdriveOverused =
		mobilityId === "thrusterOverdrive" && charges <= 0;
	for (let index = 0; index < phaseJumpSegments.length; index++) {
		phaseJumpSegments[index].color = mobility
			? overdriveOverused
				? k.rgb(...UI_COLORS.danger)
				: k.rgb(...UI_COLORS.accent)
			: k.rgb(...UI_COLORS.muted);
		phaseJumpSegments[index].opacity = mobility
			? index < filledSegments ? 1 : 0.22
			: 0.12;
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

export function addCollectedPowerup(
	rewardOrId: Reward | string,
	telemetryDetails: RewardTelemetryDetails = {}
) {
	const reward = typeof rewardOrId === "string"
		? getRewardDefinition(rewardOrId)
		: rewardOrId;
	if (!reward) return;
	showRewardAcquisitionPopover(reward);
	recordRunReward(reward);
	recordRunRewardStat(reward.rarity);
	recordTelemetryRewardSelected(
		reward.id,
		reward.rarity,
		isAbilityReward(reward),
		telemetryDetails
	);
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
		existing.countText = `x${existing.count}`;
		existing.reward = reward;
		if (replacesLoadoutSlot) {
			existing.iconSize = 22 * HUD_SCALE;
		}
		existing.shape = getRewardTypeShape(reward.kind, reward.abilitySlot);
		existing.frameColor = k.rgb(...REWARD_RARITY_COLORS[reward.rarity]);
		if (existing.tile.isHovering()) {
			showRewardTooltip(
				collectionKey,
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
	const tileSize = upgradeTileSize * HUD_SCALE;
	const tile = loadoutIconsContainer.add([
		k.pos(0, 0),
		uiHitRegion(k.vec2(tileSize), true),
	]);

	const feedback = getStackingRewardFeedbackSnapshot();
	const collectedItem = {
		count: 1,
		countText: "x1",
		reward,
		tile,
		shape: getRewardTypeShape(reward.kind, reward.abilitySlot),
		frameColor: k.rgb(...REWARD_RARITY_COLORS[reward.rarity]),
		iconSize: 20 * HUD_SCALE,
		iconScale: 1,
		iconOpacity: 1,
		statusText: "",
		statusColor: k.rgb(...UI_COLORS.accent),
		lastProcSerial: getStackingRewardProcSerial(collectionKey, feedback),
	};
	collectedItems.set(collectionKey, collectedItem);
	layoutCollectedUpgrades();

	tile.onHover(() => {
		uiState.isOverUI = true;
		showRewardTooltip(
			collectionKey,
			collectedItem.reward,
			collectedItem.count,
			runLoadoutPanel!.pos.x + tile.pos.x
		);
	});
	tile.onHoverEnd(() => {
		uiState.isOverUI = false;
		hideRewardTooltip(collectionKey);
	});
}

function updateStackingRewardFeedback() {
	const snapshot = getStackingRewardFeedbackSnapshot();
	for (const [key, item] of collectedItems) {
		const procSerial = getStackingRewardProcSerial(key, snapshot);
		if (procSerial > item.lastProcSerial) {
			item.lastProcSerial = procSerial;
			item.iconScale = 1.35;
		}
		item.iconScale = k.lerp(
			item.iconScale,
			1,
			k.clamp(k.dt() * 12, 0, 1)
		);

		if (key === "phaseCounter") {
			item.statusText =
				`${snapshot.phaseCounterCharge}/${snapshot.phaseCounterCapacity}`;
			item.statusColor = k.rgb(...UI_COLORS.accent);
			item.iconOpacity = snapshot.phaseCounterCharge > 0
				? k.wave(0.72, 1, k.time() * 8)
				: 0.42;
			continue;
		}
		if (key === "resonanceCoil") {
			const ready = snapshot.resonanceCooldownRemaining <= 0;
			const cooldownProgress = snapshot.resonanceCooldownDuration <= 0
				? 1
				: 1 - snapshot.resonanceCooldownRemaining /
					snapshot.resonanceCooldownDuration;
			item.statusText = ready
				? "RDY"
				: `${Math.ceil(snapshot.resonanceCooldownRemaining)}s`;
			item.statusColor = k.rgb(
				...(ready ? UI_COLORS.accent : UI_COLORS.muted)
			);
			item.iconOpacity = ready
				? k.wave(0.72, 1, k.time() * 7)
				: 0.25 + k.clamp(cooldownProgress, 0, 1) * 0.5;
			continue;
		}
		if (key === "threatReactor") {
			item.statusText = `T+${snapshot.threatTierBonus}`;
			item.statusColor = k.rgb(...UI_COLORS.danger);
			continue;
		}
		item.statusText = "";
		item.iconOpacity = 1;
	}
}

function drawCollectedUpgrades() {
	const tileSize = upgradeTileSize * HUD_SCALE;
	for (const item of collectedItems.values()) {
		drawRewardTypeFrame({
			pos: item.tile.pos,
			size: tileSize,
			shape: item.shape,
			color: item.frameColor,
			fillOpacity: 0.12,
			outlineOpacity: 0.9,
			lineWidth: 1,
		});
	}
	for (const item of collectedItems.values()) {
		k.drawSprite({
			sprite: item.reward.sprite,
			pos: item.tile.pos,
			width: item.iconSize,
			height: item.iconSize,
			anchor: "center",
			color: k.WHITE,
			opacity: item.iconOpacity,
			scale: k.vec2(item.iconScale),
		});
	}
	for (const item of collectedItems.values()) {
		if (item.statusText) {
			k.drawText({
				text: item.statusText,
				font: "unscii",
				size: UI_FONT_SIZES.tiny * HUD_SCALE,
				pos: k.vec2(
					item.tile.pos.x - tileSize / 2 + 2,
					item.tile.pos.y - tileSize / 2 + 2
				),
				color: item.statusColor,
			});
		}
		k.drawText({
			text: item.countText,
			font: "unscii",
			size: UI_FONT_SIZES.tiny * HUD_SCALE,
			pos: k.vec2(
				item.tile.pos.x + tileSize / 2 - 1,
				item.tile.pos.y + tileSize / 2 - 1
			),
			anchor: "center",
			color: k.WHITE,
		});
	}
}

function getStackingRewardProcSerial(
	key: string,
	snapshot: StackingRewardFeedbackSnapshot
) {
	if (key === "tacticalUplink") return snapshot.procSerials.tacticalUplink;
	if (key === "phaseCounter") return snapshot.procSerials.phaseCounter;
	if (key === "resonanceCoil") return snapshot.procSerials.resonanceCoil;
	if (key === "wreckHarvester") return snapshot.procSerials.wreckHarvester;
	return 0;
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
	key: string,
	reward: Reward,
	count: number,
	iconX: number
) {
	ensureRewardTooltipPool().show({ key, reward, count, iconX });
}

function hideRewardTooltip(key?: string) {
	rewardTooltipPool?.hide(key);
}

function ensureRewardTooltipPool() {
	if (rewardTooltipPool) return rewardTooltipPool;
	rewardTooltipPool = createRewardTooltipPool();
	return rewardTooltipPool;
}

function createRewardTooltipPool(): RewardTooltipPool {
	const slots = Array.from(
		{ length: REWARD_TOOLTIP_POOL_SIZE },
		() => createRewardTooltipSlot()
	);
	let activeKey: string | undefined;
	let activeSlotIndex = -1;

	return {
		show(content) {
			if (activeKey === content.key && activeSlotIndex >= 0) {
				assignRewardTooltip(slots[activeSlotIndex], content);
				return;
			}
			if (activeSlotIndex >= 0) slots[activeSlotIndex].visible = false;
			activeSlotIndex = (activeSlotIndex + 1) % slots.length;
			activeKey = content.key;
			assignRewardTooltip(slots[activeSlotIndex], content);
		},
		hide(key) {
			if (key !== undefined && key !== activeKey) return;
			if (activeSlotIndex >= 0) slots[activeSlotIndex].visible = false;
			activeKey = undefined;
		},
		destroy() {
			activeKey = undefined;
			for (const slot of slots) {
				if (slot.root.exists()) k.destroy(slot.root);
			}
		},
	};
}

function createRewardTooltipSlot(): RewardTooltipSlot {
	let slot: RewardTooltipSlot;
	const root = k.add([
		k.pos(),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(300),
		tags.gameLoopUi,
	]);
	root.hidden = true;
	const contentWidth = REWARD_TOOLTIP_WIDTH -
		REWARD_TOOLTIP_PADDING * 2 - REWARD_TOOLTIP_ICON_COLUMN_WIDTH;
	const contentX = -REWARD_TOOLTIP_WIDTH / 2 + REWARD_TOOLTIP_PADDING +
		REWARD_TOOLTIP_ICON_COLUMN_WIDTH;
	const title = root.add([
		k.text("", {
			font: "unscii",
			size: UI_FONT_SIZES.subheading,
			width: contentWidth,
		}),
		k.pos(contentX, 0),
		k.color(k.WHITE),
		k.opacity(0),
	]);
	const meta = root.add([
		k.text("", {
			font: "unscii",
			size: UI_FONT_SIZES.label,
			width: contentWidth,
		}),
		k.pos(contentX, 0),
		k.color(...UI_COLORS.accent),
		k.opacity(0),
	]);
	const description = root.add([
		k.text("", {
			font: "unscii",
			size: UI_FONT_SIZES.small,
			width: contentWidth,
			lineSpacing: getScaledLineSpacing(UI_FONT_SIZES.small, 1.4),
		}),
		k.pos(contentX, 0),
		k.color(k.WHITE),
		k.opacity(0),
	]);
	const sectionTitle = root.add([
		k.text("EFFECT", {
			font: "unscii",
			size: UI_FONT_SIZES.label,
			width: contentWidth,
		}),
		k.pos(contentX, 0),
		k.color(...UI_COLORS.accent),
		k.opacity(0),
	]);
	const stats = root.add([
		k.text("", {
			font: "unscii",
			size: UI_FONT_SIZES.body,
			width: contentWidth,
			lineSpacing: getScaledLineSpacing(UI_FONT_SIZES.body, 1.25),
		}),
		k.pos(contentX, 0),
		k.color(k.WHITE),
		k.opacity(0),
	]);
	slot = {
		root,
		title,
		meta,
		description,
		sectionTitle,
		stats,
		content: undefined,
		reveal: 0,
		visible: false,
		height: REWARD_TOOLTIP_MIN_HEIGHT,
		accent: k.rgb(...UI_COLORS.accent),
	};
	root.add([
		k.z(-1),
		{
			draw() {
				drawRewardTooltipSlot(slot);
			},
		},
	]);
	root.onUpdate(() => updateRewardTooltipSlot(slot));
	return slot;
}

function assignRewardTooltip(
	slot: RewardTooltipSlot,
	content: RewardTooltipContent
) {
	const { reward } = content;
	const levelText = reward.levelIndex === undefined
		? ""
		: `  LEVEL ${reward.levelIndex + 1}`;
	const rows = Object.entries(reward.stats).map(([stat, value]) =>
		`${formatRewardStat(stat)}  ${value}`
	);
	slot.content = content;
	slot.visible = true;
	slot.root.hidden = false;
	slot.accent = k.rgb(...REWARD_RARITY_COLORS[reward.rarity]);
	slot.title.text = reward.name.toUpperCase();
	slot.meta.text = `${reward.rarity.toUpperCase()}  x${content.count}${levelText}`;
	slot.meta.color = slot.accent;
	slot.description.text = reward.description ?? "";
	slot.description.hidden = !reward.description;
	slot.sectionTitle.hidden = rows.length === 0;
	slot.sectionTitle.color = slot.accent;
	slot.stats.text = rows.join("\n");
	slot.stats.hidden = rows.length === 0;
	layoutRewardTooltipSlot(slot);
}

function layoutRewardTooltipSlot(slot: RewardTooltipSlot) {
	const entries = [
		{ obj: slot.title, gap: 3 },
		{ obj: slot.meta, gap: 10 },
		{ obj: slot.description, gap: slot.stats.hidden ? 0 : 12 },
		{ obj: slot.sectionTitle, gap: 5 },
		{ obj: slot.stats, gap: 0 },
	].filter((entry) => !entry.obj.hidden);
	const contentHeight = entries.reduce(
		(total, entry) => total + entry.obj.formattedText().height + entry.gap,
		0
	);
	slot.height = Math.max(
		REWARD_TOOLTIP_MIN_HEIGHT,
		REWARD_TOOLTIP_PADDING * 2 + contentHeight
	);
	let y = -slot.height / 2 + REWARD_TOOLTIP_PADDING;
	for (const entry of entries) {
		entry.obj.pos.y = y;
		y += entry.obj.formattedText().height + entry.gap;
	}
}

function updateRewardTooltipSlot(slot: RewardTooltipSlot) {
	const target = slot.visible ? 1 : 0;
	const blend = 1 - Math.exp(-REWARD_TOOLTIP_RESPONSE * k.dt());
	slot.reveal = k.lerp(slot.reveal, target, blend);
	if (Math.abs(slot.reveal - target) < 0.01) slot.reveal = target;
	if (slot.reveal === 0) {
		slot.root.hidden = true;
		slot.content = undefined;
		return;
	}
	const content = slot.content;
	if (!content) return;
	const easedReveal = slot.reveal * slot.reveal * (3 - 2 * slot.reveal);
	slot.root.hidden = false;
	slot.root.pos = k.vec2(
		k.clamp(
			content.iconX,
			REWARD_TOOLTIP_WIDTH / 2 + 8,
			k.width() - REWARD_TOOLTIP_WIDTH / 2 - 8
		),
		(runLoadoutPanel?.pos.y ?? 0) - slot.height / 2 - 8 +
			(1 - easedReveal) * 6
	);
	for (const text of [
		slot.title,
		slot.meta,
		slot.description,
		slot.sectionTitle,
		slot.stats,
	]) {
		text.opacity = easedReveal;
	}
}

function drawRewardTooltipSlot(slot: RewardTooltipSlot) {
	const content = slot.content;
	if (!content || slot.reveal <= 0) return;
	const left = -REWARD_TOOLTIP_WIDTH / 2;
	const top = -slot.height / 2;
	const opacity = slot.reveal * 0.96;
	k.drawRect({
		pos: k.vec2(left, top),
		width: REWARD_TOOLTIP_WIDTH,
		height: slot.height,
		color: k.rgb(...UI_COLORS.panel),
		opacity,
	});
	k.drawRect({
		pos: k.vec2(left + 3, top + 3),
		width: 3,
		height: slot.height - 6,
		color: slot.accent,
		opacity: slot.reveal,
	});
	k.drawRect({
		pos: k.vec2(left + 31, top + 31),
		width: 38,
		height: 38,
		anchor: "center",
		color: k.rgb(...UI_COLORS.panel),
		opacity,
		outline: {
			width: 1,
			color: slot.accent,
			opacity: slot.reveal,
		},
	});
	k.drawSprite({
		sprite: content.reward.sprite,
		pos: k.vec2(left + 31, top + 31),
		width: 30,
		height: 30,
		anchor: "center",
		color: slot.accent,
		opacity: slot.reveal,
	});
}

function formatRewardStat(stat: string) {
	if (stat === "projectileDotDamage") return "Projectile DOT Damage"
	return stat
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (character) => character.toUpperCase());
}

export function clearGameLoopUi() {
	hideRunLevelChoice();
	rewardTooltipPool?.destroy();
	rewardTooltipPool = undefined;
	k.destroyAll(tags.gameLoopUi);
	healthBarBaseFill = null;
	healthBarBonusFill = null;
	healthBarLabel = null;
	steeringModeLabel = null;
	healthCapacity = 0;
	displayedHealth = 0;
	specialBar = null;
	missileCooldownGroup = null;
	activeModuleIcon = null;
	primaryWeaponIcon = null;
	secondaryWarning = null;
	secondaryEmptyRing = null;
	phaseJumpIcon = null;
	phaseJumpSegments = [];
	mobilityChargeLabel = null;
	mobilityWarning = null;
	ultimateIcon = null;
	ultimateEmptyRing = null;
	ultimateBar = null;
	ultimateWarning = null;
	shipStatusPanel = null;
	salvageDisplay = null;
	rerollDisplay = null;
	roomKeyDisplay = null;
	systemsPanel = null;
	runLoadoutPanel = null;
	loadoutIconsContainer = null;
	runLevelHud = null;
	displayedSalvage = Number.NaN;
	displayedDebreeMode = "";
	displayedRerollTokens = Number.NaN;
	displayedRoomKeys = Number.NaN;
	displayedSpecialWidth = Number.NaN;
	displayedMissileVisibility = undefined;
	displayedActiveModuleId = "";
	displayedPrimaryWeaponId = "";
	displayedSteeringMode = "";
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
