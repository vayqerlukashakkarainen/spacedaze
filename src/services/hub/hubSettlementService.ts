export interface HubSettlementPlot {
	id: string
	requiredHubLevel: number
	position: readonly [number, number]
	groundSprite: string
	groundOffsetY: number
	builtSprite: string
	destroyedSprite?: string
	buildingOffsetY: number
	facing?: "left" | "right"
}

export const HUB_SETTLEMENT_PLOTS: readonly HubSettlementPlot[] = [
	{ id: "service-kiosk", requiredHubLevel: 1, position: [-1240, -590], groundSprite: "hub_ground_small_a", groundOffsetY: 14, builtSprite: "hub_building_service_kiosk", buildingOffsetY: -14 },
	{ id: "courier-depot", requiredHubLevel: 1, position: [-800, -610], groundSprite: "hub_ground_small_b", groundOffsetY: 9, builtSprite: "hub_building_courier_depot", buildingOffsetY: -16 },
	{ id: "scrap-sorter", requiredHubLevel: 1, position: [-1190, -150], groundSprite: "hub_ground_scrap_sorter_rocks", groundOffsetY: 0, builtSprite: "hub_building_scrap_sorter", buildingOffsetY: -22 },
	{ id: "smelter-annex", requiredHubLevel: 2, position: [-1080, 440], groundSprite: "hub_ground_smelter_annex_rocks", groundOffsetY: 0, builtSprite: "hub_building_smelter_annex", destroyedSprite: "hub_building_smelter_annex_destroyed", buildingOffsetY: -30 },
	{ id: "listening-post", requiredHubLevel: 3, position: [-300, -620], groundSprite: "hub_ground_small_b", groundOffsetY: 16, builtSprite: "hub_building_listening_post", destroyedSprite: "hub_building_listening_post_destroyed", buildingOffsetY: -36 },
	{ id: "repair-drydock", requiredHubLevel: 4, position: [-430, 610], groundSprite: "hub_ground_repair_drydock_rocks", groundOffsetY: 12, builtSprite: "hub_building_repair_drydock", destroyedSprite: "hub_building_repair_drydock_destroyed", buildingOffsetY: -16 },
	{ id: "fuel-farm", requiredHubLevel: 5, position: [250, 620], groundSprite: "hub_ground_medium_b", groundOffsetY: 18, builtSprite: "hub_building_fuel_farm", destroyedSprite: "hub_building_fuel_farm_destroyed", buildingOffsetY: -22, facing: "left" },
	{ id: "freight-terminal", requiredHubLevel: 6, position: [520, -40], groundSprite: "hub_ground_freight_terminal_rocks", groundOffsetY: 20, builtSprite: "hub_building_freight_terminal", destroyedSprite: "hub_building_freight_terminal_destroyed", buildingOffsetY: -20, facing: "left" },
	{ id: "habitat-cluster", requiredHubLevel: 7, position: [1220, 610], groundSprite: "hub_ground_habitat_cluster_rocks", groundOffsetY: 34, builtSprite: "hub_building_habitat_cluster", destroyedSprite: "hub_building_habitat_cluster_destroyed", buildingOffsetY: -32, facing: "left" },
	{ id: "observatory-crown", requiredHubLevel: 8, position: [1240, -610], groundSprite: "hub_ground_observatory_crown_rocks", groundOffsetY: 48, builtSprite: "hub_building_observatory_crown", destroyedSprite: "hub_building_observatory_crown_destroyed", buildingOffsetY: -44, facing: "left" },
]

export function getHubSettlementState(hubLevel: number) {
	return HUB_SETTLEMENT_PLOTS.map((plot) => ({
		...plot,
		built: hubLevel >= plot.requiredHubLevel,
	}))
}
