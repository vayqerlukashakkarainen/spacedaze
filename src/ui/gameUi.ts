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
	Reward,
	REWARD_RARITY_COLORS,
} from "../services/rewardService";
import { tags } from "../tags";
import { uiState } from "./uiState";
import { recordRunReward } from "../services/runInventoryService";
import { discoverBlueprint } from "../services/hubProgressService";
import { recordRunReward as recordRunRewardStat } from "../services/runStatsService";
import { createUiPanel } from "./common/panel";
import { UI_COLORS } from "./common/theme";

let healthBars: GameObj<OpacityComp>[] = [];
let specialBar: GameObj<RectComp> | null = null;
let missileCooldownGroup: GameObj | null = null;
let phaseJumpIcon: GameObj<OpacityComp> | null = null;
let phaseJumpCooldownBar: GameObj<RectComp> | null = null;
let phaseJumpChargeLabel: GameObj | null = null;
let shipStatusPanel: GameObj | null = null;
let systemsPanel: GameObj | null = null;
let runLoadoutPanel: GameObj | null = null;
const collectedItems = new Map<
	string,
	{
		count: number;
		countLabel: GameObj;
		reward: Reward;
		icon: GameObj;
	}
>();

const rewardTooltipTag = "rewardTooltip";

const statusPanelWidth = 180;
const statusPanelHeight = 58;
const systemsPanelWidth = 170;
const systemsPanelHeight = 58;
const runLoadoutPanelWidth = 340;
const runLoadoutPanelHeight = 82;
const abilityBarWidth = 52;
const HUD_SCALE = 1.5;
const HUD_MARGIN = 12;
const SALVAGE_GAIN_LIFETIME = 0.7;
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
		k.text("HULL", { size: 7, font: "unscii" }),
		k.pos(8, 25),
		k.color(k.WHITE),
	]);
	const salvageLabel = shipStatusPanel.add([
		k.text("", { size: 9, font: "unscii" }),
		k.pos(statusPanelWidth - 8, 27),
		k.anchor("right"),
		k.color(...UI_COLORS.accent),
	]);
	salvageLabel.onUpdate(() => {
		salvageLabel.text = `SALVAGE ${getScore()}`;
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
	missileCooldownGroup = systemsPanel.add([
		k.pos(0, 0),
	]);
	missileCooldownGroup.hidden = !missilesUnlocked;
	missileCooldownGroup.add([
		k.sprite("rocket_upg1", { width: 16, height: 16 }),
		k.pos(14, 36),
		k.anchor("center"),
	]);
	missileCooldownGroup.add([
		k.text("MISSILE", { size: 7, font: "unscii" }),
		k.pos(27, 25),
		k.color(k.WHITE),
	]);
	missileCooldownGroup.add([
		k.pos(27, 40),
		k.rect(abilityBarWidth, 5),
		k.color(...UI_COLORS.muted),
	]);
	specialBar = missileCooldownGroup.add([
		k.pos(27, 40),
		k.rect(abilityBarWidth, 5),
		k.color(...UI_COLORS.accent),
	]);

	runLoadoutPanel = createUiPanel({
		pos: k.vec2(
			HUD_MARGIN,
			k.height() -
				(statusPanelHeight + runLoadoutPanelHeight) * HUD_SCALE -
				HUD_MARGIN * 2
		),
		size: k.vec2(
			Math.min(runLoadoutPanelWidth * HUD_SCALE, k.width() - HUD_MARGIN * 2),
			runLoadoutPanelHeight * HUD_SCALE
		),
		tags: [tags.gameLoopUi],
		frameless: true,
	});

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

	const gain = k.add([
		k.text(`+${amount}`, { size: 11, font: "unscii" }),
		k.pos(pos.add(k.rand(-7, 7), k.rand(-25, -19))),
		k.anchor("center"),
		k.color(color),
		k.opacity(1),
		k.scale(1.35),
		k.z(100),
		k.layer(layers.game),
		{
			elapsed: 0,
			startY: 0,
		},
		tags.gameLoop,
	]);
	gain.startY = gain.pos.y;

	gain.onUpdate(() => {
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
	const pipWidth = 10;
	const pipGap = 3;
	const c = shipStatusPanel.add([
		k.pos(8 + healthValue * (pipWidth + pipGap), 39),
		k.rect(pipWidth, 9),
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
	missilesUnlocked = true
) {
	if (missileCooldownGroup) {
		missileCooldownGroup.hidden = !missilesUnlocked;
	}
	if (!specialBar) return;
	specialBar.width =
		abilityBarWidth * k.clamp(current / max, 0, 1);
}

export function updatePhaseJumpUi(
	charges: number,
	maxCharges: number,
	rechargeProgress: number
) {
	if (!phaseJumpIcon && systemsPanel) {
		phaseJumpIcon = systemsPanel.add([
			k.sprite("space_jump_upg1", { width: 16, height: 16 }),
			k.pos(99, 36),
			k.anchor("center"),
			k.opacity(1),
		]);

		systemsPanel.add([
			k.text("JUMP", { size: 7, font: "unscii" }),
			k.pos(112, 25),
			k.color(k.WHITE),
		]);

		systemsPanel.add([
			k.pos(112, 40),
			k.rect(abilityBarWidth - 12, 5),
			k.color(...UI_COLORS.muted),
		]);

		phaseJumpCooldownBar = systemsPanel.add([
			k.pos(112, 40),
			k.rect(abilityBarWidth - 12, 5),
			k.color(...UI_COLORS.accent),
		]);

		phaseJumpChargeLabel = systemsPanel.add([
			k.text("", { size: 8, font: "unscii" }),
			k.pos(160, 25),
			k.anchor("right"),
			k.color(k.WHITE),
		]);
	}

	phaseJumpIcon.opacity = charges > 0 ? 1 : 0.25;
	if (phaseJumpCooldownBar) {
		phaseJumpCooldownBar.width =
			(abilityBarWidth - 12) * k.clamp(rechargeProgress, 0, 1);
	}
	if (phaseJumpChargeLabel) {
		phaseJumpChargeLabel.text = maxCharges > 1 ? `${charges}/${maxCharges}` : "";
	}
}

export function addCollectedPowerup(rewardOrId: Reward | string) {
	const reward = typeof rewardOrId === "string"
		? getRewardDefinition(rewardOrId)
		: rewardOrId;
	if (!reward) return;
	recordRunReward(reward);
	const blueprintKey = reward.upgradeKey ?? reward.powerupKey ?? reward.id;
	discoverBlueprint(blueprintKey);
	recordRunRewardStat(reward.rarity);
	const collectionKey = reward.upgradeKey ?? reward.powerupKey ?? reward.id;

	const existing = collectedItems.get(collectionKey);
	if (existing) {
		existing.count++;
		existing.reward = reward;
		existing.icon.color = k.rgb(...REWARD_RARITY_COLORS[reward.rarity]);
		existing.countLabel.text = `x${existing.count}`;
		if (existing.icon.isHovering()) {
			showRewardTooltip(
				existing.reward,
				existing.count,
				(runLoadoutPanel?.pos.x ?? 0) + existing.icon.pos.x
			);
		}
		return;
	}

	if (!runLoadoutPanel) return;
	const index = collectedItems.size;
	const panelWidth = Math.min(
		runLoadoutPanelWidth * HUD_SCALE,
		k.width() - HUD_MARGIN * 2
	);
	const iconStride = 29 * HUD_SCALE;
	const columns = Math.max(
		1,
		Math.floor((panelWidth - 16 * HUD_SCALE) / iconStride)
	);
	const column = index % columns;
	const row = Math.floor(index / columns);
	const rarityColor = k.rgb(...REWARD_RARITY_COLORS[reward.rarity]);
	const icon = runLoadoutPanel.add([
		k.sprite(reward.sprite, { width: 22 * HUD_SCALE, height: 22 * HUD_SCALE }),
		k.color(rarityColor),
		k.outline(1, rarityColor),
		k.pos(
			(18 + column * 29) * HUD_SCALE,
			(30 + row * 29) * HUD_SCALE
		),
		k.anchor("center"),
		k.area(),
	]);
	const countLabel = icon.add([
		k.text("x1", { size: 7 * HUD_SCALE, font: "unscii" }),
		k.pos(10 * HUD_SCALE, 10 * HUD_SCALE),
		k.anchor("center"),
		k.color(rarityColor),
	]);

	const collectedItem = { count: 1, countLabel, reward, icon };
	collectedItems.set(collectionKey, collectedItem);

	icon.onHover(() => {
		uiState.isOverUI = true;
		showRewardTooltip(
			collectedItem.reward,
			collectedItem.count,
			runLoadoutPanel!.pos.x + icon.pos.x
		);
	});
	icon.onHoverEnd(() => {
		uiState.isOverUI = false;
		hideRewardTooltip();
	});
}

function showRewardTooltip(
	reward: Reward,
	count: number,
	iconX: number
) {
	hideRewardTooltip();
	const panelWidth = 400;
	const titleFontSize = 15;
	const bodyFontSize = 11;
	const contentWidth = panelWidth - 28;
	const titleLines = Math.max(
		1,
		Math.ceil(reward.name.length / Math.floor(contentWidth / titleFontSize))
	);
	const descriptionLines = Math.max(
		1,
		Math.ceil(reward.description.length / Math.floor(contentWidth / bodyFontSize))
	);
	const titleHeight = titleLines * 17;
	const descriptionHeight = descriptionLines * 13;
	const statEntries = Object.entries(reward.stats);
	const panelHeight =
		69 + titleHeight + descriptionHeight + statEntries.length * 16;
	const panelX = k.clamp(
		iconX,
		panelWidth / 2 + 8,
		k.width() - panelWidth / 2 - 8
	);
	const panelY =
		k.height() - statusPanelHeight * HUD_SCALE - HUD_MARGIN - panelHeight / 2;
	const rarityColor = k.rgb(...REWARD_RARITY_COLORS[reward.rarity]);
	const panel = k.add([
		k.rect(panelWidth, panelHeight),
		k.pos(panelX, panelY),
		k.anchor("center"),
		k.color(0, 0, 0),
		k.opacity(0.96),
		k.outline(2, rarityColor),
		k.fixed(),
		k.layer(layers.uiEffects),
		tags.gameLoopUi,
		rewardTooltipTag,
	]);

	panel.add([
		k.text(reward.name, {
			font: "unscii",
			size: titleFontSize,
			width: contentWidth,
			align: "center",
		}),
		k.pos(0, -panelHeight / 2 + 12),
		k.anchor("top"),
		k.color(k.WHITE),
	]);

	const levelText =
		reward.levelIndex === undefined ? "" : `  LEVEL ${reward.levelIndex + 1}`;
	const metadataY = -panelHeight / 2 + 12 + titleHeight + 6;
	panel.add([
		k.text(`${reward.rarity.toUpperCase()}  x${count}${levelText}`, {
			font: "unscii",
			size: 10,
		}),
		k.pos(0, metadataY),
		k.anchor("center"),
		k.color(rarityColor),
	]);

	const descriptionY = metadataY + 22;
	panel.add([
		k.text(reward.description, {
			font: "unscii",
			size: bodyFontSize,
			width: contentWidth,
			align: "center",
		}),
		k.pos(0, descriptionY),
		k.anchor("top"),
		k.color(k.WHITE),
	]);

	const statsY = descriptionY + descriptionHeight + 12;
	panel.add([
		k.text("EFFECT", { font: "unscii", size: 10 }),
		k.pos(-panelWidth / 2 + 14, statsY),
		k.color(rarityColor),
	]);

	statEntries.forEach(([stat, value], index) => {
		panel.add([
			k.text(`${formatRewardStat(stat)}  ${value}`, {
				font: "unscii",
				size: bodyFontSize,
			}),
			k.pos(-panelWidth / 2 + 14, statsY + 18 + index * 16),
			k.color(k.WHITE),
		]);
	});
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
	phaseJumpIcon = null;
	phaseJumpCooldownBar = null;
	phaseJumpChargeLabel = null;
	shipStatusPanel = null;
	systemsPanel = null;
	runLoadoutPanel = null;
	collectedItems.clear();
}
