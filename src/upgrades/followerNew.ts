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
	toolName: "Follower missiles",
	category: "combat",
	type: "unlock",
	levels: [
		{
			name: "Level 1",
			desc: "Your followers will become quite dangerous (with missiles)",
			sprite: "follower_missiles_upg1",
			price: 22,
			effects: {
				unlocks: [
					{
						unlockId: "followerMissiles",
						description: "Followers can fire missiles",
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
			desc: "Combat drones inherit your projectile modifiers",
			sprite: "arc_capacitor_upg1",
			price: 30,
			effects: {
				unlocks: [
					{
						unlockId: "followerProjectileLink",
						description: "Drones inherit projectile modifiers",
					},
				],
			},
		},
	],
};
