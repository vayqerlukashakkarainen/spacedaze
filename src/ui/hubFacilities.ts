import type { GameObj, Vec2 } from "kaplay"
import { getScore, k, layers, spendScore } from "../main"
import {
	getContractOffers,
	getSelectedContract,
	RunContract,
	selectContract,
} from "../services/progression/contractService"
import {
	getForgeLevel,
	getForgeUpgradeCost,
	getHubChestLuck,
	getHubLevel,
	getHubLevelProgress,
	getUnseenBlueprintKeys,
	isFacilityBuilt,
	isBlueprintDiscovered,
	markBlueprintsSeen,
	upgradeForge,
} from "../services/hub/hubProgressService"
import { getLastRunStats } from "../services/runs/runStatsService"
import { setNextGeneratedRunSeed } from "../levels/runMap"
import { saveGame } from "../util"
import { tags } from "../tags"
import { uiState } from "./uiState"
import {
	addThemedText,
	createUiActionButton,
	createUiCatalogBrowser,
	createUiPanel,
	createUiProgressBar,
	playUiModalClose,
	playUiModalOpen,
	createUiSectionHeader,
	createUiSelectableRow,
	createUiStatList,
	createUiSurface,
	createUiTutorialDetail,
	setUiTreeOpacity,
	getScaledLineSpacing,
	UI_COLORS,
	UI_FONT_SIZES,
} from "./common"
import {
	getPermanentUpgradeLevel,
	getEffectiveUpgradeLevel,
	getEffectiveUpgradeRarity,
	getUpgradeRequirementText,
	isToolKey,
	isPermanentUpgradeKey,
	PERMANENT_UPGRADE_KEYS,
} from "../upg"
import {
	getAllRewardDefinitions,
	getRewardDefinition,
	getRewardMinimumHubLevel,
	REWARD_RARITY_COLORS,
	RewardRarity,
	type RewardDefinition,
	type RewardSource,
} from "../services/economy/rewardService"
import {
	purchaseBurstParticleCount,
	spawnCurrencyBurst,
} from "../spawn/spawnCurrencyBurst"
import {
	getAllUpgradeDefinitions,
	getUpgradeDefinition,
} from "../upgrades/upgradeRegistry"
import type { UpgradeDefinition } from "../types/upgradeTypes"
import { isWeaponOwned, WEAPONS } from "../services/player/weaponService"
import {
	ACTIVE_MODULES,
	equipActiveModule,
	getEquippedActiveModuleId,
	type ActiveModuleId,
} from "../services/abilities/activeModuleService"
import {
	playShopMenuCloseSound,
	playShopMenuOpenSound,
} from "../services/audio/shopMenuSoundService"
import {
	getAbilityDefinition,
	getAbilitiesForSlot,
	getAbilityDiscoveryKey,
	isAbilityDiscovered,
} from "../services/abilities/abilityRegistry"
import { playRequirementErrorSound } from "../services/audio/uiSoundService"
import {
	clearAbilitySlot,
	equipAbilityInSlot,
	getEquippedAbilityId,
	type AbilityId,
	type AbilitySlot,
} from "../services/abilities/abilityLoadoutService"
import type { WarpZoneDefinition } from "../services/world/warpZoneService"
import {
	getDroidArchiveStatus,
	getDroidDefinitions,
	getDroidDiscoveryKey,
	isDroidDiscovered,
	type DroidId,
} from "../npcs/droidRegistry"
import {
	formatInputBinding,
	getInputBinding,
	type InputActionId,
} from "../services/input/inputBindingService"
import { isStrafeTrainingUnlocked } from "../services/narrative/narrativeService"
import {
	getWorldVisual,
	type WorldVisualId,
} from "../visuals/worldVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"

let panelOpen = false
let panelClosing = false
let panelCloseHandler: (() => void) | undefined
let activePanel: GameObj | undefined
let activeBackdrop: GameObj | undefined

export function hubFacilityPanelOpen() {
	return panelOpen
}

interface RunPreparationProps {
	zone: WarpZoneDefinition
	onLaunch: () => void
	onCancel: () => void
}

type RunPreparationTab = "loadout" | "contracts"

const LOADOUT_SELECTION_MAX_PAGE_SIZE = 5
const LOADOUT_SELECTION_MIN_ROW_HEIGHT = 52
const LOADOUT_SELECTION_ROW_GAP = 5

type ConfigurableLoadoutSlot = Exclude<AbilitySlot, "primary">

const LOADOUT_SLOT_DETAILS: ReadonlyArray<{
	slot: ConfigurableLoadoutSlot
	label: string
	inputAction: InputActionId
}> = [
	{ slot: "secondary", label: "SECONDARY", inputAction: "secondary" },
	{ slot: "mobility", label: "MOBILITY", inputAction: "mobility" },
	{ slot: "ultimate", label: "ULTIMATE", inputAction: "ultimate" },
]

export function showRunPreparation(props: RunPreparationProps) {
	const panelSize = k.vec2(
		Math.min(900, k.width() - 24),
		Math.min(580, k.height() - 24)
	)
	const padding = 20
	const closeButtonWidth = 180
	const deployButtonWidth = 250
	const footerButtonGap = 18
	const footerRight = panelSize.x / 2 - padding
	const deployButtonLeft = footerRight - deployButtonWidth
	const closeButtonCenterX = deployButtonLeft - footerButtonGap -
		closeButtonWidth / 2
	let launchRequested = false
	const panel = openPanel(
		undefined,
		panelSize,
		true,
		() => launchRequested ? props.onLaunch() : props.onCancel(),
		closeButtonCenterX
	)
	if (!panel) {
		props.onCancel()
		return false
	}

	const left = -panelSize.x / 2
	const top = -panelSize.y / 2
	const innerWidth = panelSize.x - padding * 2
	const tabTop = top + 62
	const contentTop = top + 108
	const contentBottom = panelSize.y / 2 - 62
	const contentHeight = contentBottom - contentTop
	const tabGap = 8
	const tabWidth = (innerWidth - tabGap) / 2
	const contractOffers = getContractOffers()
	const tabRoot = panel.add([k.pos(0, 0)])
	const contentRoot = panel.add([k.pos(0, 0)])
	let activeTab: RunPreparationTab = "loadout"
	let editingSlot: ConfigurableLoadoutSlot | undefined
	let loadoutSelectionPage = 0

	createUiSectionHeader(panel, {
		pos: k.vec2(left + 1, top + 1),
		width: panelSize.x - 2,
		height: 54,
		eyebrow: "WORMHOLE EXPEDITION GATE",
		title: "RUN CONFIGURATION",
		action: props.zone.name,
	})

	const render = () => {
		destroyChildren(tabRoot)
		destroyChildren(contentRoot)
		const tabs: ReadonlyArray<{ id: RunPreparationTab; label: string }> = [
			{ id: "loadout", label: "LOADOUT" },
			{ id: "contracts", label: "CONTRACTS" },
		]
		for (let index = 0; index < tabs.length; index++) {
			const tab = tabs[index]
			createUiActionButton(tabRoot, {
				pos: k.vec2(
					left + padding + index * (tabWidth + tabGap),
					tabTop
				),
				size: k.vec2(tabWidth, 32),
				text: tab.label,
				selected: activeTab === tab.id,
				onClick: () => {
					activeTab = tab.id
					editingSlot = undefined
					loadoutSelectionPage = 0
					render()
				},
			})
		}

		if (activeTab === "contracts") {
			renderRunTerminalContracts(
				contentRoot,
				left + padding,
				contentTop,
				innerWidth,
				contentHeight,
				contractOffers,
				(contract) => {
					selectContract(contract)
					setNextGeneratedRunSeed(contract.seed)
					render()
				}
			)
			return
		}

		if (editingSlot) {
			renderLoadoutSelection(
				contentRoot,
				left + padding,
				contentTop,
				innerWidth,
				contentHeight,
				editingSlot,
				loadoutSelectionPage,
				(page) => {
					loadoutSelectionPage = page
					render()
				},
				() => {
					editingSlot = undefined
					loadoutSelectionPage = 0
					render()
				},
				render
			)
			return
		}

		renderLoadoutSlots(
			contentRoot,
			left + padding,
			contentTop,
			innerWidth,
			contentHeight,
			props.zone,
			(slot) => {
				editingSlot = slot
				loadoutSelectionPage = getEquippedLoadoutPage(slot, contentHeight)
				render()
			}
		)
	}

	createUiActionButton(panel, {
		pos: k.vec2(deployButtonLeft, panelSize.y / 2 - 54),
		size: k.vec2(deployButtonWidth, 38),
		text: `DEPLOY  //  ${props.zone.name}`,
		primary: true,
		onClick: () => {
			launchRequested = true
			hideHubFacilityPanel()
		},
	})
	render()
	return true
}

function renderLoadoutSlots(
	root: GameObj,
	left: number,
	top: number,
	width: number,
	height: number,
	zone: WarpZoneDefinition,
	onSelectSlot: (slot: ConfigurableLoadoutSlot) => void
) {
	const previewGap = 12
	const previewWidth = Math.min(260, width * 0.31)
	const slotWidth = width - previewWidth - previewGap
	createUiSectionHeader(root, {
		pos: k.vec2(left, top),
		width: slotWidth,
		height: 48,
		eyebrow: "SHIP CONFIGURATION",
		title: "DEPLOYMENT LOADOUT",
		action: "SELECT A SLOT TO CHANGE",
	})
	const rowsTop = top + 56
	const rowGap = 7
	const rowHeight = (
		height - 56 - rowGap * (LOADOUT_SLOT_DETAILS.length - 1)
	) / LOADOUT_SLOT_DETAILS.length
	for (let index = 0; index < LOADOUT_SLOT_DETAILS.length; index++) {
		const details = LOADOUT_SLOT_DETAILS[index]
		const ability = getAbilityDefinition(getEquippedAbilityId(details.slot) as AbilityId)
		createUiSelectableRow(root, {
			pos: k.vec2(left, rowsTop + index * (rowHeight + rowGap)),
			width: slotWidth,
			height: rowHeight,
			title: ability?.name ?? "EMPTY SLOT",
			meta: `${details.label}  //  ${formatInputBinding(getInputBinding(details.inputAction))}`,
			description: ability?.description ?? "No system assigned to this slot.",
			status: "CHANGE >",
			statusColor: ability
				? REWARD_RARITY_COLORS[ability.rarity]
				: UI_COLORS.muted,
			icon: ability?.icon,
			iconText: ability ? undefined : "+",
			iconSize: Math.min(34, rowHeight - 14),
			onClick: () => onSelectSlot(details.slot),
		})
	}

	const previewLeft = left + slotWidth + previewGap
	const preview = createUiSurface(root, {
		pos: k.vec2(previewLeft, top),
		size: k.vec2(previewWidth, height),
		tone: "raised",
		borderColor: UI_COLORS.accent,
	})
	addThemedText(preview, {
		text: "RUN PREVIEW",
		pos: k.vec2(14, 14),
		variant: "eyebrow",
		width: previewWidth - 28,
	})
	addThemedText(preview, {
		text: zone.name,
		pos: k.vec2(14, 34),
		variant: "heading",
		width: previewWidth - 28,
	})
	addThemedText(preview, {
		text: zone.description,
		pos: k.vec2(14, 62),
		variant: "muted",
		width: previewWidth - 28,
	})
	const contract = getSelectedContract()
	createUiStatList(preview, {
		pos: k.vec2(14, 122),
		width: previewWidth - 28,
		rowHeight: 34,
		rows: [
			{ label: "CONTRACT", value: contract?.name ?? "NONE" },
			{
				label: "SALVAGE",
				value: `X${formatMultiplier(contract?.salvageMultiplier ?? 1)}`,
			},
			{
				label: "DROP RATE",
				value: `X${formatMultiplier(contract?.rewardDropMultiplier ?? 1)}`,
			},
			{ label: "ROUTE", value: "PROCEDURAL" },
		],
	})
	addThemedText(preview, {
		text: contract?.description ?? "NO CONTRACT MODIFIERS SELECTED.",
		pos: k.vec2(14, height - 54),
		variant: "muted",
		width: previewWidth - 28,
	})
}

function renderLoadoutSelection(
	root: GameObj,
	left: number,
	top: number,
	width: number,
	height: number,
	slot: ConfigurableLoadoutSlot,
	page: number,
	onPageChange: (page: number) => void,
	onBack: () => void,
	render: () => void
) {
	const details = LOADOUT_SLOT_DETAILS.find((candidate) => candidate.slot === slot)
	const abilities = getSelectableAbilitiesForSlot(slot)
	createUiSectionHeader(root, {
		pos: k.vec2(left, top),
		width,
		height: 48,
		eyebrow: `${details?.label ?? slot.toUpperCase()} SLOT  //  ${details ? formatInputBinding(getInputBinding(details.inputAction)) : ""}  //  ${abilities.length} AVAILABLE`,
		title: "SELECT SYSTEM",
	})
	createUiActionButton(root, {
		pos: k.vec2(left + width - 104, top + 14),
		size: k.vec2(92, 24),
		text: "< BACK",
		onClick: onBack,
	})

	const entryCount = abilities.length + 1
	const pageSize = getLoadoutSelectionPageSize(height)
	const pageCount = Math.max(
		1,
		Math.ceil(entryCount / pageSize)
	)
	const currentPage = k.clamp(Math.floor(page), 0, pageCount - 1)
	const firstEntry = currentPage * pageSize
	const visibleEntryCount = Math.min(
		pageSize,
		entryCount - firstEntry
	)
	const gap = LOADOUT_SELECTION_ROW_GAP
	const rowsTop = top + 56
	const paginationTop = top + height - 28
	const rowsBottom = paginationTop - 8
	const rowHeight = Math.min(
		58,
		(rowsBottom - rowsTop - gap * Math.max(0, visibleEntryCount - 1)) /
			Math.max(1, visibleEntryCount)
	)
	let row = 0
	if (firstEntry === 0) {
		const emptyEquipped = getEquippedAbilityId(slot) === undefined
		createUiSelectableRow(root, {
			pos: k.vec2(left, rowsTop),
			width,
			height: rowHeight,
			title: "EMPTY SLOT",
			meta: "NO SYSTEM ASSIGNED",
			status: emptyEquipped ? "EQUIPPED" : "UNEQUIP",
			selected: emptyEquipped,
			iconText: "-",
			onClick: emptyEquipped ? undefined : () => {
				clearAbilitySlot(slot)
				saveGame("slot1")
				render()
			},
		})
		row++
	}
	const firstAbility = Math.max(0, firstEntry - 1)
	const abilitySlotsOnPage = visibleEntryCount - row
	for (const ability of abilities.slice(
		firstAbility,
		firstAbility + abilitySlotsOnPage
	)) {
		const equipped = getEquippedAbilityId(slot) === ability.id
		createUiSelectableRow(root, {
			pos: k.vec2(left, rowsTop + row * (rowHeight + gap)),
			width,
			height: rowHeight,
			title: ability.name,
			meta: `${ability.rarity.toUpperCase()}  //  ${ability.trigger.toUpperCase()}`,
			description: ability.description,
			status: equipped ? "EQUIPPED" : "EQUIP",
			statusColor: equipped ? UI_COLORS.accent : UI_COLORS.text,
			selected: equipped,
			icon: ability.icon,
			iconSize: Math.min(30, rowHeight - 12),
			onClick: equipped ? undefined : () => {
				equipLoadoutAbility(slot, ability.id)
				saveGame("slot1")
				render()
			},
		})
		row++
	}

	createUiActionButton(root, {
		pos: k.vec2(left, paginationTop),
		size: k.vec2(104, 24),
		text: "< PREV",
		disabled: currentPage === 0,
		onClick: () => onPageChange(currentPage - 1),
	})
	addThemedText(root, {
		text: `PAGE ${currentPage + 1} / ${pageCount}`,
		pos: k.vec2(left + width / 2 - 70, paginationTop + 6),
		variant: "caption",
		width: 140,
		align: "center",
	})
	createUiActionButton(root, {
		pos: k.vec2(left + width - 104, paginationTop),
		size: k.vec2(104, 24),
		text: "NEXT >",
		disabled: currentPage >= pageCount - 1,
		onClick: () => onPageChange(currentPage + 1),
	})
}

function getSelectableAbilitiesForSlot(slot: ConfigurableLoadoutSlot) {
	return getAbilitiesForSlot(slot).filter(isAbilityDiscovered)
}

function getLoadoutSelectionPageSize(height: number) {
	const rowsHeight = height - 92
	return k.clamp(
		Math.floor(
			(rowsHeight + LOADOUT_SELECTION_ROW_GAP) /
				(LOADOUT_SELECTION_MIN_ROW_HEIGHT + LOADOUT_SELECTION_ROW_GAP)
		),
		1,
		LOADOUT_SELECTION_MAX_PAGE_SIZE
	)
}

function getEquippedLoadoutPage(slot: ConfigurableLoadoutSlot, height: number) {
	const equippedId = getEquippedAbilityId(slot)
	if (!equippedId) return 0
	const abilityIndex = getSelectableAbilitiesForSlot(slot).findIndex(
		(ability) => ability.id === equippedId
	)
	if (abilityIndex < 0) return 0
	const entryIndex = abilityIndex + 1
	return Math.floor(entryIndex / getLoadoutSelectionPageSize(height))
}

function equipLoadoutAbility(
	slot: ConfigurableLoadoutSlot,
	abilityId: AbilityId
) {
	if (slot === "secondary") {
		equipActiveModule(abilityId as ActiveModuleId)
		return
	}
	equipAbilityInSlot(slot, abilityId)
}

function formatMultiplier(value: number) {
	return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)
}

export function showRunTerminal(initialSection: RunTerminalSection = "contracts") {
	const panelSize = k.vec2(
		Math.min(860, k.width() - 24),
		Math.min(520, k.height() - 24)
	)
	const panel = openPanel(undefined, panelSize)
	if (!panel) return

	const left = -panelSize.x / 2
	const top = -panelSize.y / 2
	const navLeft = left + 16
	const navTop = top + 70
	const navWidth = 210
	const contentLeft = navLeft + navWidth + 12
	const contentWidth = panelSize.x - navWidth - 56
	const contentHeight = panelSize.y - 142
	let section: RunTerminalSection = initialSection
	const contractOffers = getContractOffers()

	createUiSectionHeader(panel, {
		pos: k.vec2(left + 1, top + 1),
		width: panelSize.x - 2,
		height: 54,
		eyebrow: "EXPEDITION CONTROL",
		title: "RUN TERMINAL",
		action: `HUB LVL ${getHubLevel()}  //  ${getScore()} SALVAGE`,
	})
	createUiSurface(panel, {
		pos: k.vec2(navLeft, navTop),
		size: k.vec2(navWidth, contentHeight),
	})
	createUiSurface(panel, {
		pos: k.vec2(contentLeft, navTop),
		size: k.vec2(contentWidth, contentHeight),
		borderColor: UI_COLORS.accent,
	})
	const contentRoot = panel.add([k.pos(0, 0)])

	const controls: Array<{
		section: RunTerminalSection
		setSelected: (selected: boolean) => void
		setStatus: (status: string) => void
	}> = []
	const renderContent = () => {
		destroyChildren(contentRoot)
		if (section === "contracts") {
			renderRunTerminalContracts(
				contentRoot,
				contentLeft,
				navTop,
				contentWidth,
				contentHeight,
				contractOffers
			)
			return
		}
		if (section === "forge") {
			renderRunTerminalForge(
				contentRoot,
				contentLeft,
				navTop,
				contentWidth,
				contentHeight,
				() => {
					const forgeControl = controls.find((control) => control.section === "forge")
					forgeControl?.setStatus(`LEVEL ${getForgeLevel()}/3`)
					renderContent()
				}
			)
			return
		}
		renderRunTerminalDebrief(
			contentRoot,
			contentLeft,
			navTop,
			contentWidth
		)
	}
	const selectSection = (nextSection: RunTerminalSection) => {
		section = nextSection
		for (const control of controls) {
			control.setSelected(control.section === section)
		}
		renderContent()
	}
	const stats = getLastRunStats()
	const navigation: Array<{
		section: RunTerminalSection
		facilityId: "contractTerminal" | "salvageForge" | "debriefTerminal"
		title: string
		meta: string
		status: string
	}> = [
		{
			section: "contracts",
			facilityId: "contractTerminal",
			title: "CONTRACTS",
			meta: "NEXT EXPEDITION",
			status: `${contractOffers.length} OFFERS`,
		},
		{
			section: "forge",
			facilityId: "salvageForge",
			title: "SALVAGE FORGE",
			meta: "RECOVERY SYSTEMS",
			status: `LEVEL ${getForgeLevel()}/3`,
		},
		{
			section: "debrief",
			facilityId: "debriefTerminal",
			title: "LAST RUN",
			meta: "EXPEDITION RECORD",
			status: stats ? "AVAILABLE" : "NO DATA",
		},
	].filter((item) => isFacilityBuilt(item.facilityId))
	for (let index = 0; index < navigation.length; index++) {
		const item = navigation[index]
		const control = createUiSelectableRow(panel, {
			pos: k.vec2(navLeft, navTop + index * 52),
			width: navWidth,
			height: 52,
			title: item.title,
			meta: item.meta,
			status: item.status,
			selected: item.section === section,
			onClick: () => selectSection(item.section),
		})
		controls.push({ section: item.section, ...control })
	}
	renderContent()
}

type RunTerminalSection = "contracts" | "forge" | "debrief"

function renderRunTerminalContracts(
	root: GameObj,
	left: number,
	top: number,
	width: number,
	height: number,
	offers: readonly RunContract[],
	onSelect: (contract: RunContract) => void = queueContract
) {
	const selected = getSelectedContract()
	createUiSectionHeader(root, {
		pos: k.vec2(left, top),
		width,
		height: 48,
		eyebrow: "CONTRACT ARRAY",
		title: "SELECT NEXT EXPEDITION",
		action: selected ? `QUEUED: ${selected.name}` : "AWAITING SELECTION",
	})
	const gap = 10
	const cardWidth = (width - 24 - gap * 2) / 3
	const cardHeight = height - 64
	for (let index = 0; index < offers.length; index++) {
		const contract = offers[index]
		const isSelected = selected?.id === contract.id && selected.seed === contract.seed
		const card = createUiSurface(root, {
			pos: k.vec2(left + 8 + index * (cardWidth + gap), top + 55),
			size: k.vec2(cardWidth, cardHeight),
			tone: isSelected ? "selected" : "raised",
			borderColor: isSelected ? UI_COLORS.accent : UI_COLORS.border,
		})
		addThemedText(card, {
			text: contract.name,
			pos: k.vec2(10, 12),
			variant: "heading",
			width: cardWidth - 20,
		})
		addThemedText(card, {
			text: contract.description,
			pos: k.vec2(10, 48),
			variant: "muted",
			width: cardWidth - 20,
		})
		addThemedText(card, {
			text: `SEED  ${contract.seed}`,
			pos: k.vec2(10, cardHeight - 72),
			variant: "caption",
			width: cardWidth - 20,
		})
		createUiActionButton(card, {
			pos: k.vec2(10, cardHeight - 42),
			size: k.vec2(cardWidth - 20, 30),
			text: isSelected ? "QUEUED" : "QUEUE CONTRACT",
			selected: isSelected,
			onClick: () => onSelect(contract),
		})
	}
}

function renderRunTerminalForge(
	root: GameObj,
	left: number,
	top: number,
	width: number,
	height: number,
	onUpgrade: () => void
) {
	const level = getForgeLevel()
	const cost = getForgeUpgradeCost()
	const hubProgress = getHubLevelProgress()
	createUiSectionHeader(root, {
		pos: k.vec2(left, top),
		width,
		height: 48,
		eyebrow: "RECOVERY CALIBRATION",
		title: "SALVAGE FORGE",
		action: `LEVEL ${level} / 3`,
	})
	createUiProgressBar(root, {
		pos: k.vec2(left + 16, top + 70),
		width: width - 32,
		value: level / 3,
	})
	createUiStatList(root, {
		pos: k.vec2(left + 16, top + 98),
		width: width - 32,
		rowHeight: 32,
		rows: [
			{ label: "HUB LEVEL", value: `${hubProgress.level}` },
			{ label: "CHEST LUCK", value: `+${Math.round(getHubChestLuck() * 100)}%` },
			{ label: "CURRENT DROP BONUS", value: `+${level * 15}%` },
			{ label: "NEXT CALIBRATION", value: level >= 3 ? "MAXIMUM" : "+15%" },
			{ label: "AVAILABLE SALVAGE", value: `${getScore()}` },
		],
	})
	addThemedText(root, {
		text: level >= 3
			? "REWARD RECEIVER FULLY CALIBRATED."
			: "CALIBRATE THE TERMINAL TO IMPROVE ENEMY REWARD DROP CHANCE.",
		pos: k.vec2(left + 16, top + height - 92),
		variant: level >= 3 ? "caption" : "muted",
		width: width - 32,
	})
	if (level >= 3) return
	createUiActionButton(root, {
		pos: k.vec2(left + 16, top + height - 52),
		size: k.vec2(width - 32, 34),
		text: `UPGRADE FORGE  //  ${cost} SALVAGE`,
		disabled: getScore() < cost,
		requirementsMet: getScore() >= cost,
		onDisabledClick: playRequirementErrorSound,
		onClick: () => {
			if (!spendScore(cost) || !upgradeForge()) {
				playRequirementErrorSound()
				return
			}
			spawnCurrencyBurst(k.mousePos(), {
				particleCount: purchaseBurstParticleCount(cost),
				fixed: true,
			})
			saveGame("slot1")
			onUpgrade()
		},
	})
}

function renderRunTerminalDebrief(
	root: GameObj,
	left: number,
	top: number,
	width: number
) {
	const stats = getLastRunStats()
	createUiSectionHeader(root, {
		pos: k.vec2(left, top),
		width,
		height: 48,
		eyebrow: "EXPEDITION RECORD",
		title: "POST-RUN DEBRIEF",
		action: stats ? "RECORD AVAILABLE" : "NO DATA",
	})
	if (!stats) {
		addThemedText(root, {
			text: "NO COMPLETED EXPEDITION ON RECORD.",
			pos: k.vec2(left + 16, top + 84),
			variant: "muted",
			width: width - 32,
		})
		return
	}
	const minutes = Math.floor(stats.durationSeconds / 60)
	const seconds = stats.durationSeconds % 60
	createUiStatList(root, {
		pos: k.vec2(left + 16, top + 66),
		width: width - 32,
		rowHeight: 34,
		rows: [
			{ label: "OUTCOME", value: stats.outcome },
			{ label: "CONTRACT", value: stats.contractName },
			{ label: "DURATION", value: `${minutes}:${seconds.toString().padStart(2, "0")}` },
			{ label: "HOSTILES DESTROYED", value: `${stats.kills}` },
			{ label: "SALVAGE RECOVERED", value: `${stats.salvageEarned}` },
			{ label: "SALVAGE DEPOSITED", value: `${stats.salvageDeposited ?? 0}` },
			{ label: "SALVAGE LOST", value: `${stats.salvageLost ?? 0}` },
			{ label: "REWARDS COLLECTED", value: `${stats.rewardsCollected}` },
			{ label: "HIGHEST RARITY", value: stats.highestRarity },
		],
	})
}

function destroyChildren(parent: GameObj) {
	for (const child of [...parent.children]) destroyObjectTree(child)
}

type PhaseStationTab =
	| "techniques"
	| "ship"
	| "arsenal"
	| "modules"
	| "abilities"
	| "upgrades"
	| "buildings"
	| "droids"

const PHASE_STATION_TABS: readonly {
	id: PhaseStationTab
	label: string
}[] = [
	{ id: "techniques", label: "TECHNIQUES" },
	{ id: "ship", label: "SHIP" },
	{ id: "arsenal", label: "ARSENAL" },
	{ id: "modules", label: "MODULES" },
	{ id: "abilities", label: "ABILITIES" },
	{ id: "upgrades", label: "UPGRADES" },
	{ id: "buildings", label: "BUILDINGS" },
	{ id: "droids", label: "DROIDS" },
]

interface CompendiumBuilding {
	id: string
	name: string
	category: string
	status: "INTERACT" | "COMBAT" | "SUPPORT" | "TRAVERSAL" | "HAZARD"
	visualId: WorldVisualId
	description: string
	operation: string
	fieldNote: string
}

const COMPENDIUM_BUILDINGS: readonly CompendiumBuilding[] = [
	{
		id: "salvageRelay",
		name: "SALVAGE RELAY",
		category: "RUN FACILITY",
		status: "INTERACT",
		visualId: "debris-house",
		description: "A Drius Wake deposit station rebuilt inside the Phase Daze.",
		operation: "Approach and interact to transfer carried debris into the Hub reserve.",
		fieldNote: "Deposited debris is secured for permanent spending even if the expedition is later lost.",
	},
	{
		id: "battleShrine",
		name: "BATTLE SHRINE",
		category: "CAPTURE SHRINE",
		status: "COMBAT",
		visualId: "capture-shrine",
		description: "A contested shrine that responds to a ship holding its capture field.",
		operation: "Remain inside the marked radius while the shrine charges and hostile waves phase in.",
		fieldNote: "Leaving the field drains capture progress. Timed shrines can expire while unattended.",
	},
	{
		id: "damageShrine",
		name: "DAMAGE SHRINE",
		category: "WEAPON SHRINE",
		status: "COMBAT",
		visualId: "damage-shrine",
		description: "A weapon trial that measures concentrated projectile damage.",
		operation: "Fire into the shrine and reach its damage threshold before stored charge bleeds away.",
		fieldNote: "The first hit can begin a hostile encounter. Sustained fire is more effective than scattered shots.",
	},
	{
		id: "healthShrine",
		name: "HEALTH SHRINE",
		category: "RECOVERY SHRINE",
		status: "SUPPORT",
		visualId: "health-shrine",
		description: "A medical platform that stabilizes restorative energy into health orbs.",
		operation: "Collect the three orbiting health orbs to restore hull integrity.",
		fieldNote: "The shrine is depleted once every orb has been recovered.",
	},
	{
		id: "gravityLink",
		name: "GRAVITY LINK",
		category: "TRANSIT SHRINE",
		status: "TRAVERSAL",
		visualId: "gravity-shrine",
		description: "Linked shrines that bend local gravity and fold the distance between their cores.",
		operation: "Enter one shrine core to phase-jump to another node in the network.",
		fieldNote: "Its pull affects ships, hostiles, projectiles, and loose debris before teleportation.",
	},
	{
		id: "gravityAnomaly",
		name: "GRAVITY ANOMALY",
		category: "VOID STRUCTURE",
		status: "HAZARD",
		visualId: "gravity-anomaly-shrine",
		description: "A damaged gravity shrine fused to an unstable wormhole field.",
		operation: "Account for its persistent pull when navigating, firing, or towing salvage nearby.",
		fieldNote: "Unlike a Gravity Link, the anomaly does not provide controlled transit.",
	},
]

export interface CompendiumContentBounds {
	left: number
	top: number
	width: number
	bottom: number
}

export function addCompendiumContent(
	parent: GameObj,
	bounds: CompendiumContentBounds,
	initialTab: PhaseStationTab = "techniques"
) {
	const panelLeft = bounds.left
	const innerPadding = 0
	const innerWidth = bounds.width
	const stationTabTop = bounds.top
	const contentTop = bounds.top + 44
	const contentBottom = bounds.bottom
	const tabRoot = parent.add([k.pos(0, 0)])
	const contentRoot = parent.add([k.pos(0, 0)])
	let activeTab: PhaseStationTab = initialTab
	let selectedTechniqueId = getCompendiumTechniques()
		.find((technique) => technique.discovered)?.id
	let shipPage = 0
	let selectedShipSystemKey = PERMANENT_UPGRADE_KEYS.find(
		(key) => getPermanentUpgradeLevel(key) !== undefined
	)
	let selectedWeaponId = WEAPONS.find((weapon) => isWeaponOwned(weapon.id))?.id
	let arsenalPage = 0
	let modulePage = 0
	let selectedModuleId = ACTIVE_MODULES.find((module) =>
		getEquippedActiveModuleId() === module.id ||
		isBlueprintDiscovered(`active:${module.id}`)
	)?.id
	let abilityPage = 0
	let selectedAbilityId = [
		...getAbilitiesForSlot("mobility"),
		...getAbilitiesForSlot("ultimate"),
	].find((ability) => isAbilityDiscovered(ability))?.id
	let upgradePage = 0
	let selectedUpgradeKey: string | undefined
	let selectedBuildingId = COMPENDIUM_BUILDINGS[0]?.id
	let selectedDroidId = getDroidDefinitions()
		.find((definition) => isDroidDiscovered(definition.id))?.id
	const newBlueprintKeys = new Set(getUnseenBlueprintKeys())
	const unreadTabs = new Set(
		[...newBlueprintKeys].map(getPhaseStationTabForBlueprint)
	)
	const markTabSeen = (tab: PhaseStationTab) => {
		const keys = [...newBlueprintKeys].filter(
			(key) => getPhaseStationTabForBlueprint(key) === tab
		)
		markBlueprintsSeen(keys)
		unreadTabs.delete(tab)
	}
	markTabSeen(activeTab)

	const render = () => {
		destroyChildren(tabRoot)
		destroyChildren(contentRoot)
		const availableTabs = PHASE_STATION_TABS
		const tabGap = 8
		const tabWidth = (
			innerWidth - tabGap * (availableTabs.length - 1)
		) / availableTabs.length
		availableTabs.forEach((tab, index) => {
			createUiActionButton(tabRoot, {
				pos: k.vec2(
					panelLeft + innerPadding + index * (tabWidth + tabGap),
					stationTabTop
				),
				size: k.vec2(tabWidth, 32),
				text: tab.label,
				notification: unreadTabs.has(tab.id),
				selected: activeTab === tab.id,
				onClick: () => {
					if (activeTab === tab.id) return
					activeTab = tab.id
					markTabSeen(activeTab)
					selectedUpgradeKey = undefined
					render()
				},
			})
		})

		if (activeTab === "techniques") {
			renderTechniques(
				contentRoot,
				panelLeft + innerPadding,
				innerWidth,
				contentTop,
				contentBottom,
				selectedTechniqueId,
				(id) => {
					selectedTechniqueId = id
					render()
				}
			)
		}
		if (activeTab === "ship") {
			shipPage = renderShipCatalog(
				contentRoot,
				panelLeft + innerPadding,
				innerWidth,
				contentTop,
				contentBottom,
				shipPage,
				(nextPage) => {
					shipPage = nextPage
					render()
				},
				selectedShipSystemKey,
				(key) => {
					selectedShipSystemKey = key
					render()
				},
				newBlueprintKeys
			)
		}
		if (activeTab === "arsenal") {
			arsenalPage = renderArsenal(
				contentRoot,
				panelLeft + innerPadding,
				innerWidth,
				contentTop,
				contentBottom,
				arsenalPage,
				(nextPage) => {
					arsenalPage = nextPage
					render()
				},
				selectedWeaponId,
				(id) => {
					selectedWeaponId = id
					render()
				},
				newBlueprintKeys
			)
		}
		if (activeTab === "modules") {
			modulePage = renderModuleCatalog(
				contentRoot,
				panelLeft + innerPadding,
				innerWidth,
				contentTop,
				contentBottom,
				modulePage,
				(nextPage) => {
					modulePage = nextPage
					render()
				},
				selectedModuleId,
				(id) => {
					selectedModuleId = id
					render()
				},
				newBlueprintKeys
			)
		}
		if (activeTab === "abilities") {
			abilityPage = renderAbilityCatalog(
				contentRoot,
				panelLeft + innerPadding,
				innerWidth,
				contentTop,
				contentBottom,
				abilityPage,
				(nextPage) => {
					abilityPage = nextPage
					render()
				},
				selectedAbilityId,
				(id) => {
					selectedAbilityId = id
					render()
				},
				newBlueprintKeys
			)
		}
		if (activeTab === "upgrades") {
			upgradePage = renderUnifiedUpgradeCatalog(
				contentRoot,
				panelLeft + innerPadding,
				innerWidth,
				contentTop,
				contentBottom,
				upgradePage,
				(nextPage) => {
					upgradePage = nextPage
					render()
				},
				selectedUpgradeKey,
				(toolKey) => {
					selectedUpgradeKey = toolKey
					render()
				},
				newBlueprintKeys,
			)
		}
		if (activeTab === "buildings") {
			renderBuildingArchive(
				contentRoot,
				panelLeft + innerPadding,
				innerWidth,
				contentTop,
				contentBottom,
				selectedBuildingId,
				(id) => {
					selectedBuildingId = id
					render()
				}
			)
		}
		if (activeTab === "droids") {
			renderDroidArchive(
				contentRoot,
				panelLeft + innerPadding,
				innerWidth,
				contentTop,
				contentBottom,
				selectedDroidId,
				(id) => {
					selectedDroidId = id
					render()
				},
				newBlueprintKeys
			)
		}
	}

	render()
}

function getPhaseStationTabForBlueprint(key: string): PhaseStationTab {
	if (key.startsWith("technique:")) return "techniques"
	if (key.startsWith("droid:")) return "droids"
	if (key.startsWith("weapon:")) return "arsenal"
	if (key.startsWith("active:")) return "modules"
	if (key.startsWith("mobility:") || key.startsWith("ultimate:")) {
		return "abilities"
	}
	if (PERMANENT_UPGRADE_KEYS.some((upgradeKey) => upgradeKey === key)) {
		return "ship"
	}
	return "upgrades"
}

const REWARD_SOURCE_UNLOCK_LABELS: Readonly<Record<RewardSource, string>> = {
	crate: "CHEST",
	enemy: "ENEMY",
	boss: "BOSS",
}

function formatUnlockList(items: readonly string[]) {
	if (items.length <= 1) return items[0] ?? ""
	if (items.length === 2) return `${items[0]} OR ${items[1]}`
	return `${items.slice(0, -1).join(", ")}, OR ${items.at(-1)}`
}

function getRewardUnlockRequirement(
	definition: RewardDefinition | undefined,
	additionalRequirement?: string
) {
	const requirements: string[] = []
	const minimumHubLevel = definition
		? getRewardMinimumHubLevel(definition)
		: 1
	if (getHubLevel() < minimumHubLevel) {
		requirements.push(`HUB LEVEL ${minimumHubLevel}`)
	}
	if (additionalRequirement) {
		requirements.push(additionalRequirement.toUpperCase())
	}
	const sources = definition?.allowedSources.filter(
		(source) => (definition.weights[source] ?? 0) > 0
	) ?? []
	if (sources.length > 0) {
		requirements.push(
			`${formatUnlockList(sources.map(
				(source) => REWARD_SOURCE_UNLOCK_LABELS[source]
			))} DROP`
		)
	} else if (requirements.length === 0) {
		requirements.push("EXPEDITION DISCOVERY")
	}
	return requirements.join(" + ")
}

function getDroidUnlockRequirement(id: DroidId) {
	switch (id) {
		case "ring-runner":
			return "COMPLETE THE ASTEROID RUNNER ENCOUNTER"
		case "ring-watcher":
			return "COMPLETE THE RANGE KEEPER ENCOUNTER IN THE HUB"
		case "lamp-keeper":
			return "COMPLETE THE LAMP KEEPER ENCOUNTER IN THE HUB"
		case "gloom":
		case "jubilee":
			return "DISCOVER THE BIRTHDAY ENCOUNTER IN THE HUB"
	}
}

interface CompendiumTechnique {
	id: string
	name: string
	category: string
	description: string
	howText: string
	discovered: boolean
	unlockRequirement?: string
	tipText?: string
	strafeModifier?: string
	noteTitle?: string
	noteText?: string
	input?: string
	inputAction?: string
	previewVideo?: string
}

function getCompendiumTechniques(): CompendiumTechnique[] {
	return [
		{
			id: "normalFlight",
			name: "NORMAL FLIGHT",
			category: "MOVEMENT",
			description: "Turn the hull toward the cursor and thrust along the ship's facing direction.",
			howText: "Aim with the cursor. Use movement input to accelerate, brake, and carve through open space.",
			previewVideo: "videos/normal-flight-preview.mp4",
			discovered: true,
		},
		{
			id: "hubLevel",
			name: "HUB LEVEL",
			category: "PROGRESSION",
			description: "Permanent station progress earned by securing salvage from expeditions.",
			howText: `Deposit salvage at relays or extract safely. Secured salvage raises the Hub Level. Current Hub Level: ${getHubLevel()}.`,
			tipText: "Higher Hub Levels unlock facilities, increase chest luck, and expand the rewards that can drop.",
			noteTitle: "PERSISTENCE",
			noteText: "Hub Level is permanent and does not reset between expeditions.",
			discovered: true,
		},
		{
			id: "strafeMode",
			name: "STRAFE MODE",
			category: "SHIP ORIENTATION",
			description: "Keep the hull oriented while moving independently around a target.",
			howText: "Press Space to toggle strafe control. Aim with the cursor while movement input translates the ship independently.",
			tipText: "Keep the cursor over the reticle to increase critical hit chance.",
			strafeModifier: "Movement decouples from hull orientation.",
			input: "SPACE",
			inputAction: "TOGGLE",
			discovered: isStrafeTrainingUnlocked(),
			unlockRequirement: "COMPLETE BURT'S STRAFE TRAINING",
		},
		{
			id: "salvageLasso",
			name: "LASSO TECHNIQUES",
			category: "SALVAGE COMBAT",
			description: "Ensnare loose objects, tow them behind the ship, or turn their momentum into a weapon.",
			howText: "Cast near a chest, mine, fuel cell, movable cover, or ship part. Move to build tension, then cast again to release. Speed and mass increase slam damage.",
			strafeModifier: "Releasing the lasso launches its target directly toward the reticle.",
			input: formatInputBinding(getInputBinding("lasso")),
			inputAction: "CAST / RELEASE",
			discovered: getPermanentUpgradeLevel("salvageLasso") !== undefined,
			unlockRequirement: getRewardUnlockRequirement(
				getRewardDefinition("salvageLasso")
			),
		},
		{
			id: "explosiveObjects",
			name: "EXPLOSIVE OBJECTS",
			category: "ENVIRONMENT",
			description: "Volatile objects damage anything caught inside their blast radius, including you.",
			howText: "Shoot volatile cargo when hostiles move close. Knockback can reposition an explosive before detonation.",
			discovered: getHubLevel() >= 2,
			unlockRequirement: "REACH HUB LEVEL 2",
		},
		{
			id: "destroyableParts",
			name: "DESTROYABLE PARTS",
			category: "COMBAT",
			description: "Exposed ship components can be destroyed separately from the main hull.",
			howText: "Target exposed ship components before breaking the hull. Destroyed parts detach, drop salvage, and can trigger a damaging explosion.",
			discovered: true,
		},
		{
			id: "chargedWeapons",
			name: "CHARGED WEAPONS",
			category: "COMBAT",
			description: "Charge-capable weapons exchange firing speed for stronger projectile properties.",
			howText: "Hold primary fire to build charge, then release. Damage, speed, size, or penetration depend on the weapon.",
			input: "MOUSE 1",
			inputAction: "HOLD + RELEASE",
			discovered: WEAPONS.some((weapon) =>
				isWeaponOwned(weapon.id) && weapon.charge !== undefined
			),
			unlockRequirement: "RECOVER A CHARGE-CAPABLE PRIMARY WEAPON",
		},
		{
			id: "activeModules",
			name: "ACTIVE MODULES",
			category: "SECONDARY",
			description: "Secondary modules provide powerful actions governed by a cooldown.",
			howText: "Use the equipped module with its bound input. Watch its role and cooldown before committing.",
			input: formatInputBinding(getInputBinding("secondary")),
			inputAction: "ACTIVATE",
			discovered: ACTIVE_MODULES.some((module) =>
				getEquippedActiveModuleId() === module.id ||
				isBlueprintDiscovered(`active:${module.id}`)
			),
			unlockRequirement: "RECOVER AN ACTIVE MODULE",
		},
		{
			id: "lockedRooms",
			name: "LOCKED ROOMS + KEYS",
			category: "NAVIGATION",
			description: "Treasure rooms and shops can require a recovered phase key.",
			howText: "Recover keys from cleared rooms and enemies. Unlocking a room opens every linked path into it.",
			input: "F",
			inputAction: "UNLOCK",
			discovered: getHubLevel() >= 2,
			unlockRequirement: "REACH HUB LEVEL 2",
		},
	]
}

function renderTechniques(
	root: GameObj,
	left: number,
	width: number,
	top: number,
	bottom: number,
	selectedId: string | undefined,
	onSelect: (id: string) => void
) {
	const techniques = getCompendiumTechniques()
	const selected = techniques.find((entry) =>
		entry.id === selectedId && entry.discovered
	) ?? techniques.find((entry) => entry.discovered)
	const browser = createUiCatalogBrowser(root, {
		pos: k.vec2(left, top),
		size: k.vec2(width, bottom - top),
		meta: `${techniques.filter((technique) => technique.discovered).length} / ${techniques.length} DISCOVERED`,
		listWidth: Math.min(360, width * 0.34),
	})
	const rowGap = 4
	const rowHeight = Math.min(
		64,
		(bottom - top - browser.rowsTop - rowGap * Math.max(0, techniques.length - 1)) /
			Math.max(1, techniques.length)
	)
	techniques.forEach((technique, index) => {
		createUiSelectableRow(browser.root, {
			pos: k.vec2(0, browser.rowsTop + index * (rowHeight + rowGap)),
			width: browser.listWidth,
			height: rowHeight,
			title: technique.discovered
				? technique.name
				: "UNDISCOVERED TECHNIQUE",
			meta: technique.discovered
				? `${technique.category}  //  DISCOVERED`
				: "UNKNOWN  //  UNDISCOVERED",
			iconText: technique.discovered ? technique.name.slice(0, 1) : "?",
			iconSize: 28,
			selected: technique.discovered && selected?.id === technique.id,
			status: technique.discovered ? ">" : "?",
			disabled: !technique.discovered,
			onClick: technique.discovered
				? () => onSelect(technique.id)
				: undefined,
		})
	})
	if (!selected) return
	createUiTutorialDetail(browser.root, {
		pos: k.vec2(browser.detailLeft, 0),
		size: k.vec2(browser.detailWidth, browser.detailHeight),
		title: selected.name,
		howTitle: "HOW IT WORKS",
		howText: selected.howText.toUpperCase(),
		tipTitle: selected.tipText ? "TIP" : undefined,
		tipText: selected.tipText?.toUpperCase(),
		inputPrompts: selected.id === "normalFlight"
			? [
				{ action: "move", label: "MOVE" },
				{ action: "lock", label: "TOGGLE STRAFE" },
			]
			: selected.id === "destroyableParts"
				? [{ action: "fire", label: "TARGET PARTS" }]
				: undefined,
		noteTitle: selected.noteTitle ?? "STRAFE MODIFIER",
		noteText: (
			selected.noteText ??
			selected.strafeModifier ??
			"No strafe modifier"
		).toUpperCase(),
		input: selected.input,
		inputAction: selected.inputAction,
		videoUrl: selected.previewVideo,
	})
}

function renderBuildingArchive(
	root: GameObj,
	left: number,
	width: number,
	top: number,
	bottom: number,
	selectedBuildingId: string | undefined,
	onSelect: (id: string) => void
) {
	const selected = COMPENDIUM_BUILDINGS.find(
		(building) => building.id === selectedBuildingId
	) ?? COMPENDIUM_BUILDINGS[0]
	const listWidth = Math.min(320, width * 0.38)
	const columnGap = 12
	const detailLeft = left + listWidth + columnGap
	const detailWidth = width - listWidth - columnGap
	const detailHeight = bottom - top
	const rowsTop = top + 24
	const rowGap = 5
	const rowHeight = Math.min(
		68,
		(detailHeight - 24 - rowGap * (COMPENDIUM_BUILDINGS.length - 1)) /
			COMPENDIUM_BUILDINGS.length
	)

	addThemedText(root, {
		text: `STRUCTURE RECORDS  //  ${COMPENDIUM_BUILDINGS.length} CATALOGUED`,
		pos: k.vec2(left, top),
		variant: "eyebrow",
		width: listWidth,
	})
	COMPENDIUM_BUILDINGS.forEach((building, index) => {
		const sprite = requirePrimaryVisualSprite(getWorldVisual(building.visualId))
		const statusColor = building.status === "SUPPORT"
			? UI_COLORS.success
			: building.status === "COMBAT"
				? UI_COLORS.danger
				: building.status === "HAZARD"
					? UI_COLORS.warning
					: UI_COLORS.accent
		createUiSelectableRow(root, {
			pos: k.vec2(left, rowsTop + index * (rowHeight + rowGap)),
			width: listWidth,
			height: rowHeight,
			title: building.name,
			meta: building.category,
			status: building.status,
			statusColor,
			icon: sprite,
			iconSize: 34,
			selected: selected?.id === building.id,
			onClick: () => onSelect(building.id),
		})
	})

	const detail = createUiSurface(root, {
		pos: k.vec2(detailLeft, top),
		size: k.vec2(detailWidth, detailHeight),
		tone: "raised",
	})
	if (!selected) return

	const selectedSprite = requirePrimaryVisualSprite(
		getWorldVisual(selected.visualId)
	)
	const selectedStatusColor = selected.status === "SUPPORT"
		? UI_COLORS.success
		: selected.status === "COMBAT"
			? UI_COLORS.danger
			: selected.status === "HAZARD"
				? UI_COLORS.warning
				: UI_COLORS.accent
	detail.add([
		k.sprite(selectedSprite, { width: 84, height: 84 }),
		k.pos(62, 60),
		k.anchor("center"),
		k.color(k.WHITE),
	])
	addThemedText(detail, {
		text: selected.name,
		pos: k.vec2(120, 18),
		variant: "heading",
		width: detailWidth - 138,
	})
	addThemedText(detail, {
		text: selected.category,
		pos: k.vec2(120, 44),
		variant: "eyebrow",
		width: detailWidth - 138,
	})
	addThemedText(detail, {
		text: `STATUS  //  ${selected.status}`,
		pos: k.vec2(120, 68),
		variant: "caption",
		width: detailWidth - 138,
		color: k.rgb(...selectedStatusColor),
	})
	addThemedText(detail, {
		text: "FUNCTION",
		pos: k.vec2(18, 122),
		variant: "eyebrow",
		width: detailWidth - 36,
	})
	addThemedText(detail, {
		text: selected.description,
		pos: k.vec2(18, 148),
		variant: "body",
		width: detailWidth - 36,
		lineHeight: 1.3,
	})
	addThemedText(detail, {
		text: "OPERATION",
		pos: k.vec2(18, 230),
		variant: "eyebrow",
		width: detailWidth - 36,
	})
	addThemedText(detail, {
		text: selected.operation,
		pos: k.vec2(18, 256),
		variant: "body",
		width: detailWidth - 36,
		lineHeight: 1.3,
	})
	addThemedText(detail, {
		text: "FIELD NOTE",
		pos: k.vec2(18, 338),
		variant: "eyebrow",
		width: detailWidth - 36,
	})
	addThemedText(detail, {
		text: `> ${selected.fieldNote}`,
		pos: k.vec2(18, 364),
		variant: "muted",
		width: detailWidth - 36,
		lineHeight: 1.35,
	})
}

function renderDroidArchive(
	root: GameObj,
	left: number,
	width: number,
	top: number,
	bottom: number,
	selectedDroidId: DroidId | undefined,
	onSelect: (id: DroidId) => void,
	newBlueprintKeys: ReadonlySet<string>
) {
	const definitions = getDroidDefinitions()
	const listWidth = Math.min(286, width * 0.4)
	const columnGap = 12
	const detailLeft = left + listWidth + columnGap
	const detailWidth = width - listWidth - columnGap
	const detailHeight = bottom - top

	addThemedText(root, {
		text: `DROID RECORDS  //  ${definitions.filter((definition) => isDroidDiscovered(definition.id)).length} / ${definitions.length} DISCOVERED`,
		pos: k.vec2(left, top),
		variant: "eyebrow",
		width: listWidth,
	})
	const rowsTop = top + 24
	definitions.forEach((definition, index) => {
		const discovered = isDroidDiscovered(definition.id)
		const discoveryKey = getDroidDiscoveryKey(definition.id)
		const unlockRequirement = getDroidUnlockRequirement(definition.id)
		createUiSelectableRow(root, {
			pos: k.vec2(left, rowsTop + index * 74),
			width: listWidth,
			height: 68,
			title: discovered ? definition.name : "UNIDENTIFIED DROID",
			meta: discovered ? definition.model : "LOCKED RECORD",
			description: discovered
				? undefined
				: `UNLOCK: ${unlockRequirement}`,
			status: discovered ? getDroidArchiveStatus(definition.id) : "LOCKED",
			statusColor: discovered ? UI_COLORS.accent : UI_COLORS.danger,
			icon: discovered ? definition.sprite : undefined,
			iconText: discovered ? undefined : "?",
			iconSize: 34,
			notification: discovered && newBlueprintKeys.has(discoveryKey),
			selected: discovered && definition.id === selectedDroidId,
			disabled: !discovered,
			onClick: discovered ? () => onSelect(definition.id) : undefined,
		})
	})

	const selected = selectedDroidId
		? definitions.find((definition) => definition.id === selectedDroidId)
		: undefined
	const detail = createUiSurface(root, {
		pos: k.vec2(detailLeft, top),
		size: k.vec2(detailWidth, detailHeight),
		tone: "raised",
	})
	if (!selected || !isDroidDiscovered(selected.id)) {
		addThemedText(detail, {
			text: "NO DROID RECORD SELECTED",
			pos: k.vec2(18, 18),
			variant: "heading",
			width: detailWidth - 36,
		})
		addThemedText(detail, {
			text: "LOCKED RECORDS LIST THEIR DISCOVERY REQUIREMENTS ON THE LEFT.",
			pos: k.vec2(18, 48),
			variant: "muted",
			width: detailWidth - 36,
			lineHeight: 1.3,
		})
		return
	}

	detail.add([
		k.sprite(selected.sprite, { width: 72, height: 72 }),
		k.pos(54, 58),
		k.anchor("center"),
		k.color(k.WHITE),
	])
	addThemedText(detail, {
		text: selected.name,
		pos: k.vec2(104, 18),
		variant: "heading",
		width: detailWidth - 122,
	})
	addThemedText(detail, {
		text: `${selected.model}  //  ${selected.role}`,
		pos: k.vec2(104, 44),
		variant: "eyebrow",
		width: detailWidth - 122,
	})
	addThemedText(detail, {
		text: `STATUS  //  ${getDroidArchiveStatus(selected.id)}`,
		pos: k.vec2(104, 68),
		variant: "caption",
		width: detailWidth - 122,
		color: k.rgb(...UI_COLORS.accent),
	})
	addThemedText(detail, {
		text: "ARCHIVE SUMMARY",
		pos: k.vec2(18, 112),
		variant: "eyebrow",
		width: detailWidth - 36,
	})
	addThemedText(detail, {
		text: selected.summary,
		pos: k.vec2(18, 138),
		variant: "body",
		width: detailWidth - 36,
		lineHeight: 1.3,
	})
	addThemedText(detail, {
		text: "FIELD NOTES",
		pos: k.vec2(18, 202),
		variant: "eyebrow",
		width: detailWidth - 36,
	})
	addThemedText(detail, {
		text: selected.archiveNotes.map((note) => `> ${note}`).join("\n\n"),
		pos: k.vec2(18, 228),
		variant: "muted",
		width: detailWidth - 36,
		lineHeight: 1.35,
	})
}

const COMPENDIUM_CATALOG_LIST_WIDTH_RATIO = 0.34
const COMPENDIUM_CATALOG_LIST_WIDTH_MAX = 360
const COMPENDIUM_CATALOG_ROW_GAP = 4
const COMPENDIUM_CATALOG_ROW_HEIGHT_MAX = 64
const COMPENDIUM_CATALOG_ROW_HEIGHT_MIN = 60
const COMPENDIUM_CATALOG_ROWS_TOP = 48

function createPageableCompendiumCatalog(
	root: GameObj,
	left: number,
	width: number,
	top: number,
	bottom: number,
	meta: string,
	entryCount: number,
	requestedPage: number,
	onPageChange: (page: number) => void
) {
	const availableRowsHeight = Math.max(
		COMPENDIUM_CATALOG_ROW_HEIGHT_MIN,
		bottom - top - COMPENDIUM_CATALOG_ROWS_TOP
	)
	const pageSize = Math.max(
		1,
		Math.floor(
			(availableRowsHeight + COMPENDIUM_CATALOG_ROW_GAP) /
				(COMPENDIUM_CATALOG_ROW_HEIGHT_MIN + COMPENDIUM_CATALOG_ROW_GAP)
		)
	)
	const pageCount = Math.max(
		1,
		Math.ceil(entryCount / pageSize)
	)
	const page = k.clamp(requestedPage, 0, pageCount - 1)
	const pageStart = page * pageSize
	const pageEnd = (page + 1) * pageSize
	const visibleCount = Math.max(
		1,
		Math.min(pageSize, entryCount - pageStart)
	)
	const browser = createUiCatalogBrowser(root, {
		pos: k.vec2(left, top),
		size: k.vec2(width, bottom - top),
		meta: `${meta}  //  PAGE ${page + 1} / ${pageCount}`,
		metaRightInset: 88,
		listWidth: Math.min(
			COMPENDIUM_CATALOG_LIST_WIDTH_MAX,
			width * COMPENDIUM_CATALOG_LIST_WIDTH_RATIO
		),
	})
	createUiActionButton(browser.root, {
		pos: k.vec2(browser.listWidth - 76, 10),
		size: k.vec2(34, 20),
		text: "<",
		disabled: page === 0,
		onClick: () => onPageChange(page - 1),
	})
	createUiActionButton(browser.root, {
		pos: k.vec2(browser.listWidth - 36, 10),
		size: k.vec2(34, 20),
		text: ">",
		disabled: page >= pageCount - 1,
		onClick: () => onPageChange(page + 1),
	})
	const rowHeight = Math.min(
		COMPENDIUM_CATALOG_ROW_HEIGHT_MAX,
		(
			bottom - top - browser.rowsTop -
			COMPENDIUM_CATALOG_ROW_GAP * (visibleCount - 1)
		) / visibleCount
	)
	return {
		...browser,
		page,
		pageSize,
		pageStart,
		pageEnd,
		rowHeight,
		rowGap: COMPENDIUM_CATALOG_ROW_GAP,
	}
}

function renderShipCatalog(
	root: GameObj,
	left: number,
	width: number,
	top: number,
	bottom: number,
	requestedPage: number,
	onPageChange: (page: number) => void,
	selectedKey: typeof PERMANENT_UPGRADE_KEYS[number] | undefined,
	onSelect: (key: typeof PERMANENT_UPGRADE_KEYS[number]) => void,
	newBlueprintKeys: ReadonlySet<string>
) {
	const entries = PERMANENT_UPGRADE_KEYS.map((key) => ({
		key,
		definition: getUpgradeDefinition(key),
		level: getPermanentUpgradeLevel(key),
	})).filter((entry) => entry.definition !== undefined)
	const ownedEntries = entries.filter((entry) => entry.level !== undefined)
	const selected = entries.find((entry) =>
		entry.key === selectedKey && entry.level !== undefined
	) ?? ownedEntries[0]
	const catalog = createPageableCompendiumCatalog(
		root,
		left,
		width,
		top,
		bottom,
		`${ownedEntries.length} / ${entries.length} UNLOCKED`,
		entries.length,
		requestedPage,
		onPageChange
	)
	entries.slice(catalog.pageStart, catalog.pageEnd).forEach((entry, index) => {
		const definition = entry.definition
		if (!definition) return
		const owned = entry.level !== undefined
		const level = owned ? entry.level + 1 : 0
		const unlockRequirement = getRewardUnlockRequirement(
			getRewardDefinition(entry.key),
			getUpgradeRequirementText(entry.key)
		)
		createUiSelectableRow(catalog.root, {
			pos: k.vec2(
				0,
				catalog.rowsTop + index * (catalog.rowHeight + catalog.rowGap)
			),
			width: catalog.listWidth,
			height: catalog.rowHeight,
			title: owned ? definition.toolName.toUpperCase() : "UNKNOWN SYSTEM",
			meta: owned
				? `PERMANENT  //  LEVEL ${level} / ${definition.levels.length}`
				: "LOCKED SHIP RECORD",
			description: owned ? undefined : `UNLOCK: ${unlockRequirement}`,
			status: owned ? ">" : "LOCKED",
			statusColor: owned ? undefined : UI_COLORS.danger,
			icon: owned ? definition.levels[0]?.sprite : undefined,
			iconText: owned ? undefined : "?",
			iconSize: 30,
			notification: owned && newBlueprintKeys.has(entry.key),
			selected: owned && selected?.key === entry.key,
			disabled: !owned,
			onClick: owned ? () => onSelect(entry.key) : undefined,
		})
	})
	if (selected?.definition && selected.level !== undefined) {
		const definition = selected.definition
		const currentLevel = definition.levels[selected.level]
		const nextLevel = definition.levels[selected.level + 1]
		createUiTutorialDetail(catalog.root, {
			pos: k.vec2(catalog.detailLeft, 0),
			size: k.vec2(catalog.detailWidth, catalog.detailHeight),
			recordLabel: `SHIP SYSTEM  //  ${String(entries.indexOf(selected) + 1).padStart(2, "0")}`,
			title: definition.toolName.toUpperCase(),
			description: currentLevel?.desc.toUpperCase(),
			howTitle: "CURRENT EFFECT",
			howText: (currentLevel?.desc ?? "SYSTEM ACTIVE").toUpperCase(),
			noteTitle: nextLevel ? "NEXT LEVEL" : "SYSTEM STATUS",
			noteText: nextLevel
				? nextLevel.desc.toUpperCase()
				: "MAXIMUM LEVEL REACHED",
			icon: definition.levels[0]?.sprite,
			videoFooter: "PERMANENT SHIP SYSTEM",
			showRecording: false,
		})
	} else renderEmptyCatalogDetail(catalog, "SHIP SYSTEM")
	return catalog.page
}

function renderModuleCatalog(
	root: GameObj,
	left: number,
	width: number,
	top: number,
	bottom: number,
	requestedPage: number,
	onPageChange: (page: number) => void,
	selectedId: ActiveModuleId | undefined,
	onSelect: (id: ActiveModuleId) => void,
	newBlueprintKeys: ReadonlySet<string>
) {
	const equippedModuleId = getEquippedActiveModuleId()
	const discoveredModules = ACTIVE_MODULES.filter((module) =>
		equippedModuleId === module.id ||
		isBlueprintDiscovered(`active:${module.id}`)
	)
	const selected = discoveredModules.find((module) => module.id === selectedId) ??
		discoveredModules[0]
	const catalog = createPageableCompendiumCatalog(
		root,
		left,
		width,
		top,
		bottom,
		`${discoveredModules.length} / ${ACTIVE_MODULES.length} DISCOVERED`,
		ACTIVE_MODULES.length,
		requestedPage,
		onPageChange
	)
	ACTIVE_MODULES.slice(catalog.pageStart, catalog.pageEnd).forEach(
		(module, index) => {
			const discoveryKey = `active:${module.id}`
			const discovered = equippedModuleId === module.id ||
				isBlueprintDiscovered(discoveryKey)
			const equipped = equippedModuleId === module.id
			const unlockRequirement = getRewardUnlockRequirement(
				getRewardDefinition(discoveryKey)
			)
			createUiSelectableRow(catalog.root, {
				pos: k.vec2(
					0,
					catalog.rowsTop + index * (catalog.rowHeight + catalog.rowGap)
				),
				width: catalog.listWidth,
				height: catalog.rowHeight,
				title: discovered ? module.name : "UNKNOWN MODULE",
				meta: discovered
					? `${module.rarity.toUpperCase()}  //  ${module.cooldown}S COOLDOWN`
					: "LOCKED ACTIVE RECORD",
				description: discovered ? undefined : `UNLOCK: ${unlockRequirement}`,
				status: discovered ? equipped ? "EQUIPPED" : ">" : "LOCKED",
				statusColor: equipped ? UI_COLORS.accent : discovered
					? undefined
					: UI_COLORS.danger,
				icon: discovered ? module.icon : undefined,
				iconText: discovered ? undefined : "?",
				iconSize: 30,
				notification: discovered && newBlueprintKeys.has(discoveryKey),
				selected: discovered && selected?.id === module.id,
				disabled: !discovered,
				onClick: discovered ? () => onSelect(module.id) : undefined,
			})
		}
	)
	if (selected) {
		createUiTutorialDetail(catalog.root, {
			pos: k.vec2(catalog.detailLeft, 0),
			size: k.vec2(catalog.detailWidth, catalog.detailHeight),
			recordLabel: `ACTIVE MODULE  //  ${String(ACTIVE_MODULES.indexOf(selected) + 1).padStart(2, "0")}`,
			title: selected.name,
			description: selected.description.toUpperCase(),
			howTitle: "HOW TO USE",
			howText: `ACTIVATE THE MODULE, THEN WAIT ${selected.cooldown} SECONDS FOR IT TO RECOVER.`,
			noteTitle: "MODULE PROFILE",
			noteText: formatCatalogStats(selected.stats),
			input: formatInputBinding(getInputBinding("secondary")),
			inputAction: "ACTIVATE",
			icon: selected.icon,
			videoFooter: "ACTIVE MODULE DEMONSTRATION",
			showRecording: false,
		})
	} else renderEmptyCatalogDetail(catalog, "ACTIVE MODULE")
	return catalog.page
}

function renderAbilityCatalog(
	root: GameObj,
	left: number,
	width: number,
	top: number,
	bottom: number,
	requestedPage: number,
	onPageChange: (page: number) => void,
	selectedId: AbilityId | undefined,
	onSelect: (id: AbilityId) => void,
	newBlueprintKeys: ReadonlySet<string>
) {
	const entries = [
		...getAbilitiesForSlot("mobility"),
		...getAbilitiesForSlot("ultimate"),
	]
	const discoveredEntries = entries.filter(isAbilityDiscovered)
	const selected = discoveredEntries.find((ability) => ability.id === selectedId) ??
		discoveredEntries[0]
	const catalog = createPageableCompendiumCatalog(
		root,
		left,
		width,
		top,
		bottom,
		`${discoveredEntries.length} / ${entries.length} DISCOVERED`,
		entries.length,
		requestedPage,
		onPageChange
	)
	entries.slice(catalog.pageStart, catalog.pageEnd).forEach((ability, index) => {
		const discoveryKey = getAbilityDiscoveryKey(ability)
		const discovered = isAbilityDiscovered(ability)
		const equipped = getEquippedAbilityId(ability.slot) === ability.id
		const unlockRequirement = getRewardUnlockRequirement(
			getRewardDefinition(discoveryKey)
		)
		createUiSelectableRow(catalog.root, {
			pos: k.vec2(
				0,
				catalog.rowsTop + index * (catalog.rowHeight + catalog.rowGap)
			),
			width: catalog.listWidth,
			height: catalog.rowHeight,
			title: discovered ? ability.name : "UNKNOWN ABILITY",
			meta: discovered
				? `${ability.slot.toUpperCase()}  //  ${ability.rarity.toUpperCase()}`
				: "LOCKED ABILITY RECORD",
			description: discovered ? undefined : `UNLOCK: ${unlockRequirement}`,
			status: discovered ? equipped ? "EQUIPPED" : ">" : "LOCKED",
			statusColor: equipped ? UI_COLORS.accent : discovered
				? undefined
				: UI_COLORS.danger,
			icon: discovered ? ability.icon : undefined,
			iconText: discovered ? undefined : "?",
			iconSize: 30,
			notification: discovered && newBlueprintKeys.has(discoveryKey),
			selected: discovered && selected?.id === ability.id,
			disabled: !discovered,
			onClick: discovered ? () => onSelect(ability.id) : undefined,
		})
	})
	if (selected) {
		createUiTutorialDetail(catalog.root, {
			pos: k.vec2(catalog.detailLeft, 0),
			size: k.vec2(catalog.detailWidth, catalog.detailHeight),
			recordLabel: `${selected.slot.toUpperCase()} ABILITY  //  ${String(entries.indexOf(selected) + 1).padStart(2, "0")}`,
			title: selected.name,
			description: selected.description.toUpperCase(),
			howTitle: "HOW TO USE",
			howText: `${selected.trigger.toUpperCase()} THE ABILITY INPUT. ${formatAbilityResource(selected.resource)}`,
			noteTitle: "ABILITY PROFILE",
			noteText: `${selected.rarity.toUpperCase()}  //  ${selected.tags.join("  //  ").toUpperCase()}`,
			input: formatInputBinding(getInputBinding(selected.slot)),
			inputAction: selected.trigger.toUpperCase(),
			icon: selected.icon,
			videoFooter: "ABILITY DEMONSTRATION",
			showRecording: false,
		})
	} else renderEmptyCatalogDetail(catalog, "ABILITY")
	return catalog.page
}

type CompendiumUpgradeEntry =
	| { kind: "upgrade"; id: string; definition: UpgradeDefinition }
	| { kind: "reward"; id: string; definition: RewardDefinition }

function getCompendiumUpgradeEntries(): CompendiumUpgradeEntry[] {
	const upgrades = getAllUpgradeDefinitions()
		.filter((definition) =>
			!isToolKey(definition.toolKey) ||
			!isPermanentUpgradeKey(definition.toolKey)
		)
		.sort((a, b) =>
			a.category.localeCompare(b.category) ||
			a.toolName.localeCompare(b.toolName)
		)
		.map((definition) => ({
			kind: "upgrade" as const,
			id: definition.toolKey,
			definition,
		}))
	const rewards = getAllRewardDefinitions()
		.filter((definition) =>
			definition.kind === "powerup" || definition.kind === "item"
		)
		.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
		.map((definition) => ({
			kind: "reward" as const,
			id: definition.powerupKey ?? definition.id,
			definition,
		}))
	return [...upgrades, ...rewards]
}

function isCompendiumUpgradeDiscovered(entry: CompendiumUpgradeEntry) {
	if (entry.kind === "reward") {
		return isBlueprintDiscovered(entry.id)
	}
	return isBlueprintDiscovered(entry.definition.toolKey)
}

function renderUnifiedUpgradeCatalog(
	root: GameObj,
	left: number,
	width: number,
	top: number,
	bottom: number,
	requestedPage: number,
	onPageChange: (page: number) => void,
	selectedId: string | undefined,
	onSelect: (id: string) => void,
	newBlueprintKeys: ReadonlySet<string>
) {
	const entries = getCompendiumUpgradeEntries()
	const discoveredEntries = entries.filter(isCompendiumUpgradeDiscovered)
	const selected = discoveredEntries.find((entry) => entry.id === selectedId) ??
		discoveredEntries[0]
	const catalog = createPageableCompendiumCatalog(
		root,
		left,
		width,
		top,
		bottom,
		`${discoveredEntries.length} / ${entries.length} DISCOVERED`,
		entries.length,
		requestedPage,
		onPageChange
	)
	entries.slice(catalog.pageStart, catalog.pageEnd).forEach((entry, index) => {
		const discovered = isCompendiumUpgradeDiscovered(entry)
		const isReward = entry.kind === "reward"
		const name = isReward
			? entry.definition.name
			: entry.definition.toolName
		const category = isReward
			? entry.definition.kind
			: entry.definition.category
		const rarity = isReward
			? entry.definition.rarity
			: entry.definition.reward?.rarity ?? RewardRarity.Common
		const sprite = isReward
			? entry.definition.sprite
			: entry.definition.levels[0]?.sprite
		const unlockRequirement = getRewardUnlockRequirement(
			getRewardDefinition(entry.id),
			entry.kind === "upgrade" && isToolKey(entry.definition.toolKey)
				? getUpgradeRequirementText(entry.definition.toolKey)
				: undefined
		)
		createUiSelectableRow(catalog.root, {
			pos: k.vec2(
				0,
				catalog.rowsTop + index * (catalog.rowHeight + catalog.rowGap)
			),
			width: catalog.listWidth,
			height: catalog.rowHeight,
			title: discovered ? name.toUpperCase() : "UNKNOWN UPGRADE",
			meta: discovered
				? `${category.toUpperCase()}  //  ${rarity.toUpperCase()}`
				: "LOCKED UPGRADE RECORD",
			description: discovered ? undefined : `UNLOCK: ${unlockRequirement}`,
			status: discovered ? ">" : "LOCKED",
			statusColor: discovered ? REWARD_RARITY_COLORS[rarity] : UI_COLORS.danger,
			icon: discovered ? sprite : undefined,
			iconText: discovered ? undefined : "?",
			iconSize: 30,
			notification: discovered && newBlueprintKeys.has(entry.id),
			selected: discovered && selected?.id === entry.id,
			disabled: !discovered,
			onClick: discovered ? () => onSelect(entry.id) : undefined,
		})
	})
	if (selected) renderCompendiumUpgradeDetail(catalog, selected)
	else renderEmptyCatalogDetail(catalog, "UPGRADE")
	return catalog.page
}

function renderCompendiumUpgradeDetail(
	catalog: ReturnType<typeof createPageableCompendiumCatalog>,
	entry: CompendiumUpgradeEntry
) {
	if (entry.kind === "reward") {
		const reward = entry.definition
		createUiTutorialDetail(catalog.root, {
			pos: k.vec2(catalog.detailLeft, 0),
			size: k.vec2(catalog.detailWidth, catalog.detailHeight),
			recordLabel: `${reward.kind.toUpperCase()} RECORD`,
			title: reward.name.toUpperCase(),
			description: reward.description.toUpperCase(),
			howTitle: "EFFECT",
			howText: formatCatalogStats(reward.stats),
			noteTitle: "DISCOVERY PROFILE",
			noteText: `${reward.rarity.toUpperCase()}  //  ${reward.progression.persistence.toUpperCase()}  //  ${reward.progression.repeatability.toUpperCase()}`,
			icon: reward.sprite,
			videoFooter: "UPGRADE FIELD RECORDING",
			showRecording: false,
		})
		return
	}
	const definition = entry.definition
	const rarity = definition.reward?.rarity ?? RewardRarity.Common
	const toolKey = isToolKey(definition.toolKey) ? definition.toolKey : undefined
	const currentLevel = toolKey ? getEffectiveUpgradeLevel(toolKey) : undefined
	const level = definition.levels[currentLevel ?? 0]
	const nextLevel = currentLevel === undefined
		? undefined
		: definition.levels[currentLevel + 1]
	createUiTutorialDetail(catalog.root, {
		pos: k.vec2(catalog.detailLeft, 0),
		size: k.vec2(catalog.detailWidth, catalog.detailHeight),
		recordLabel: `${rarity.toUpperCase()} UPGRADE RECORD`,
		title: definition.toolName.toUpperCase(),
		description: level.desc.toUpperCase(),
		howTitle: currentLevel === undefined ? "BASE EFFECT" : "CURRENT EFFECT",
		howText: `${level.desc.toUpperCase()}\n\n${describeLevelEffects(level)}`,
		noteTitle: nextLevel ? "NEXT LEVEL" : "UPGRADE PROFILE",
		noteText: nextLevel
			? nextLevel.desc.toUpperCase()
			: `${definition.category.toUpperCase()}  //  ${definition.type.toUpperCase()}  //  ${definition.levels.length} LEVELS`,
		icon: definition.levels[0]?.sprite,
		videoFooter: "UPGRADE FIELD RECORDING",
		showRecording: false,
	})
}

function formatCatalogStats(stats: Readonly<Record<string, number | string>>) {
	const entries = Object.entries(stats)
	if (entries.length === 0) return "NO ADDITIONAL STAT RECORDS"
	return entries
		.map(([label, value]) => `${label.toUpperCase()}  //  ${String(value).toUpperCase()}`)
		.join("\n")
}

function renderEmptyCatalogDetail(
	catalog: ReturnType<typeof createPageableCompendiumCatalog>,
	recordType: string
) {
	const article = /^[AEIOU]/.test(recordType) ? "AN" : "A"
	createUiTutorialDetail(catalog.root, {
		pos: k.vec2(catalog.detailLeft, 0),
		size: k.vec2(catalog.detailWidth, catalog.detailHeight),
		recordLabel: `${recordType} RECORD`,
		title: `NO ${recordType} SELECTED`,
		howTitle: "DISCOVERY REQUIRED",
		howText: `RECOVER ${article} ${recordType} TO OPEN ITS FULL COMPENDIUM RECORD.`,
		noteTitle: "ARCHIVE STATUS",
		noteText: "UNDISCOVERED RECORDS REMAIN LISTED IN THE CATALOG.",
		showRecording: false,
	})
}

function formatAbilityResource(
	resource: ReturnType<typeof getAbilitiesForSlot>[number]["resource"]
) {
	switch (resource.type) {
		case "none":
			return "NO RESOURCE COST."
		case "cooldown":
			return `RECOVERS AFTER ${resource.duration} SECONDS.`
		case "charges":
			return `${resource.count} CHARGES. EACH CHARGE RECOVERS AFTER ${resource.recharge} SECONDS.`
		case "drain":
			return `DRAINS FOR UP TO ${resource.duration} SECONDS AND RECOVERS OVER ${resource.recharge} SECONDS.`
		case "meter":
			return `REQUIRES ${resource.required} METER.`
	}
}

function renderArsenal(
	root: GameObj,
	left: number,
	width: number,
	top: number,
	bottom: number,
	requestedPage: number,
	onPageChange: (page: number) => void,
	selectedWeaponId: string | undefined,
	onSelect: (id: typeof WEAPONS[number]["id"]) => void,
	newBlueprintKeys: ReadonlySet<string>
) {
	const weapons = WEAPONS
	const ownedWeapons = weapons.filter((weapon) => isWeaponOwned(weapon.id))
	const selected = ownedWeapons.find((weapon) => weapon.id === selectedWeaponId) ??
		ownedWeapons[0]
	const browser = createPageableCompendiumCatalog(
		root,
		left,
		width,
		top,
		bottom,
		`${ownedWeapons.length} / ${weapons.length} UNLOCKED`,
		weapons.length,
		requestedPage,
		onPageChange
	)
	const visibleWeapons = weapons.slice(browser.pageStart, browser.pageEnd)
	for (let index = 0; index < visibleWeapons.length; index++) {
		const weapon = visibleWeapons[index]
		const owned = isWeaponOwned(weapon.id)
		const unlockRequirement = getRewardUnlockRequirement(
			getRewardDefinition(`weapon:${weapon.id}`)
		)
		createUiSelectableRow(browser.root, {
			pos: k.vec2(
				0,
				browser.rowsTop + index * (browser.rowHeight + browser.rowGap)
			),
			width: browser.listWidth,
			height: browser.rowHeight,
			title: owned ? weapon.name : "UNKNOWN WEAPON",
			meta: owned
				? `${getWeaponTriggerLabel(weapon)}  //  IN ARSENAL`
				: "LOCKED PRIMARY RECORD",
			description: owned ? undefined : `UNLOCK: ${unlockRequirement}`,
			icon: owned ? weapon.icon : undefined,
			iconText: owned ? undefined : "?",
			iconSize: 30,
			notification: owned && newBlueprintKeys.has(`weapon:${weapon.id}`),
			selected: owned && selected?.id === weapon.id,
			status: owned ? ">" : "LOCKED",
			statusColor: owned ? undefined : UI_COLORS.danger,
			disabled: !owned,
			onClick: owned ? () => onSelect(weapon.id) : undefined,
		})
	}
	if (selected) {
		createUiTutorialDetail(browser.root, {
			pos: k.vec2(browser.detailLeft, 0),
			size: k.vec2(browser.detailWidth, browser.detailHeight),
			recordLabel: `PRIMARY RECORD  //  ${String(ownedWeapons.indexOf(selected) + 1).padStart(2, "0")}`,
			title: selected.name,
			description: selected.description.toUpperCase(),
			howTitle: "HOW TO USE",
			howText: getWeaponTutorial(selected),
			noteTitle: "WEAPON PROFILE",
			noteText: getWeaponProfile(selected),
			input: "MOUSE 1",
			inputAction: getWeaponTriggerLabel(selected),
			icon: selected.icon,
			videoFooter: "00:05  //  TARGET DEMONSTRATION",
		})
	}
	return browser.page
}

function getWeaponTriggerLabel(weapon: typeof WEAPONS[number]) {
	const mode = weapon.triggerModifier?.mode ?? "press"
	return mode === "charge" ? "HOLD + RELEASE" : mode === "hold" ? "HOLD" : "FIRE"
}

function getWeaponTutorial(weapon: typeof WEAPONS[number]) {
	if (weapon.charge) {
		return "HOLD PRIMARY FIRE TO BUILD CHARGE, THEN RELEASE. PARTIAL CHARGES FIRE EARLIER; FULL CHARGES MAXIMIZE THE WEAPON'S SPECIAL PROPERTIES."
	}
	if (weapon.triggerModifier?.mode === "hold") {
		return "HOLD PRIMARY FIRE TO MAINTAIN PRESSURE. CONTROL YOUR AIM AND DISTANCE WHILE THE WEAPON CONTINUES FIRING."
	}
	return "PRESS PRIMARY FIRE FOR A DELIBERATE SHOT. CYCLE THE ARSENAL WHEN ANOTHER WEAPON BETTER FITS THE TARGET OR ROOM."
}

function getWeaponProfile(weapon: typeof WEAPONS[number]) {
	const traits: string[] = []
	if (weapon.charge) traits.push("CHARGE")
	if (weapon.splash) traits.push("SPLASH")
	if (weapon.piercing) traits.push("PIERCING")
	if (weapon.bounce) traits.push("RICOCHET")
	if (weapon.chain) traits.push("CHAIN")
	if (weapon.knockback) traits.push("KNOCKBACK")
	return traits.length > 0
		? traits.join("  //  ")
		: "BALANCED  //  DIRECT FIRE"
}

function describeLevelEffects(
	level: UpgradeDefinition["levels"][number]
) {
	const effects: string[] = []
	for (const modifier of level.effects.modifiers ?? []) {
		const stat = modifier.stat
			.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
			.toUpperCase()
		const value = modifier.type === "multiply"
			? `X${modifier.value}`
			: modifier.type === "additive"
				? `+${modifier.value}`
				: `=${modifier.value}`
		effects.push(`${stat} ${value}`)
	}
	for (const unlock of level.effects.unlocks ?? []) {
		effects.push(`UNLOCK: ${unlock.description.toUpperCase()}`)
	}
	for (const ability of level.effects.abilities ?? []) {
		const cooldown = ability.cooldown === undefined
			? ""
			: ` (${ability.cooldown}S COOLDOWN)`
		effects.push(`ABILITY: ${ability.description.toUpperCase()}${cooldown}`)
	}
	return effects.join("  //  ") || "NO ADDITIONAL STAT CHANGE"
}

export function hideHubFacilityPanel(playTransitionSound = true) {
	if (!panelOpen || panelClosing) return
	if (!playTransitionSound) {
		finishClosingHubFacilityPanel(false)
		return
	}
	panelClosing = true
	playShopMenuCloseSound()
	const panel = activePanel
	const backdrop = activeBackdrop
	if (!panel?.exists() || !backdrop?.exists()) {
		finishClosingHubFacilityPanel(false)
		return
	}
	void playUiModalClose(backdrop, panel, {
		panelPos: k.center(),
		backdropOpacity: 0.8,
	}).then(() => finishClosingHubFacilityPanel(false))
}

function finishClosingHubFacilityPanel(playTransitionSound: boolean) {
	const closeHandler = panelCloseHandler
	panelCloseHandler = undefined
	panelOpen = false
	panelClosing = false
	uiState.modalOpen = false
	for (const obj of k.get<GameObj>(tags.hubFacilityUi)) {
		destroyObjectTree(obj)
	}
	for (const obj of k.get<GameObj>(tags.gameLoop)) obj.paused = false
	closeHandler?.()
	if (playTransitionSound) playShopMenuCloseSound()
	activePanel = undefined
	activeBackdrop = undefined
}

function openPanel(
	title?: string,
	size = k.vec2(720, 440),
	playTransitionSound = true,
	onClose?: () => void,
	closeButtonCenterX = 0
) {
	if (panelOpen) return undefined
	panelOpen = true
	panelCloseHandler = onClose
	uiState.modalOpen = true
	for (const obj of k.get<GameObj>(tags.gameLoop)) obj.paused = true

	const backdrop = k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(k.BLACK),
		k.opacity(0.8),
		k.animate(),
		k.fixed(),
		k.layer(layers.uiEffects),
		tags.hubFacilityUi,
	])
	const panel = createUiPanel({
		pos: k.center(),
		size,
		title,
		anchor: "center",
		layer: layers.uiEffects,
		tags: [tags.hubFacilityUi],
		animated: true,
	})
	activeBackdrop = backdrop
	activePanel = panel
	playUiModalOpen(backdrop, panel, {
		panelPos: k.center(),
		backdropOpacity: 0.8,
	})
	addButton(
		panel,
		k.vec2(closeButtonCenterX, size.y / 2 - 35),
		"CLOSE",
		() => hideHubFacilityPanel()
	)
	if (playTransitionSound) playShopMenuOpenSound()
	return panel
}

function addButton(
	parent: GameObj,
	pos: Vec2,
	text: string,
	onClick: () => void,
	width: number = 180
) {
	return createUiActionButton(parent, {
		pos: pos.sub(width / 2, 19),
		text,
		onClick,
		size: k.vec2(width, 38),
	})
}

function queueContract(contract: RunContract) {
	selectContract(contract)
	setNextGeneratedRunSeed(contract.seed)
	hideHubFacilityPanel()
}

function destroyObjectTree(obj: GameObj) {
	for (const child of [...obj.children]) destroyObjectTree(child)
	k.destroy(obj)
}
