import type {
	KAPLAYCtx,
	Key,
	KEventController,
	MouseButton,
} from "kaplay"

export type InputActionId =
	| "moveUp"
	| "moveDown"
	| "moveLeft"
	| "moveRight"
	| "strafe"
	| "primary"
	| "secondary"
	| "mobility"
	| "ultimate"
	| "previousPrimary"
	| "nextPrimary"
	| "interact"
	| "tacticalMap"
	| "pause"

export type InputActionGroup = "FLIGHT" | "COMBAT" | "SYSTEMS"

export type InputBinding =
	| { device: "key"; input: Key }
	| { device: "mouse"; input: MouseButton }

export interface InputActionDefinition {
	id: InputActionId
	label: string
	group: InputActionGroup
	defaultBinding: InputBinding
}

export interface InputBindingChange {
	action: InputActionId
	binding: InputBinding
	swappedAction?: InputActionId
	swappedBinding?: InputBinding
}

export interface InputController {
	cancel: () => void
}

interface InputCaptureOptions {
	onBound: (change: InputBindingChange) => void
	onCancel?: () => void
}

const INPUT_BINDINGS_KEY = "spacedaze_input_bindings_v1"
const MOUSE_BUTTONS: readonly MouseButton[] = [
	"left",
	"right",
	"middle",
	"back",
	"forward",
]

export const INPUT_ACTIONS: readonly InputActionDefinition[] = [
	{
		id: "moveUp",
		label: "MOVE UP",
		group: "FLIGHT",
		defaultBinding: { device: "key", input: "w" },
	},
	{
		id: "moveDown",
		label: "MOVE DOWN",
		group: "FLIGHT",
		defaultBinding: { device: "key", input: "s" },
	},
	{
		id: "moveLeft",
		label: "MOVE LEFT",
		group: "FLIGHT",
		defaultBinding: { device: "key", input: "a" },
	},
	{
		id: "moveRight",
		label: "MOVE RIGHT",
		group: "FLIGHT",
		defaultBinding: { device: "key", input: "d" },
	},
	{
		id: "strafe",
		label: "STRAFE MODE",
		group: "FLIGHT",
		defaultBinding: { device: "key", input: "space" },
	},
	{
		id: "primary",
		label: "PRIMARY FIRE",
		group: "COMBAT",
		defaultBinding: { device: "mouse", input: "left" },
	},
	{
		id: "secondary",
		label: "SECONDARY",
		group: "COMBAT",
		defaultBinding: { device: "key", input: "shift" },
	},
	{
		id: "mobility",
		label: "MOBILITY",
		group: "COMBAT",
		defaultBinding: { device: "mouse", input: "right" },
	},
	{
		id: "ultimate",
		label: "ULTIMATE",
		group: "COMBAT",
		defaultBinding: { device: "key", input: "r" },
	},
	{
		id: "previousPrimary",
		label: "PREVIOUS PRIMARY",
		group: "COMBAT",
		defaultBinding: { device: "key", input: "q" },
	},
	{
		id: "nextPrimary",
		label: "NEXT PRIMARY",
		group: "COMBAT",
		defaultBinding: { device: "key", input: "e" },
	},
	{
		id: "interact",
		label: "INTERACT",
		group: "SYSTEMS",
		defaultBinding: { device: "key", input: "f" },
	},
	{
		id: "tacticalMap",
		label: "TACTICAL MAP",
		group: "SYSTEMS",
		defaultBinding: { device: "key", input: "tab" },
	},
	{
		id: "pause",
		label: "PAUSE / BACK",
		group: "SYSTEMS",
		defaultBinding: { device: "key", input: "escape" },
	},
] as const

const actionDefinitions = new Map(
	INPUT_ACTIONS.map((action) => [action.id, action])
)
let kaplayContext: KAPLAYCtx | undefined
let bindings = loadInputBindings()
let runtimeControllers: KEventController[] = []
let activeCapture: {
	controllers: KEventController[]
	onCancel?: () => void
} | undefined
const bindingListeners = new Set<() => void>()
const pressListeners = createActionListenerMap()
const releaseListeners = createActionListenerMap()

export function installInputBindingService(k: KAPLAYCtx) {
	for (const controller of runtimeControllers) controller.cancel()
	kaplayContext = k
	runtimeControllers = [
		k.onKeyPress((key) => dispatchInput("key", key, pressListeners)),
		k.onMousePress((button) => dispatchInput("mouse", button, pressListeners)),
		k.onKeyRelease((key) => dispatchInput("key", key, releaseListeners)),
		k.onMouseRelease((button) =>
			dispatchInput("mouse", button, releaseListeners)
		),
	]
}

export function getInputBinding(action: InputActionId): InputBinding {
	return cloneBinding(bindings[action])
}

export function getInputActionDefinition(action: InputActionId) {
	return actionDefinitions.get(action)!
}

export function isInputActionDown(action: InputActionId) {
	if (!kaplayContext || activeCapture) return false
	const binding = bindings[action]
	return binding.device === "key"
		? kaplayContext.isKeyDown(binding.input)
		: kaplayContext.isMouseDown(binding.input)
}

export function onInputActionPress(
	action: InputActionId,
	callback: () => void
): InputController {
	pressListeners.get(action)!.add(callback)
	return {
		cancel: () => pressListeners.get(action)!.delete(callback),
	}
}

export function onInputActionRelease(
	action: InputActionId,
	callback: () => void
): InputController {
	releaseListeners.get(action)!.add(callback)
	return {
		cancel: () => releaseListeners.get(action)!.delete(callback),
	}
}

export function rebindInputAction(
	action: InputActionId,
	binding: InputBinding
): InputBindingChange {
	const previousBinding = bindings[action]
	const swappedAction = INPUT_ACTIONS.find((candidate) =>
		candidate.id !== action && bindingsEqual(bindings[candidate.id], binding)
	)?.id

	bindings[action] = cloneBinding(binding)
	if (swappedAction) bindings[swappedAction] = cloneBinding(previousBinding)
	saveInputBindings()
	notifyBindingListeners()
	return {
		action,
		binding: cloneBinding(binding),
		swappedAction,
		swappedBinding: swappedAction ? cloneBinding(previousBinding) : undefined,
	}
}

export function resetInputBindings() {
	bindings = createDefaultBindings()
	saveInputBindings()
	notifyBindingListeners()
}

export function onInputBindingsChanged(listener: () => void) {
	bindingListeners.add(listener)
	return () => bindingListeners.delete(listener)
}

export function beginInputBindingCapture(
	action: InputActionId,
	options: InputCaptureOptions
): InputController {
	cancelInputBindingCapture()
	if (!kaplayContext) return emptyController()

	const finish = (binding: InputBinding) => {
		const capture = activeCapture
		if (!capture) return
		activeCapture = undefined
		for (const controller of capture.controllers) controller.cancel()
		options.onBound(rebindInputAction(action, binding))
	}
	const cancel = () => {
		const capture = activeCapture
		if (!capture) return
		activeCapture = undefined
		for (const controller of capture.controllers) controller.cancel()
		capture.onCancel?.()
	}
	const controllers = [
		kaplayContext.onKeyPress((key) => {
			if (key === "escape") {
				cancel()
				return
			}
			if (!validKey(key)) return
			finish({ device: "key", input: key })
		}),
		kaplayContext.onMousePress((button) => {
			finish({ device: "mouse", input: button })
		}),
	]
	activeCapture = { controllers, onCancel: options.onCancel }
	return { cancel }
}

export function cancelInputBindingCapture() {
	const capture = activeCapture
	if (!capture) return
	activeCapture = undefined
	for (const controller of capture.controllers) controller.cancel()
	capture.onCancel?.()
}

export function inputBindingCaptureActive() {
	return Boolean(activeCapture)
}

export function formatInputBinding(binding: InputBinding) {
	if (binding.device === "mouse") {
		return `${binding.input.toUpperCase()} MOUSE`
	}
	const labels: Record<string, string> = {
		" ": "SPACE",
		control: "CTRL",
		escape: "ESC",
	}
	return labels[binding.input] ?? binding.input.toUpperCase()
}

export function formatInputBindingCompact(binding: InputBinding) {
	if (binding.device === "mouse") {
		const labels: Record<MouseButton, string> = {
			left: "M1",
			right: "M2",
			middle: "M3",
			back: "M4",
			forward: "M5",
		}
		return labels[binding.input]
	}
	const labels: Record<string, string> = {
		" ": "SPC",
		space: "SPC",
		control: "CTL",
		escape: "ESC",
		shift: "SHF",
	}
	return labels[binding.input] ?? binding.input.toUpperCase()
}

function loadInputBindings(): Record<InputActionId, InputBinding> {
	const defaults = createDefaultBindings()
	if (typeof localStorage === "undefined") return defaults
	try {
		const saved = JSON.parse(
			localStorage.getItem(INPUT_BINDINGS_KEY) ?? "{}"
		) as Partial<Record<InputActionId, unknown>>
		for (const action of INPUT_ACTIONS) {
			const binding = saved[action.id]
			if (!validBinding(binding)) continue
			const previousBinding = defaults[action.id]
			const currentOwner = INPUT_ACTIONS.find((candidate) =>
				candidate.id !== action.id &&
				bindingsEqual(defaults[candidate.id], binding)
			)?.id
			defaults[action.id] = cloneBinding(binding)
			if (currentOwner) defaults[currentOwner] = cloneBinding(previousBinding)
		}
		return defaults
	} catch {
		return defaults
	}
}

function createDefaultBindings(): Record<InputActionId, InputBinding> {
	return Object.fromEntries(
		INPUT_ACTIONS.map((action) => [
			action.id,
			cloneBinding(action.defaultBinding),
		])
	) as Record<InputActionId, InputBinding>
}

function saveInputBindings() {
	if (typeof localStorage === "undefined") return
	localStorage.setItem(INPUT_BINDINGS_KEY, JSON.stringify(bindings))
}

function notifyBindingListeners() {
	for (const listener of bindingListeners) listener()
}

function validBinding(value: unknown): value is InputBinding {
	if (!value || typeof value !== "object") return false
	const binding = value as Partial<InputBinding>
	if (binding.device === "key") return validKey(binding.input)
	return binding.device === "mouse" &&
		typeof binding.input === "string" &&
		MOUSE_BUTTONS.includes(binding.input as MouseButton)
}

function validKey(value: unknown): value is Key {
	return typeof value === "string" &&
		value.length > 0 &&
		value.length <= 24 &&
		value !== "any"
}

function bindingMatches(
	binding: InputBinding,
	device: InputBinding["device"],
	input: string
) {
	return binding.device === device && binding.input === input
}

function createActionListenerMap() {
	return new Map<InputActionId, Set<() => void>>(
		INPUT_ACTIONS.map((action) => [action.id, new Set()])
	)
}

function dispatchInput(
	device: InputBinding["device"],
	input: string,
	listeners: Map<InputActionId, Set<() => void>>
) {
	if (activeCapture) return
	const action = INPUT_ACTIONS.find((candidate) =>
		bindingMatches(bindings[candidate.id], device, input)
	)
	if (!action) return
	for (const listener of listeners.get(action.id)!) listener()
}

function bindingsEqual(first: InputBinding, second: InputBinding) {
	return first.device === second.device && first.input === second.input
}

function cloneBinding(binding: InputBinding): InputBinding {
	return { ...binding }
}

function emptyController(): InputController {
	return { cancel: () => {} }
}
