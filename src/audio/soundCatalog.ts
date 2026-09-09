import type { KAPLAYCtx } from "kaplay"

export const SOUND_ASSETS = {
	shoot1: "sounds/shoot1.wav",
	enemy_blaster_01: "sounds/enemy-blaster-01.wav",
	enemy_blaster_02: "sounds/enemy-blaster-02.wav",
	enemy_blaster_03: "sounds/enemy-blaster-03.wav",
	enemy_blaster_04: "sounds/enemy-blaster-04.wav",
	enemy_blaster_05: "sounds/enemy-blaster-05.wav",
	enemy_blaster_06: "sounds/enemy-blaster-06.wav",
	enemy_blaster_07: "sounds/enemy-blaster-07.wav",
	enemy_blaster_08: "sounds/enemy-blaster-08.wav",
	enemy_blaster_09: "sounds/enemy-blaster-09.wav",
	enemy_blaster_10: "sounds/enemy-blaster-10.wav",
	weapon_standard_blaster_fire: "sounds/standard-blaster.wav",
	weapon_twin_needle_fire: "sounds/twin-needle.wav",
	weapon_plasma_mortar_fire: "sounds/plasma-mortar-fire.wav",
	weapon_plasma_mortar_explosion: "sounds/plasma-mortar-explosion.mp3",
	weapon_plasma_explosion_gearpile: "sounds/plasma-explosion-gearpile.mp3",
	weapon_plasma_explosion_flashtrauma: "sounds/plasma-explosion-flashtrauma.mp3",
	weapon_scatter_array: "sounds/laser-shoot-2.wav",
	weapon_burst_driver: "sounds/burst-driver.mp3",
	rammer_launch: "sounds/rammer-launch.wav",
	lay_mine: "sounds/lay-mine.wav",
	active_module_carrier_launch: "sounds/active-module-carrier-launch.ogg",
	target_lock: "sounds/target-lock.wav",
	fire_rocket1: "sounds/rocket_fire1.wav",
	explosion1: "sounds/explosion1.wav",
	explosion2: "sounds/explosion2.wav",
	explosion3: "sounds/explosion3.wav",
	explosion4: "sounds/explosion4.wav",
	hit1: "sounds/hit1.wav",
	hit2: "sounds/hit2.wav",
	hit_light_metal: "sounds/light-metal-hit.wav",
	asteroid_impact_1: "sounds/asteroid-impact-1.ogg",
	asteroid_impact_2: "sounds/asteroid-impact-2.ogg",
	asteroid_impact_3: "sounds/asteroid-impact-3.ogg",
	asteroid_destroyed: "sounds/asteroid-destroyed.ogg",
	player_hit1: "sounds/player_hit1.wav",
	player_game_over: "sounds/game-over-arcade.mp3",
	low_health_warning: "sounds/low-health-warning.mp3",
	collect1: "sounds/collect1.wav",
	salvage_pickup: "sounds/salvage-pickup.mp3",
	click1: "sounds/click.wav",
	ui_hover: "sounds/ui-hover.wav",
	ui_click: "sounds/ui-click.wav",
	text_print: "sounds/text-print.wav",
	system_error: "sounds/system-error.mp3",
	dialogue_scramble: "sounds/scrambled-telecommunications.mp3",
	purchase: "sounds/purchase.wav",
	error: "sounds/error.wav",
	empty_secondary_error: "sounds/empty-secondary-error.mp3",
	purchase1: "sounds/purchase1.wav",
	powerup1: "sounds/powerup1.wav",
	rail_lance_charge: "sounds/rail-lance-charge.wav",
	rail_lance_ready: "sounds/rail-lance-ready.wav",
	primary_weapon_charge: "sounds/primary-weapon-charge.wav",
	weapon_rail_lance_fire: "sounds/rail-lance-fire.wav",
	run_level_up: "sounds/run-level-up.mp3",
	room_cleared: "sounds/room-cleared.mp3",
	crit1: "sounds/crit1.wav",
	slowdown: "sounds/slowdown.wav",
	going_fast: "sounds/going-fast.wav",
	mobility_phase_jump: "sounds/phase-jump.wav",
	swap_level: "sounds/swap_level.wav",
	hostile_phase_arrival: "sounds/hostile-phase-arrival.mp3",
	menu_spacejump_warp: "sounds/menu-spacejump-warp.mp3",
	player_arrival_impact: "sounds/player-arrival-impact.mp3",
	warp_landing_bass: "sounds/extreme-bass.wav",
	hyperspeed_jump_start: "sounds/hyperspeed-jump-start.mp3",
	hyperspeed_travel: "sounds/hyperspeed-travel.mp3",
	wormhole_rampup: "sounds/wormhole-rampup.mp3",
	wormhole_ambience: "sounds/wormhole-ambience.mp3",
	burt_repair_hammer: "sounds/burt-repair-hammer.mp3",
	burt_repair_tool: "sounds/burt-repair-tool.mp3",
	burt_strafe_module_eject: "sounds/burt-strafe-module-eject.mp3",
	secret_cavern_reveal: "sounds/secret-cavern-reveal.mp3",
	reward_riser_epic: "sounds/reward-riser-epic.mp3",
	reward_riser_legendary: "sounds/reward-riser-legendary.mp3",
	reward_shine_legendary: "sounds/reward-shine-legendary.mp3",
	high_rarity_reveal: "sounds/high-rarity-reveal.mp3",
	perfect_chest_open: "sounds/perfect-chest-open.mp3",
	shop_menu_open: "sounds/shop-menu-open.mp3",
	shop_menu_close: "sounds/shop-menu-close.mp3",
	golden_crate_destroyed: "sounds/golden-crate-destroyed.mp3",
	birthday_upbeat: "sounds/birthday-upbeat-preview.mp3",
} as const

export const MUSIC_ASSETS = {
	arcadia: "songs/arcadia.mp3",
	flirtFlirtOhItHurts: "songs/flirt-flirt-oh-it-hurts.mp3",
	hub: "songs/hub.mp3",
	burts_recovery: "songs/burts-recovery.mp3",
	ambientSpaceNoise: "songs/ambient-space-noise.mp3",
	shirobon_on_the_run: "songs/shirobon-on-the-run.mp3",
	shirobon_fox: "songs/shirobon-fox.mp3",
} as const

export type SoundAssetId = keyof typeof SOUND_ASSETS
export type MusicAssetId = keyof typeof MUSIC_ASSETS

export function isSoundAssetId(value: string): value is SoundAssetId {
	return Object.hasOwn(SOUND_ASSETS, value)
}

export function isMusicAssetId(value: string): value is MusicAssetId {
	return Object.hasOwn(MUSIC_ASSETS, value)
}

export async function loadAudioAssets(k: KAPLAYCtx) {
	for (const [id, path] of Object.entries(SOUND_ASSETS)) {
		await k.loadSound(id, path)
	}
	for (const [id, path] of Object.entries(MUSIC_ASSETS)) {
		await k.loadMusic(id, path)
	}
}
