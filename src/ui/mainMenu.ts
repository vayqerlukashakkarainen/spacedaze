import type { GameObj } from "kaplay"
import {
	changeGameState,
	GameState,
	k,
	layers,
	resetGameProfile,
} from "../main"
import { getLifetimeStats } from "../services/runStatsService"
import { getHubLevel } from "../services/hubProgressService"
import { startMainMenuSpaceJump } from "../services/mainMenuTransitionService"
import { createSpaceAmbience } from "../spawn/spaceAmbience"
import { tags } from "../tags"
import {
	addThemedText,
	createUiCollapsible,
	createUiCommandButton,
	createUiGrowingContainer,
	createUiPanel,
	createUiSectionHeader,
	showUiConfirmationDialog,
	createUiSurface,
	createUiTelemetryStrip,
	createUiVerticalFlow,
	UI_COLORS,
	UI_FONT_SIZES,
} from "./common"
import type { UiConfirmationDialogController } from "./common"
import { createUiVolumeControls } from "./volumeControls"
import { registerBatchedUiUpdate } from "../services/uiUpdateService"
import { PLANET_CHUNK_SPRITES } from "../planetChunkSprites"
import { audioService } from "../services/audioService"
import { hasGameSave } from "../util"

const MENU_WIDTH = 820
const MENU_HEIGHT = 500
const COMMAND_X = 52
const COMMAND_WIDTH = 360
const CREDITS_PANEL_X = 440
const MUSIC_CREDITS = [
	"SCI-FI SURVIVAL DREAMSCAPE  //  ONDERWISH",
	"KATANA BLASTER  //  BIG GIANT CIRCLES",
	"ARCADIA  //  DUNDERPATRULLEN",
	"FLIRT FLIRT OH IT HURTS  //  BOSSFIGHT",
	"AMBIENT SPACE NOISE 1  //  THE TOOTHPASTE VAMPIRES",
] as const
const SOUND_CREDITS = [
	"CADERE SOUNDS  //  FREESOUND",
	"LILMATI  //  FREESOUND",
	"EVANBOYERMAN  //  FREESOUND",
	"SAANGOSU  //  FREESOUND",
	"SLAMAXU  //  FREESOUND",
	"HYKENFREAK  //  FREESOUND",
	"TIMBRE  //  FREESOUND",
	"HAMILTHON  //  FREESOUND",
	"AUTISTIC LUCARIO  //  FREESOUND",
] as const

export function enterMainMenu() {
	audioService.playMusic("hub", {
		volume: 1,
		loop: true,
		continueIfPlaying: true,
	})
	const scale = Math.min(
		1,
		(k.width() - 24) / MENU_WIDTH,
		(k.height() - 24) / MENU_HEIGHT
	)
	const root = createUiPanel({
		pos: k.vec2(0, 0),
		size: k.vec2(k.width(), k.height()),
		frameless: true,
		tags: [tags.mainMenu],
	})
	root.add([
		k.pos(0, 0),
		k.rect(k.width(), k.height()),
		k.color(...UI_COLORS.background),
		k.layer(layers.bg),
		k.z(-20000),
	])
	const viewportArea = k.width() * k.height()
	const menuArea = MENU_WIDTH * MENU_HEIGHT
	createSpaceAmbience({
		parent: root,
		size: k.vec2(k.width(), k.height()),
		starCount: Math.min(160, Math.max(54, Math.round(54 * viewportArea / menuArea))),
		seed: 19,
		backgroundOpacity: 0.96,
	})

	const menu = root.add([
		k.pos(
			(k.width() - MENU_WIDTH * scale) / 2,
			(k.height() - MENU_HEIGHT * scale) / 2
		),
		k.scale(scale),
	])
	const planet = addMenuPlanet(menu)
	const interfaceRoot = menu.add([k.pos(0, 0), k.opacity(1)])
	addThemedText(interfaceRoot, {
		pos: k.vec2(COMMAND_X, 198),
		text: "SPACEDAZE",
		variant: "display",
		size: UI_FONT_SIZES.logo,
		color: k.rgb(...UI_COLORS.text),
	})
	addThemedText(interfaceRoot, {
		pos: k.vec2(COMMAND_X, 258),
		text: "SELECT COMMAND",
		variant: "eyebrow",
		width: COMMAND_WIDTH,
	})

	let transitioning = false
	let confirmationDialog: UiConfirmationDialogController | undefined
	const hasSavedProfile = hasGameSave("slot1")
	const startRun = () => {
		if (transitioning || confirmationDialog?.isOpen()) return
		transitioning = true
		soundSettings.collapse()
		creditsPanel.collapse()
		startMainMenuSpaceJump({
			interfaceRoot,
			planet,
			planetTargetPos: k.vec2(MENU_WIDTH / 2, MENU_HEIGHT / 2),
			onJump: () => {
				clearMainMenu()
				changeGameState(GameState.Playing)
			},
		})
	}
	createUiCommandButton(interfaceRoot, {
		pos: k.vec2(COMMAND_X, 278),
		size: k.vec2(COMMAND_WIDTH, 44),
		index: "01",
		text: hasSavedProfile ? "CONTINUE" : "START GAME",
		trailingText: ">",
		selected: true,
		onClick: startRun,
	})

	let nextCommandY = 330
	if (hasSavedProfile) {
		addSavedProfileTelemetry(interfaceRoot)
		nextCommandY = 372
	}
	const soundSettings = createUiCollapsible(interfaceRoot, {
		pos: k.vec2(440, 270),
		createContent: addOptionsPanel,
	})
	const creditsPanel = createUiCollapsible(interfaceRoot, {
		pos: k.vec2(CREDITS_PANEL_X, 258),
		createContent: addCreditsPanel,
	})
	if (hasSavedProfile) {
		createUiCommandButton(interfaceRoot, {
			pos: k.vec2(COMMAND_X, nextCommandY),
			size: k.vec2(COMMAND_WIDTH, 34),
			index: "02",
			text: "START NEW GAME",
			trailingText: "RESET SAVE",
			onClick: () => {
				if (transitioning || confirmationDialog?.isOpen()) return
				soundSettings.collapse()
				creditsPanel.collapse()
				confirmationDialog = showUiConfirmationDialog({
					title: "START NEW GAME?",
					message: "ALL SALVAGE, UPGRADES, UNLOCKS, RUN HISTORY, AND STATISTICS WILL BE ERASED. THIS CANNOT BE UNDONE.",
					confirmText: "ERASE & START",
					cancelText: "KEEP SAVE",
					onConfirm: () => {
						confirmationDialog = undefined
						resetGameProfile()
						startRun()
					},
					onCancel: () => {
						confirmationDialog = undefined
					},
				})
			},
		})
		nextCommandY += 42
	}
	createUiCommandButton(interfaceRoot, {
		pos: k.vec2(COMMAND_X, nextCommandY),
		size: k.vec2(COMMAND_WIDTH, 36),
		index: hasSavedProfile ? "03" : "02",
		text: "OPTIONS",
		trailingText: "AUDIO / VIDEO",
		onClick: () => {
			if (transitioning) return
			creditsPanel.collapse()
			soundSettings.toggle()
		},
	})
	nextCommandY += 42
	createUiCommandButton(interfaceRoot, {
		pos: k.vec2(COMMAND_X, nextCommandY),
		size: k.vec2(COMMAND_WIDTH, 36),
		index: hasSavedProfile ? "04" : "03",
		text: "CREDITS",
		trailingText: "TEAM / AUDIO",
		onClick: () => {
			if (transitioning) return
			soundSettings.collapse()
			creditsPanel.toggle()
		},
	})

	const enterController = k.onKeyPress("enter", startRun)
	const spaceController = k.onKeyPress("space", startRun)
	const escapeController = k.onKeyPress("escape", () => {
		if (confirmationDialog?.isOpen()) return
		soundSettings.collapse()
		creditsPanel.collapse()
	})
	root.onDestroy(() => {
		confirmationDialog?.close()
		enterController.cancel()
		spaceController.cancel()
		escapeController.cancel()
	})
}

export function updateMainMenuLoop() {
	// Main menu ambience updates through its own components.
}

export function clearMainMenu() {
	k.destroyAll(tags.mainMenu)
}

function addMenuPlanet(parent: GameObj) {
	const baseY = 252
	const planet = parent.add([
		k.pos(565, baseY),
		k.sprite("bg_destroyed_planet"),
		k.anchor("center"),
		k.scale(1),
		k.color(34, 48, 55),
		k.opacity(1),
		k.layer(layers.bg),
	])
	registerBatchedUiUpdate("menu", planet, () => {
		planet.pos.y = k.wave(baseY - 6, baseY + 6, k.time() * 0.55)
	})
	addMenuPlanetChunks(planet)
	return planet
}

function addMenuPlanetChunks(planet: GameObj) {
	const chunks = [
		{
			sprite: PLANET_CHUNK_SPRITES[0],
			pos: k.vec2(-252, -168),
			scale: 0.2,
			angle: -18,
			rotationSpeed: -3.5,
			floatSpeed: 0.7,
			floatDistance: 7,
		},
		{
			sprite: PLANET_CHUNK_SPRITES[1],
			pos: k.vec2(-278, 84),
			scale: 0.16,
			angle: 24,
			rotationSpeed: 2.4,
			floatSpeed: 0.54,
			floatDistance: 9,
		},
		{
			sprite: PLANET_CHUNK_SPRITES[2],
			pos: k.vec2(-112, 266),
			scale: 0.15,
			angle: 42,
			rotationSpeed: -2,
			floatSpeed: 0.62,
			floatDistance: 6,
		},
		{
			sprite: PLANET_CHUNK_SPRITES[3],
			pos: k.vec2(108, -238),
			scale: 0.18,
			angle: -34,
			rotationSpeed: 2.8,
			floatSpeed: 0.46,
			floatDistance: 8,
		},
		{
			sprite: PLANET_CHUNK_SPRITES[0],
			pos: k.vec2(-138, -82),
			scale: 0.14,
			angle: 38,
			rotationSpeed: 4.2,
			floatSpeed: 0.82,
			floatDistance: 10,
			foreground: true,
		},
		{
			sprite: PLANET_CHUNK_SPRITES[2],
			pos: k.vec2(58, 62),
			scale: 0.12,
			angle: -26,
			rotationSpeed: -3.8,
			floatSpeed: 0.74,
			floatDistance: 9,
			foreground: true,
		},
		{
			sprite: PLANET_CHUNK_SPRITES[3],
			pos: k.vec2(-54, 178),
			scale: 0.13,
			angle: 12,
			rotationSpeed: 3.1,
			floatSpeed: 0.68,
			floatDistance: 8,
			foreground: true,
		},
	]

	chunks.forEach((config, index) => {
		const basePos = config.pos.clone()
		const chunk = planet.add([
			k.pos(basePos),
			k.sprite(config.sprite),
			k.anchor("center"),
			k.scale(config.scale),
			k.rotate(config.angle),
			k.color(
				config.foreground ? 48 : 38,
				config.foreground ? 67 : 53,
				config.foreground ? 76 : 61
			),
			k.opacity(1),
			k.z(config.foreground ? 1 : 0),
			tags.mainMenu,
		])
		registerBatchedUiUpdate("menu", chunk, () => {
			const phase = k.time() * config.floatSpeed + index * 1.7
			chunk.pos = basePos.add(
				Math.cos(phase) * config.floatDistance * 0.45,
				Math.sin(phase) * config.floatDistance
			)
			chunk.angle += config.rotationSpeed * k.dt()
		})
	})
}

function addSavedProfileTelemetry(parent: GameObj) {
	const stats = getLifetimeStats()
	createUiTelemetryStrip(parent, {
		pos: k.vec2(COMMAND_X + 8, 334),
		width: COMMAND_WIDTH - 16,
		gap: 10,
		items: [
			{ label: "RUNS", value: formatStat(stats.runs) },
			{ label: "DEATHS", value: formatStat(stats.deaths) },
			{ label: "LEVEL", value: formatStat(getHubLevel()) },
			{ label: "PLAYTIME", value: formatPlaytime(stats.playtimeSeconds) },
		],
	})
}

function addOptionsPanel(parent: GameObj) {
	createUiSurface(parent, {
		pos: k.vec2(0, 0),
		size: k.vec2(326, 192),
		tone: "raised",
		opacity: 0.98,
	})
	createUiVolumeControls(parent, {
		pos: k.vec2(0, 0),
		width: 326,
	})
}

function addCreditsPanel(parent: GameObj) {
	const width = getCreditsPanelWidth()
	const panel = createUiGrowingContainer(parent, {
		pos: k.vec2(0, 0),
		width,
		padding: {
			top: 62,
			right: 14,
			bottom: 14,
			left: 14,
		},
		gap: 3,
		tone: "raised",
		opacity: 0.98,
	})
	createUiSectionHeader(panel.obj, {
		pos: k.vec2(0, 0),
		width,
		eyebrow: "SPACEDAZE",
		title: "CREDITS",
		action: "ESC  CLOSE",
	})

	const content = panel.flow
	content.addText({
		text: "DESIGN & DEVELOPMENT",
		variant: "eyebrow",
		size: UI_FONT_SIZES.small,
		gapAfter: 2,
	})
	content.addText({
		text: "LUKAS HAKKARAINEN",
		variant: "body",
		size: UI_FONT_SIZES.small,
		gapAfter: 8,
	})
	content.addText({
		text: "FEATURED MUSIC",
		variant: "eyebrow",
		size: UI_FONT_SIZES.small,
		gapAfter: 2,
	})
	addCreditRows(content, MUSIC_CREDITS)
	content.addText({
		text: "SELECT SOUND EFFECTS",
		variant: "eyebrow",
		size: UI_FONT_SIZES.small,
		gapAfter: 2,
	})
	addCreditRows(content, SOUND_CREDITS)
	content.addText({
		text: "POWERED BY KAPLAY",
		variant: "caption",
		size: UI_FONT_SIZES.small,
	})
}

function addCreditRows(
	flow: ReturnType<typeof createUiVerticalFlow>,
	rows: readonly string[]
) {
	for (const [index, text] of rows.entries()) {
		flow.addText({
			text,
			variant: "body",
			size: UI_FONT_SIZES.small,
			gapAfter: index === rows.length - 1 ? 7 : 1,
		})
	}
}

function getCreditsPanelWidth() {
	const availableWidth = MENU_WIDTH - CREDITS_PANEL_X
	const contentWidth = Math.max(
		...[...MUSIC_CREDITS, ...SOUND_CREDITS].map((text) => k.formatText({
			text,
			size: UI_FONT_SIZES.small,
			font: "unscii",
		}).width)
	)
	return Math.min(availableWidth, Math.max(326, Math.ceil(contentWidth) + 28))
}

function formatPlaytime(totalSeconds: number) {
	const seconds = Math.floor(totalSeconds)
	const hours = Math.floor(seconds / 3600)
	const minutes = Math.floor((seconds % 3600) / 60)
	const remainder = seconds % 60
	return `${hours.toString().padStart(2, "0")}:${minutes
		.toString()
		.padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`
}

function formatStat(value: number) {
	return Math.floor(value).toLocaleString("en-US")
}
