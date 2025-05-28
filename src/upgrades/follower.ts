import { Tool } from "../upg";

export const follower: Tool = {
	toolName: "Followers",
	upgrades: [
		{
			name: "Level 1",
			desc: "Purchase a follower for your social media account",
			sprite: "rocket_upg1",
			price: 22,
			value: 1,
		},
		{
			name: "Level 2",
			desc: "Your social media is blowing up",
			sprite: "rocket_upg1",
			price: 22,
			value: 2,
		},
		{
			name: "Level 3",
			desc: "Wow, you are popular!!",
			sprite: "rocket_upg1",
			price: 22,
			value: 3,
		},
		{
			name: "Level 4",
			desc: "Alright rockstar...",
			sprite: "rocket_upg1",
			price: 22,
			value: 10,
		},
	],
};

export const followerBlasterDmg: Tool = {
	toolName: "Followers",
	requiredTool: "follower",
	upgrades: [
		{
			name: "Level 1",
			desc: "Increase your followers social media likes",
			sprite: "rocket_upg1",
			price: 22,
			value: 1,
		},
		{
			name: "Level 2",
			desc: "Too... Many... Likes...",
			sprite: "rocket_upg1",
			price: 22,
			value: 2,
		},
	],
};

export const followerMissiles: Tool = {
	toolName: "Followers",
	requiredTool: "follower",
	upgrades: [
		{
			name: "Level 1",
			desc: "Your followers will become quite dangerous",
			sprite: "rocket_upg1",
			price: 22,
			value: 1,
		},
	],
};
