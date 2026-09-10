import { asteroidRunnerDialogue } from "./asteroidRunner"
import { birthdayPairDialogue } from "./birthdayPair"
import { getLampKeeperDialogue } from "./lampKeeper"
import { prologueDialogue } from "./prologue"
import { prologueRecoveryDialogue } from "./prologueRecovery"
import { rangeKeeperDialogue } from "./rangeKeeper"
import { shopkeeperDialogue } from "./shopkeeper"
import { strafeTrainingDialogue } from "./strafeTraining"
import type { DialogueLine } from "./types"

export const dialogue = {
	asteroidRunner: asteroidRunnerDialogue,
	birthdayPair: birthdayPairDialogue,
	lampKeeper: getLampKeeperDialogue,
	prologue: prologueDialogue,
	prologueRecovery: prologueRecoveryDialogue,
	rangeKeeper: rangeKeeperDialogue,
	shopkeeper: shopkeeperDialogue,
	strafeTraining: strafeTrainingDialogue,
} as const

export function validateDialogueCatalog(root: unknown = dialogue) {
	const errors: string[] = []
	visitDialogueContent(root, "dialogue", errors, new Map())
	return errors
}

function visitDialogueContent(
	value: unknown,
	path: string,
	errors: string[],
	ids: Map<string, string>
) {
	if (typeof value === "function" || value === undefined || value === null) return
	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index++) {
			visitDialogueContent(value[index], `${path}[${index}]`, errors, ids)
		}
		return
	}
	if (typeof value !== "object") return
	if (isDialogueLine(value)) {
		validateDialogueLine(value, path, errors)
		return
	}
	if ("id" in value && typeof value.id === "string") {
		const existingPath = ids.get(value.id)
		if (existingPath) {
			errors.push(`${path}: duplicate id "${value.id}" (first used at ${existingPath})`)
		} else {
			ids.set(value.id, path)
		}
	}
	for (const [key, child] of Object.entries(value)) {
		visitDialogueContent(child, `${path}.${key}`, errors, ids)
	}
}

function isDialogueLine(value: object): value is DialogueLine {
	return "speaker" in value && "text" in value
}

function validateDialogueLine(
	line: DialogueLine,
	path: string,
	errors: string[]
) {
	if (line.speaker.trim().length === 0) errors.push(`${path}: missing speaker`)
	if (typeof line.text === "string") {
		if (line.text.trim().length === 0) errors.push(`${path}: empty text`)
		return
	}
	if (line.text.length === 0) {
		errors.push(`${path}: empty text segments`)
		return
	}
	if (line.text.every((segment) => segment.text.length === 0)) {
		errors.push(`${path}: empty segmented text`)
	}
}
