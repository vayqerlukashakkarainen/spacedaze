import { UpgradeDefinition } from "../types/upgradeTypes";

export const followerBlasterDmg: UpgradeDefinition = {
	toolKey: "followerBlasterDmg",
	toolName: "Followers",
	category: "combat",
	type: "stat",
	levels: [
		{
			name: "Level 1",
			desc: "Increase your followers blaster damage",
			sprite: "follower_blaster_dmg_upg1",
			price: 22,
			effects: {
				modifiers: [{ stat: "followerBlasterDmg", value: 1, type: "base" }],
			},
		},
		{
			name: "Level 2",
			desc: "Too... Many... Damage... Numbers...",
			sprite: "follower_blaster_dmg_upg1",
			price: 22,
			effects: {
				modifiers: [{ stat: "followerBlasterDmg", value: 2, type: "base" }],
			},
		},
	],
};

export const followerMissiles: UpgradeDefinition = {
	toolKey: "followerMissiles",
	toolName: "Missile drone conversion",
	category: "combat",
	type: "unlock",
	levels: [
		{
			name: "Missile Drone",
			desc: "Convert one combat drone into a dedicated missile drone",
			sprite: "drone_missile",
			price: 22,
			effects: {
				unlocks: [
					{
						unlockId: "followerMissiles",
						description: "One combat drone becomes a missile drone",
					},
				],
			},
		},
	],
};

export const followerProjectileLink: UpgradeDefinition = {
	toolKey: "followerProjectileLink",
	toolName: "Drone projectile link",
	category: "combat",
	type: "unlock",
	levels: [
		{
			name: "Neural Ballistics Link",
			desc: "Armed drones inherit your projectile modifiers",
			sprite: "arc_capacitor_upg1",
			price: 30,
			effects: {
				unlocks: [
					{
						unlockId: "followerProjectileLink",
						description: "Armed drones inherit projectile modifiers",
					},
				],
			},
		},
	],
};

export const followerInterceptorProtocol: UpgradeDefinition = {
	toolKey: "followerInterceptorProtocol",
	toolName: "Interceptor drone conversion",
	category: "combat",
	type: "unlock",
	requirements: {
		anyOf: [
			{ toolKey: "followerBlasterDmg" },
			{ toolKey: "followerMissiles" },
		],
	},
	levels: [
		{
			name: "Interceptor Drone",
			desc: "Convert one combat drone into a fast projectile interceptor",
			sprite: "drone_interceptor",
			price: 32,
			effects: {
				unlocks: [
					{
						unlockId: "followerInterceptorProtocol",
						description: "One combat drone becomes an interceptor",
					},
				],
			},
		},
	],
};

export const followerGunship: UpgradeDefinition = {
	toolKey: "followerGunship",
	toolName: "Gunship drone conversion",
	category: "combat",
	type: "unlock",
	requirements: { anyOf: [{ toolKey: "followerBlasterDmg" }] },
	levels: [{
		name: "Gunship Drone",
		desc: "Convert one combat drone into a slow heavy cannon platform",
		sprite: "drone_gunship",
		price: 34,
		effects: {
			unlocks: [{
				unlockId: "followerGunship",
				description: "One combat drone becomes a gunship",
			}],
		},
	}],
};

export const followerMedic: UpgradeDefinition = {
	toolKey: "followerMedic",
	toolName: "Medic drone conversion",
	category: "survival",
	type: "unlock",
	requirements: { anyOf: [{ toolKey: "followerBlasterDmg" }] },
	levels: [{
		name: "Medic Drone",
		desc: "Convert one combat drone into a rear-guard medic that repairs hull after eight kills",
		sprite: "drone_medic",
		price: 38,
		effects: {
			unlocks: [{
				unlockId: "followerMedic",
				description: "One combat drone becomes a medic",
			}],
		},
	}],
};

export const followerSalvager: UpgradeDefinition = {
	toolKey: "followerSalvager",
	toolName: "Salvager drone conversion",
	category: "resources",
	type: "unlock",
	requirements: { anyOf: [{ toolKey: "followerBlasterDmg" }] },
	levels: [{
		name: "Salvager Drone",
		desc: "Convert one combat drone into an autonomous debris collector",
		sprite: "drone_salvager",
		price: 30,
		effects: {
			unlocks: [{
				unlockId: "followerSalvager",
				description: "One combat drone becomes a salvager",
			}],
		},
	}],
};
