import type { GameObj, Vec2 } from "kaplay"
import { getScore, k, layers, spendScore } from "../main"
import {
	getContractOffers,
	getSelectedContract,
	RunContract,
	selectContract,
} from "../services/contractService"
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
} from "../services/hubProgressService"
import { getLastRunStats } from "../services/runStatsService"
import { setNextGeneratedRunSeed } from "../levels/runMap"
import { saveGame } from "../util"
import { tags } from "../tags"
import { uiState } from "./uiState"
import {
	addThemedText,
	createUiActionButton,
	createUiBadge,
	createUiPanel,
	createUiProgressBar,
	playUiModalClose,
	playUiModalOpen,
	createUiSectionHeader,
	createUiSelectableRow,
	createUiStatList,
	createUiSurface,
	setUiTreeOpacity,
	getScaledLineSpacing,
	UI_COLORS,
	UI_FONT_SIZES,
} from "./common"
import {
	getPermanentUpgradeLevel,
	getEffectiveUpgradeLevel,
	getEffectiveUpgradeRarity,
	isToolKey,
	isPermanentUpgradeKey,
	PERMANENT_UPGRADE_KEYS,
} from "../upg"
import {
	getAllRewardDefinitions,
	getRewardMinimumHubLevel,
	REWARD_RARITY_COLORS,
	RewardRarity,
} from "../services/rewardService"
import {
	getRarityRank,
	REWARD_RARITY_ORDER,
} from "../services/rewardQualityService"
import {
	purchaseBurstParticleCount,
	spawnCurrencyBurst,
} from "../spawn/spawnCurrencyBurst"
import {
	getAllUpgradeDefinitions,
	getUpgradeDefinition,
} from "../upgrades/upgradeRegistry"
import type { UpgradeDefinition } from "../types/upgradeTypes"
import {
	equipWeapon,
	getEquippedWeaponId,
	isWeaponOwned,
	WEAPONS,
} from "../services/weaponService"
import {
	ACTIVE_MODULES,
	equipActiveModule,
	getEquippedActiveModuleId,
} from "../services/activeModuleService"
import {
	playShopMenuCloseSound,
	playShopMenuOpenSound,
} from "../services/shopMenuSoundService"

let panelOpen = false
let panelClosing = false
let panelCloseHandler: (() => void) | undefined
let activePanel: GameObj | undefined
let activeBackdrop: GameObj | undefined

export function hubFacilityPanelOpen() {
	return panelOpen
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
	offers: readonly RunContract[]
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
			onClick: () => queueContract(contract),
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
		onClick: () => {
			if (!spendScore(cost) || !upgradeForge()) return
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

type PhaseStationTab = "ship" | "arsenal" | "modules" | "upgrades"

const PHASE_STATION_TABS: readonly {
	id: PhaseStationTab
	label: string
}[] = [
	{ id: "ship", label: "SHIP UPGRADES" },
	{ id: "arsenal", label: "ARSENAL" },
	{ id: "modules", label: "MODULES" },
	{ id: "upgrades", label: "UPGRADES" },
]

export function showPhaseStation(
	playTransitionSound = true,
	initialTab: PhaseStationTab = "ship"
) {
	const panelSize = k.vec2(
		Math.min(820, k.width() - 24),
		Math.min(620, k.height() - 32)
	)
	const panel = openPanel(undefined, panelSize, playTransitionSound)
	if (!panel) return
	const panelTop = -panelSize.y / 2
	const panelLeft = -panelSize.x / 2
	const innerPadding = 20
	const innerWidth = panelSize.x - innerPadding * 2
	const contentTop = panelTop + 154
	const contentBottom = panelSize.y / 2 - 62
	const tabRoot = panel.add([k.pos(0, 0)])
	const contentRoot = panel.add([k.pos(0, 0)])
	let activeTab: PhaseStationTab = initialTab
	let arsenalPage = 0
	let upgradePage = 0
	let upgradeDetailsPage = 0
	let selectedUpgradeKey: string | undefined
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

	createUiSectionHeader(panel, {
		pos: k.vec2(panelLeft + 1, panelTop + 1),
		width: panelSize.x - 2,
		height: 54,
		eyebrow: "CENTRAL HUB BUILDING",
		title: "PHASE STATION",
		action: `HUB LEVEL ${getHubLevel()}`,
	})
	const hubLevelProgress = getHubLevelProgress()
	const hubXpRemaining = Math.max(
		0,
		hubLevelProgress.required - hubLevelProgress.current
	)
	addThemedText(panel, {
		text: `HUB LEVEL ${hubLevelProgress.level}`,
		pos: k.vec2(panelLeft + innerPadding, panelTop + 106),
		variant: "caption",
		width: innerWidth,
	})
	addThemedText(panel, {
		text: hubLevelProgress.progress >= 1
			? `${hubLevelProgress.current} DEPOSITED  //  MAXIMUM LEVEL`
			: `${hubLevelProgress.current} / ${hubLevelProgress.required} DEPOSITED  //  ${hubXpRemaining} NEEDED`,
		pos: k.vec2(panelLeft + innerPadding, panelTop + 106),
		variant: "muted",
		width: innerWidth,
		align: "right",
	})
	createUiProgressBar(panel, {
		pos: k.vec2(panelLeft + innerPadding, panelTop + 126),
		width: innerWidth,
		height: 6,
		value: hubLevelProgress.progress,
		color: hubLevelProgress.progress >= 1
			? UI_COLORS.success
			: UI_COLORS.accent,
	})

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
					panelTop + 62
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

		if (activeTab === "ship") {
			renderPermanentShipSystems(
				contentRoot,
				panelLeft + innerPadding,
				innerWidth,
				contentTop,
				contentBottom,
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
				render,
				newBlueprintKeys
			)
		}
		if (activeTab === "modules") {
			renderActiveModules(
				contentRoot,
				panelLeft + innerPadding,
				innerWidth,
				contentTop,
				contentBottom,
				render,
				newBlueprintKeys
			)
		}
		if (activeTab === "upgrades") {
			const selectedUpgrade = selectedUpgradeKey
				? getUpgradeDefinition(selectedUpgradeKey)
				: undefined
			if (selectedUpgrade) {
				renderUpgradeDetails(
					contentRoot,
					panelLeft + innerPadding,
					innerWidth,
					contentTop,
					contentBottom,
					selectedUpgrade,
					upgradeDetailsPage,
					(nextPage) => {
						upgradeDetailsPage = nextPage
						render()
					},
					() => {
						selectedUpgradeKey = undefined
						upgradeDetailsPage = 0
						render()
					}
				)
				return
			}
			upgradePage = renderUpgradeCatalog(
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
				(toolKey) => {
					selectedUpgradeKey = toolKey
					upgradeDetailsPage = 0
					render()
				},
				newBlueprintKeys,
			)
		}
	}

	render()
}

function getPhaseStationTabForBlueprint(key: string): PhaseStationTab {
	if (key.startsWith("weapon:")) return "arsenal"
	if (key.startsWith("active:")) return "modules"
	if (PERMANENT_UPGRADE_KEYS.some((upgradeKey) => upgradeKey === key)) {
		return "ship"
	}
	return "upgrades"
}

function renderActiveModules(
	root: GameObj,
	left: number,
	width: number,
	top: number,
	bottom: number,
	render: () => void,
	newBlueprintKeys: ReadonlySet<string>
) {
	addThemedText(root, {
		text: "ACTIVE MODULES  //  RECOVERED THROUGH CHESTS",
		pos: k.vec2(left, top),
		variant: "eyebrow",
		width,
	})
	const rowGap = 6
	const rowsTop = top + 24
	const rowHeight = (
		bottom - rowsTop - rowGap * (ACTIVE_MODULES.length - 1)
	) / ACTIVE_MODULES.length
	const equippedModuleId = getEquippedActiveModuleId()
	for (let index = 0; index < ACTIVE_MODULES.length; index++) {
		const module = ACTIVE_MODULES[index]
		const equipped = equippedModuleId === module.id
		const hubLocked = getHubLevel() < module.minimumHubLevel
		const discovered = equipped ||
			isBlueprintDiscovered(`active:${module.id}`)
		const rarityColor = REWARD_RARITY_COLORS[module.rarity]
		createUiSelectableRow(root, {
			pos: k.vec2(left, rowsTop + index * (rowHeight + rowGap)),
			width,
			height: rowHeight,
			title: discovered ? module.name : "??????",
			notification: discovered && newBlueprintKeys.has(`active:${module.id}`),
			meta: discovered
				? `${module.rarity.toUpperCase()}  //  ACTIVE MODULE  //  ${module.cooldown}S COOLDOWN`
				: hubLocked
					? `LOCKED DROP  //  HUB LEVEL ${module.minimumHubLevel}`
					: "??????  //  ??????  //  ??????",
			description: discovered ? module.description : "??????",
			status: discovered
				? equipped ? "EQUIPPED" : "EQUIP"
				: hubLocked ? `REQUIRES HUB LEVEL ${module.minimumHubLevel}` : "??????",
			statusColor: discovered ? rarityColor : UI_COLORS.muted,
			icon: discovered ? module.icon : undefined,
			iconText: discovered ? undefined : "?",
			iconSize: Math.min(30, rowHeight - 12),
			disabled: !discovered,
			onClick: discovered && !equipped
				? () => {
					equipActiveModule(module.id)
					saveGame("slot1")
					render()
				}
				: undefined,
		})
	}
}

function renderPermanentShipSystems(
	root: GameObj,
	left: number,
	width: number,
	top: number,
	bottom: number,
	newBlueprintKeys: ReadonlySet<string>
) {
	addThemedText(root, {
		text: "PERMANENT SHIP SYSTEMS  //  UNLOCKED THROUGH CHESTS",
		pos: k.vec2(left, top),
		variant: "eyebrow",
		width,
	})
	const rowGap = 4
	const rowsTop = top + 22
	const rowHeight = (
		bottom - rowsTop - rowGap * (PERMANENT_UPGRADE_KEYS.length - 1)
	) / PERMANENT_UPGRADE_KEYS.length
	PERMANENT_UPGRADE_KEYS.forEach((key, index) => {
		const definition = getUpgradeDefinition(key)
		if (!definition) return
		const currentLevel = getPermanentUpgradeLevel(key) ?? -1
		const owned = currentLevel >= 0
		const displayedLevel = definition.levels[Math.max(0, currentLevel)]
		const level = owned ? currentLevel + 1 : 0
		createUiSelectableRow(root, {
			pos: k.vec2(left, rowsTop + index * (rowHeight + rowGap)),
			width,
			height: rowHeight,
			title: definition.toolName.toUpperCase(),
			notification: newBlueprintKeys.has(key),
			meta: `LEVEL ${level} / ${definition.levels.length}`,
			description: displayedLevel?.desc ?? "",
			status: owned
				? level >= definition.levels.length
					? "LEGENDARY  //  MAX LEVEL"
					: "LEGENDARY  //  CHEST UPGRADE"
				: "UNLOCKED THROUGH CHESTS",
			statusColor: REWARD_RARITY_COLORS[RewardRarity.Legendary],
			icon: definition.levels[0]?.sprite,
			iconSize: Math.min(26, rowHeight - 10),
			disabled: !owned,
		})
	})
}

function renderArsenal(
	root: GameObj,
	left: number,
	width: number,
	top: number,
	bottom: number,
	requestedPage: number,
	onPageChange: (page: number) => void,
	render: () => void,
	newBlueprintKeys: ReadonlySet<string>
) {
	const pageSize = 6
	const pageCount = Math.max(1, Math.ceil(WEAPONS.length / pageSize))
	const page = k.clamp(requestedPage, 0, pageCount - 1)
	addThemedText(root, {
		text: `PRIMARY WEAPON ARSENAL  //  PAGE ${page + 1} / ${pageCount}`,
		pos: k.vec2(left, top),
		variant: "eyebrow",
		width: width - 90,
	})
	createUiActionButton(root, {
		pos: k.vec2(left + width - 78, top - 5),
		size: k.vec2(34, 20),
		text: "<",
		disabled: page === 0,
		onClick: () => onPageChange(page - 1),
	})
	createUiActionButton(root, {
		pos: k.vec2(left + width - 34, top - 5),
		size: k.vec2(34, 20),
		text: ">",
		disabled: page >= pageCount - 1,
		onClick: () => onPageChange(page + 1),
	})
	const columnGap = 12
	const rowGap = 8
	const columnCount = 2
	const rowCount = 3
	const cardsTop = top + 24
	const cardWidth = (width - columnGap) / columnCount
	const cardHeight = (
		bottom - cardsTop - rowGap * (rowCount - 1)
	) / rowCount
	const visibleWeapons = WEAPONS.slice(page * pageSize, (page + 1) * pageSize)
	for (let index = 0; index < visibleWeapons.length; index++) {
		const weapon = visibleWeapons[index]
		const owned = isWeaponOwned(weapon.id)
		const hubLocked = getHubLevel() < weapon.minimumHubLevel
		const equipped = getEquippedWeaponId() === weapon.id
		const column = index % columnCount
		const row = Math.floor(index / columnCount)
		const card = createUiSurface(root, {
			pos: k.vec2(
				left + column * (cardWidth + columnGap),
				cardsTop + row * (cardHeight + rowGap)
			),
			size: k.vec2(cardWidth, cardHeight),
			tone: "raised",
			borderColor: equipped ? UI_COLORS.accent : UI_COLORS.border,
		})
		if (owned) {
			card.add([
				k.sprite(weapon.icon, { width: 42, height: 42 }),
				k.pos(32, 38),
				k.anchor("center"),
			])
		} else {
			addThemedText(card, {
				text: "?",
				pos: k.vec2(12, 20),
				variant: "display",
				width: 40,
				align: "center",
			})
		}
		addThemedText(card, {
			text: owned ? weapon.name : "??????",
			pos: k.vec2(62, 10),
			variant: "heading",
			width: cardWidth - 74,
		})
		if (owned && newBlueprintKeys.has(`weapon:${weapon.id}`)) {
			addThemedText(card, {
				text: "!",
				pos: k.vec2(cardWidth - 12, 10),
				variant: "caption",
				align: "right",
				color: k.rgb(...UI_COLORS.warning),
			})
		}
		addThemedText(card, {
			text: owned
				? weapon.description
				: hubLocked ? `REQUIRES HUB LEVEL ${weapon.minimumHubLevel}` : "??????",
			pos: k.vec2(62, 34),
			variant: owned ? "body" : "muted",
			width: cardWidth - 74,
			lineHeight: 1.15,
		})
		if (equipped) {
			createUiBadge(card, {
				pos: k.vec2(cardWidth - 112, cardHeight - 32),
				width: 100,
				text: "EQUIPPED",
			})
		} else if (owned) {
			createUiActionButton(card, {
				pos: k.vec2(cardWidth - 112, cardHeight - 36),
				size: k.vec2(100, 28),
				text: "EQUIP",
				onClick: () => {
					if (!equipWeapon(weapon.id)) return
					saveGame("slot1")
					render()
				},
			})
		} else {
			createUiBadge(card, {
				pos: k.vec2(cardWidth - 112, cardHeight - 32),
				width: 100,
				text: hubLocked ? `HUB LVL ${weapon.minimumHubLevel}` : "??????",
				color: UI_COLORS.muted,
			})
			setUiTreeOpacity(card, 0.35)
		}
	}
	return page
}

function renderUpgradeCatalog(
	root: GameObj,
	left: number,
	width: number,
	top: number,
	bottom: number,
	requestedPage: number,
	onPageChange: (page: number) => void,
	onSelect: (toolKey: string) => void,
	newBlueprintKeys: ReadonlySet<string>
) {
	const upgradeEntries = getAllUpgradeDefinitions()
		.filter((definition) =>
			!isToolKey(definition.toolKey) ||
			!isPermanentUpgradeKey(definition.toolKey)
		)
		.sort((a, b) =>
			a.category.localeCompare(b.category) ||
			a.toolName.localeCompare(b.toolName)
		)
		.map((definition) => ({ kind: "upgrade" as const, definition }))
	const rewardEntries = getAllRewardDefinitions()
		.filter((definition) =>
			definition.kind === "powerup" || definition.kind === "item"
		)
		.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
		.map((definition) => ({ kind: "reward" as const, definition }))
	const entries = [...upgradeEntries, ...rewardEntries]
	const pageSize = 8
	const pageCount = Math.max(1, Math.ceil(entries.length / pageSize))
	const page = k.clamp(requestedPage, 0, pageCount - 1)
	addThemedText(root, {
		text: `UPGRADES & DISCOVERIES  //  PAGE ${page + 1} / ${pageCount}`,
		pos: k.vec2(left, top),
		variant: "eyebrow",
		width: width - 90,
	})
	createUiActionButton(root, {
		pos: k.vec2(left + width - 78, top - 5),
		size: k.vec2(34, 20),
		text: "<",
		disabled: page === 0,
		onClick: () => onPageChange(page - 1),
	})
	createUiActionButton(root, {
		pos: k.vec2(left + width - 34, top - 5),
		size: k.vec2(34, 20),
		text: ">",
		disabled: page >= pageCount - 1,
		onClick: () => onPageChange(page + 1),
	})
	const rowGap = 4
	const rowCount = pageSize
	const rowsTop = top + 24
	const rowHeight = (
		bottom - rowsTop - rowGap * (rowCount - 1)
	) / rowCount
	entries.slice(page * pageSize, (page + 1) * pageSize).forEach(
		(entry, index) => {
			if (entry.kind === "reward") {
				const reward = entry.definition
				const key = reward.powerupKey ?? reward.id
				const discovered = isBlueprintDiscovered(key)
				const minimumHubLevel = getRewardMinimumHubLevel(reward)
				const hubLocked = getHubLevel() < minimumHubLevel
				createUiSelectableRow(root, {
					pos: k.vec2(left, rowsTop + index * (rowHeight + rowGap)),
					width,
					height: rowHeight,
					title: discovered ? reward.name.toUpperCase() : "??????",
					notification: discovered && newBlueprintKeys.has(key),
					meta: discovered
						? `${reward.kind.toUpperCase()}  //  ${reward.progression.persistence.toUpperCase()}`
						: hubLocked
							? `LOCKED DROP  //  HUB LEVEL ${minimumHubLevel}`
							: "??????  //  ??????",
					status: discovered
						? `${reward.rarity.toUpperCase()}  //  FOUND`
						: hubLocked ? `REQUIRES HUB LEVEL ${minimumHubLevel}` : "??????",
					statusColor: discovered
						? REWARD_RARITY_COLORS[reward.rarity]
						: UI_COLORS.muted,
					icon: discovered ? reward.sprite : undefined,
					iconText: discovered ? undefined : "?",
					iconSize: Math.min(26, rowHeight - 10),
					disabled: !discovered,
				})
				return
			}
			const definition = entry.definition
			const toolKey = isToolKey(definition.toolKey)
				? definition.toolKey
				: undefined
			const permanent = toolKey !== undefined &&
				isPermanentUpgradeKey(toolKey)
			const discovered = permanent && toolKey
				? getEffectiveUpgradeLevel(toolKey) !== undefined
				: isBlueprintDiscovered(definition.toolKey)
			const rarity = permanent
				? RewardRarity.Legendary
				: definition.reward?.rarity ?? RewardRarity.Common
			const minimumHubLevel = definition.reward?.minimumHubLevel ?? 1
			const hubLocked = getHubLevel() < minimumHubLevel
			createUiSelectableRow(root, {
				pos: k.vec2(left, rowsTop + index * (rowHeight + rowGap)),
				width,
				height: rowHeight,
				title: discovered ? definition.toolName.toUpperCase() : "??????",
				notification: discovered && newBlueprintKeys.has(definition.toolKey),
				meta: discovered
					? `${definition.category.toUpperCase()}  //  ${definition.type.toUpperCase()}`
					: hubLocked
						? `LOCKED DROP  //  HUB LEVEL ${minimumHubLevel}`
						: "??????  //  ??????",
				status: discovered
					? `${rarity.toUpperCase()}  //  ${permanent ? "PERMANENT  //  OWNED" : "FOUND"}`
					: hubLocked ? `REQUIRES HUB LEVEL ${minimumHubLevel}` : "??????",
				statusColor: discovered
					? REWARD_RARITY_COLORS[rarity]
					: UI_COLORS.muted,
				icon: discovered ? definition.levels[0]?.sprite : undefined,
				iconText: discovered ? undefined : "?",
				iconSize: Math.min(26, rowHeight - 10),
				disabled: !discovered,
				onClick: discovered
					? () => onSelect(definition.toolKey)
					: undefined,
			})
		}
	)
	return page
}

function renderUpgradeDetails(
	root: GameObj,
	left: number,
	width: number,
	top: number,
	bottom: number,
	definition: UpgradeDefinition,
	requestedPage: number,
	onPageChange: (page: number) => void,
	onBack: () => void
) {
	const rarity = definition.reward?.rarity ?? RewardRarity.Common
	const rarityColor = REWARD_RARITY_COLORS[rarity]
	const toolKey = isToolKey(definition.toolKey)
		? definition.toolKey
		: undefined
	const currentLevel = toolKey
		? getEffectiveUpgradeLevel(toolKey)
		: undefined
	const currentRarity = toolKey
		? getEffectiveUpgradeRarity(toolKey)
		: undefined
	const hasRarityScaling = definition.levels.some(
		(level) => (level.effects.modifiers?.length ?? 0) > 0
	)
	const rarityScale = hasRarityScaling
		? REWARD_RARITY_ORDER.slice(getRarityRank(rarity))
		: [rarity]
	addThemedText(root, {
		text: "UPGRADE DETAILS",
		pos: k.vec2(left, top),
		variant: "eyebrow",
		width: width - 110,
	})
	createUiActionButton(root, {
		pos: k.vec2(left + width - 96, top - 5),
		size: k.vec2(96, 20),
		text: "< BACK",
		onClick: onBack,
	})

	const detailsTop = top + 24
	const detailsHeight = bottom - detailsTop
	const details = createUiSurface(root, {
		pos: k.vec2(left, detailsTop),
		size: k.vec2(width, detailsHeight),
		tone: "raised",
		borderColor: rarityColor,
	})
	details.add([
		k.sprite(definition.levels[0].sprite, { width: 54, height: 54 }),
		k.pos(42, 42),
		k.anchor("center"),
	])
	addThemedText(details, {
		text: definition.toolName.toUpperCase(),
		pos: k.vec2(82, 18),
		variant: "heading",
		width: width - 104,
	})
	addThemedText(details, {
		text: `BASE ${rarity.toUpperCase()}  //  ${definition.category.toUpperCase()}  //  ${definition.type.toUpperCase()}`,
		pos: k.vec2(82, 42),
		variant: "eyebrow",
		width: width - 104,
		color: k.rgb(...rarityColor),
	})
	addThemedText(details, {
		text: hasRarityScaling
			? "RARITY SCALE  //  NUMERIC EFFECTS IMPROVE PER TIER"
			: "RARITY  //  FIXED EFFECT",
		pos: k.vec2(20, 76),
		variant: "eyebrow",
		width: width - 40,
	})
	let rarityLeft = 20
	for (const scaleRarity of rarityScale) {
		const badgeText = currentRarity === scaleRarity
			? `${scaleRarity} *`
			: scaleRarity
		const badgeWidth = Math.max(72, badgeText.length * 6 + 16)
		createUiBadge(details, {
			pos: k.vec2(rarityLeft, 92),
			width: badgeWidth,
			text: badgeText,
			color: REWARD_RARITY_COLORS[scaleRarity],
		})
		rarityLeft += badgeWidth + 8
	}
	addThemedText(details, {
		text: currentRarity
			? "* CURRENT RUN RARITY"
			: "RARITY IS ROLLED WHEN THE UPGRADE DROPS",
		pos: k.vec2(20, 118),
		variant: "muted",
		width: width - 40,
	})
	addThemedText(details, {
		text: "WHAT EACH LEVEL DOES",
		pos: k.vec2(20, 138),
		variant: "eyebrow",
		width: width - 40,
	})

	const pageSize = 4
	const pageCount = Math.max(1, Math.ceil(definition.levels.length / pageSize))
	const page = k.clamp(requestedPage, 0, pageCount - 1)
	if (pageCount > 1) {
		addThemedText(details, {
			text: `PAGE ${page + 1} / ${pageCount}`,
			pos: k.vec2(width - 154, 138),
			variant: "muted",
			width: 54,
			align: "right",
		})
		createUiActionButton(details, {
			pos: k.vec2(width - 92, 132),
			size: k.vec2(34, 20),
			text: "<",
			disabled: page === 0,
			onClick: () => onPageChange(page - 1),
		})
		createUiActionButton(details, {
			pos: k.vec2(width - 54, 132),
			size: k.vec2(34, 20),
			text: ">",
			disabled: page >= pageCount - 1,
			onClick: () => onPageChange(page + 1),
		})
	}
	const levelsTop = 158
	const levelGap = 6
	const columnGap = 8
	const visibleLevels = definition.levels.slice(
		page * pageSize,
		(page + 1) * pageSize
	)
	const columnCount = visibleLevels.length > 1 ? 2 : 1
	const rowCount = Math.ceil(visibleLevels.length / columnCount)
	const levelWidth = (
		width - 40 - columnGap * (columnCount - 1)
	) / columnCount
	const levelLayouts = visibleLevels.map((level) =>
		measureLevelCard(level, levelWidth)
	)
	const rowHeights = Array.from({ length: rowCount }, (_, row) =>
		Math.max(
			...levelLayouts
				.filter((_, index) => Math.floor(index / columnCount) === row)
				.map((layout) => layout.height)
		)
	)
	const rowTops: number[] = []
	let nextRowTop = levelsTop
	for (const rowHeight of rowHeights) {
		rowTops.push(nextRowTop)
		nextRowTop += rowHeight + levelGap
	}
	visibleLevels.forEach((level, pageIndex) => {
		const index = page * pageSize + pageIndex
		const column = pageIndex % columnCount
		const row = Math.floor(pageIndex / columnCount)
		const isCurrent = currentLevel === index
		const acquired = currentLevel !== undefined && currentLevel > index
		const levelState = isCurrent
			? "CURRENT"
			: acquired
				? "ACQUIRED"
				: undefined
		const levelColor = isCurrent && currentRarity
			? REWARD_RARITY_COLORS[currentRarity]
			: rarityColor
		const layout = levelLayouts[pageIndex]
		const levelHeight = rowHeights[row]
		const levelCard = createUiSurface(details, {
			pos: k.vec2(
				20 + column * (levelWidth + columnGap),
				rowTops[row]
			),
			size: k.vec2(levelWidth, levelHeight),
			tone: "raised",
			borderColor: isCurrent ? levelColor : UI_COLORS.border,
		})
		addThemedText(levelCard, {
			text: `LEVEL ${index + 1}  //  ${level.name.toUpperCase()}`,
			pos: k.vec2(10, 6),
			variant: "caption",
			width: levelWidth - 20,
			color: k.rgb(...levelColor),
		})
		if (levelState) {
			addThemedText(levelCard, {
				text: levelState,
				pos: k.vec2(10, 6),
				variant: "caption",
				width: levelWidth - 20,
				align: "right",
				color: k.rgb(...levelColor),
			})
		}
		addThemedText(levelCard, {
			text: level.desc,
			pos: k.vec2(10, 20),
			variant: "body",
			size: UI_FONT_SIZES.micro,
			lineHeight: 1,
			width: levelWidth - 20,
		})
		addThemedText(levelCard, {
			text: describeLevelEffects(level),
			pos: k.vec2(10, layout.effectsTop),
			variant: "muted",
			size: UI_FONT_SIZES.micro,
			width: levelWidth - 20,
		})
	})
}

function measureLevelCard(
	level: UpgradeDefinition["levels"][number],
	width: number
) {
	const textWidth = width - 20
	const descriptionSize = UI_FONT_SIZES.micro
	const description = k.formatText({
		text: level.desc,
		font: "unscii",
		size: descriptionSize,
		width: textWidth,
		lineSpacing: getScaledLineSpacing(descriptionSize, 1),
	})
	const effectsSize = UI_FONT_SIZES.micro
	const effects = k.formatText({
		text: describeLevelEffects(level),
		font: "unscii",
		size: effectsSize,
		width: textWidth,
		lineSpacing: getScaledLineSpacing(effectsSize, 1.4),
	})
	const effectsTop = 20 + description.height + 5
	return {
		effectsTop,
		height: Math.max(58, effectsTop + effects.height + 8),
	}
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
	playTransitionSound = true
) {
	if (panelOpen) return undefined
	panelOpen = true
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
		k.vec2(0, size.y / 2 - 35),
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
