export function hubSettlementAtlasEntry(
	index: number,
	width: number,
	height: number
) {
	return {
		x: index % 4 * 256,
		y: Math.floor(index / 4) * 192,
		width,
		height,
	}
}

export const HUB_SETTLEMENT_ATLAS = {
	hub_building_service_kiosk: hubSettlementAtlasEntry(0, 64, 64),
	hub_building_courier_depot: hubSettlementAtlasEntry(1, 96, 64),
	hub_building_scrap_sorter: hubSettlementAtlasEntry(2, 96, 96),
	hub_building_smelter_annex: hubSettlementAtlasEntry(3, 128, 96),
	hub_building_listening_post: hubSettlementAtlasEntry(4, 96, 128),
	hub_building_repair_drydock: hubSettlementAtlasEntry(5, 160, 128),
	hub_building_fuel_farm: hubSettlementAtlasEntry(6, 128, 128),
	hub_building_freight_terminal: hubSettlementAtlasEntry(7, 192, 128),
	hub_building_habitat_cluster: hubSettlementAtlasEntry(8, 192, 192),
	hub_building_observatory_crown: hubSettlementAtlasEntry(9, 256, 192),
	hub_building_smelter_annex_destroyed: hubSettlementAtlasEntry(10, 128, 96),
	hub_building_listening_post_destroyed: hubSettlementAtlasEntry(11, 96, 128),
	hub_building_repair_drydock_destroyed: hubSettlementAtlasEntry(12, 160, 128),
	hub_building_fuel_farm_destroyed: hubSettlementAtlasEntry(13, 128, 128),
	hub_building_freight_terminal_destroyed: hubSettlementAtlasEntry(14, 192, 128),
	hub_building_habitat_cluster_destroyed: hubSettlementAtlasEntry(15, 192, 192),
	hub_building_observatory_crown_destroyed: hubSettlementAtlasEntry(16, 256, 192),
	hub_ground_small_a: hubSettlementAtlasEntry(17, 96, 64),
	hub_ground_small_b: hubSettlementAtlasEntry(18, 128, 96),
	hub_ground_medium_a: hubSettlementAtlasEntry(19, 160, 112),
	hub_ground_medium_b: hubSettlementAtlasEntry(20, 192, 128),
	hub_ground_large_a: hubSettlementAtlasEntry(21, 224, 160),
	hub_ground_large_b: hubSettlementAtlasEntry(22, 256, 192),
}

export const HUB_SETTLEMENT_ROCK_FOUNDATION_ATLAS = {
	hub_ground_scrap_sorter_rocks: { x: 0, y: 0, width: 200, height: 152 },
	hub_ground_smelter_annex_rocks: { x: 208, y: 0, width: 208, height: 160 },
	hub_ground_repair_drydock_rocks: { x: 424, y: 0, width: 256, height: 192 },
	hub_ground_freight_terminal_rocks: { x: 0, y: 256, width: 288, height: 208 },
	hub_ground_habitat_cluster_rocks: { x: 296, y: 256, width: 320, height: 224 },
	hub_ground_observatory_crown_rocks: { x: 624, y: 256, width: 320, height: 240 },
}
