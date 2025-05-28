import { Tool } from "../upg";

export const debreeDist: Tool = {
	toolName: "Debree magnets",
	upgrades: [
		{
			name: "Level 1",
			desc: "Upgrade the ships magnetic magnets and increase debree collect distance",
			sprite: "debree_dist_upg1",
			price: 32,
			value: 1.2,
		},
		{
			name: "Level 2",
			desc: "Upgrade the ships magnetic magnets and increase debree collect distance",
			sprite: "debree_dist_upg1",
			price: 32,
			value: 1.4,
		},
		{
			name: "Level 3",
			desc: "Upgrade the ships magnetic magnets and increase debree collect distance",
			sprite: "debree_dist_upg1",
			price: 32,
			value: 1.6,
		},
		{
			name: "Level 4",
			desc: "Upgrade the ships magnetic magnets and increase debree collect distance",
			sprite: "debree_dist_upg1",
			price: 32,
			value: 1.8,
		},
		{
			name: "Level 5",
			desc: "Upgrade the ships magnetic magnets and increase debree collect distance",
			sprite: "debree_dist_upg1",
			price: 32,
			value: 2,
		},
	],
};

export const debreeSpeed: Tool = {
	toolName: "Stronger magnets",
	upgrades: [
		{
			name: "Level 1",
			desc: "Stronger magnets = faster debree, easy math",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 1.2,
		},
		{
			name: "Level 2",
			desc: "Stronger magnets = faster debree, easy math",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 1.4,
		},
		{
			name: "Level 3",
			desc: "Stronger magnets = faster debree, easy math",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 2,
		},
	],
};

export const sprint: Tool = {
	toolName: "Thrusters overclock",
	upgrades: [
		{
			name: "Level 1",
			desc: "Hold SHIFT to overclock thrusters, increasing speed",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 1.2,
		},
		{
			name: "Level 2",
			desc: "Increase speed when overclocking thrusters",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 1.4,
		},
	],
};

export const sprintSpeed: Tool = {
	toolName: "Thrusters cooling",
	requiredTool: "sprint",
	upgrades: [
		{
			name: "Level 1",
			desc: "Overclocking thrusters gains more speed",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 1.3,
		},
		{
			name: "Level 2",
			desc: "Overclocking thrusters gains more speed",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 1.4,
		},
	],
};

export const movespeed: Tool = {
	toolName: "Upgraded thrusters",
	upgrades: [
		{
			name: "Level 1",
			desc: "Increase ship move speed",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 1.05,
		},
		{
			name: "Level 2",
			desc: "Increase ship move speed",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 1.15,
		},
	],
};

export const debreeValue: Tool = {
	toolName: "Shiny debree",
	requiredTool: "debreeDist",
	upgrades: [
		{
			name: "Level 1",
			desc: "Debree becomes more valueable, who could have thought",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 2,
		},
		{
			name: "Level 2",
			desc: "Debree becomes almost as valuable as gold",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 3,
		},
	],
};

export const maxHealth: Tool = {
	toolName: "Stronger hull",
	upgrades: [
		{
			name: "Level 1",
			desc: "Upgrade hull and increase health by one",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 3,
		},
		{
			name: "Level 2",
			desc: "Upgrade hull and increase health by one",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 4,
		},
		{
			name: "Level 3",
			desc: "Upgrade hull and increase health by one",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 5,
		},
		{
			name: "Level 4",
			desc: "Upgrade hull and increase health by one",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 6,
		},
		{
			name: "Level 5",
			desc: "Upgrade hull and increase health by one",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 7,
		},
		{
			name: "Level 6",
			desc: "Upgrade hull and increase health by one",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 8,
		},
		{
			name: "Level 7",
			desc: "Upgrade hull and increase health by one",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 9,
		},
		{
			name: "Level 8",
			desc: "Upgrade hull and increase health by one",
			sprite: "debree_speed_upg1",
			price: 32,
			value: 10,
		},
	],
};
