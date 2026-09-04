import type { KAPLAYCtx } from "kaplay"

const INITIAL_ASSET_COUNT = 170
const TRACKED_LOADERS = new Set([
	"loadBitmapFont",
	"loadMusic",
	"loadShader",
	"loadSound",
	"loadSprite",
	"loadSpriteAtlas",
])

export interface LoadingScreen {
	assetStarted(label: string): void
	assetFinished(): void
	fail(label: string): void
	finish(): void
}

function getElement<T extends HTMLElement>(id: string) {
	const element = document.getElementById(id)
	if (!element) throw new Error(`Missing loading screen element: ${id}`)
	return element as T
}

export function createLoadingScreen(): LoadingScreen {
	const root = getElement<HTMLDivElement>("loading-screen")
	const current = getElement<HTMLDivElement>("loading-current")
	const bar = getElement<HTMLDivElement>("loading-bar")
	const percent = getElement<HTMLDivElement>("loading-percent")
	const track = root.querySelector<HTMLElement>(".loading-track")
	let completedAssets = 0
	let hidden = false

	function renderProgress(progress: number) {
		const percentage = Math.round(Math.min(Math.max(progress, 0), 1) * 100)
		bar.style.width = `${percentage}%`
		percent.textContent = `${percentage}%`
		track?.setAttribute("aria-valuenow", String(percentage))
	}

	return {
		assetStarted(label: string) {
			if (hidden) return
			current.textContent = label
		},
		assetFinished() {
			if (hidden) return
			completedAssets++
			renderProgress(completedAssets / INITIAL_ASSET_COUNT)
		},
		fail(label: string) {
			current.textContent = `Failed: ${label}`
			current.style.color = "#ff4057"
		},
		finish() {
			if (hidden) return
			hidden = true
			current.textContent = "Ready"
			renderProgress(1)
			requestAnimationFrame(() => {
				root.classList.add("is-hidden")
				window.setTimeout(() => root.remove(), 200)
			})
		},
	}
}

function describeAsset(loader: string, args: unknown[]) {
	if (loader === "loadShader") return `Compiling shader: ${String(args[0])}`
	const sourceIndex = loader === "loadSpriteAtlas" ? 0 : 1
	const source = args[sourceIndex]
	if (typeof source === "string") return `Loading: ${source}`
	return `Loading: ${String(args[0])}`
}

export function trackInitialAssets(
	k: KAPLAYCtx,
	loadingScreen: LoadingScreen
) {
	return new Proxy(k, {
		get(target, property, receiver) {
			const value = Reflect.get(target, property, receiver)
			if (typeof property !== "string" || !TRACKED_LOADERS.has(property)) {
				return value
			}
			if (typeof value !== "function") return value

			return (...args: unknown[]) => {
				const label = describeAsset(property, args)
				loadingScreen.assetStarted(label)
				const asset = value(...args)
				Promise.resolve(asset).then(
					() => loadingScreen.assetFinished(),
					() => loadingScreen.fail(label)
				)
				return asset
			}
		},
	}) as KAPLAYCtx
}
