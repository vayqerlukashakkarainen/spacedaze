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
	toolName: "Missile drone conversion",
	upgrades: [
		{
			name: "Missile Drone",
			desc: "Convert one combat drone into a dedicated missile drone",
			sprite: "drone_missile",
			price: 22,
			value: 1,
		},
	],
};

export const followerProjectileLink: Tool = {
	toolName: "Drone projectile link",
	upgrades: [
		{
			name: "Neural Ballistics Link",
			desc: "Armed drones inherit your projectile modifiers",
			sprite: "arc_capacitor_upg1",
			price: 30,
			value: 1,
		},
	],
};

export const followerInterceptorProtocol: Tool = {
	toolName: "Interceptor drone conversion",
	requirements: {
		anyOf: [
			{ toolKey: "followerBlasterDmg" },
			{ toolKey: "followerMissiles" },
		],
	},
	upgrades: [
		{
			name: "Interceptor Drone",
			desc: "Convert one combat drone into a fast projectile interceptor",
			sprite: "drone_interceptor",
			price: 32,
			value: 1,
		},
	],
};

export const followerGunship: Tool = {
	toolName: "Gunship drone conversion",
	requirements: { anyOf: [{ toolKey: "followerBlasterDmg" }] },
	upgrades: [{
		name: "Gunship Drone",
		desc: "Convert one combat drone into a slow heavy cannon platform",
		sprite: "drone_gunship",
		price: 34,
		value: 1,
	}],
};

export const followerMedic: Tool = {
	toolName: "Medic drone conversion",
	requirements: { anyOf: [{ toolKey: "followerBlasterDmg" }] },
	upgrades: [{
		name: "Medic Drone",
		desc: "Convert one combat drone into a rear-guard medic that repairs hull after eight kills",
		sprite: "drone_medic",
		price: 38,
		value: 1,
	}],
};

export const followerSalvager: Tool = {
	toolName: "Salvager drone conversion",
	requirements: { anyOf: [{ toolKey: "followerBlasterDmg" }] },
	upgrades: [{
		name: "Salvager Drone",
		desc: "Convert one combat drone into an autonomous debris collector",
		sprite: "drone_salvager",
		price: 30,
		value: 1,
	}],
};
