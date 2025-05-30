import { Tool } from "../upg";

export const followerBlasterDmg: Tool = {
	toolName: "Followers",
	upgrades: [
		{
			name: "Level 1",
			desc: "Increase your followers blaster damage",
			sprite: "follower_blaster_dmg_upg1",
			price: 22,
			value: 1,
		},
		{
			name: "Level 2",
			desc: "Too... Many... Damage... Numbers...",
			sprite: "follower_blaster_dmg_upg1",
			price: 22,
			value: 2,
		},
	],
};

export const followerMissiles: Tool = {
	toolName: "Followers",
	upgrades: [
		{
			name: "Level 1",
			desc: "Your followers will become quite dangerous (with missiles)",
			sprite: "follower_missiles_upg1",
			price: 22,
			value: 1,
		},
	],
};
