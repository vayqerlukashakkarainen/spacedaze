export const SALVAGER_CARGO_CAPACITY = 5

export interface SalvagerDebree {
	exists(): boolean
	collection?: unknown
	carriedBy?: number
	readyForPlayer?: boolean
}

export function isDebreeAvailable(debris: SalvagerDebree) {
	return debris.exists() && !debris.collection &&
		debris.carriedBy === undefined && !debris.readyForPlayer
}

export class SalvagerCargo<T extends SalvagerDebree> {
	private cargo: T[] = []
	returning = false

	constructor(private readonly ownerId: number) {}

	get items(): readonly T[] {
		this.cargo = this.cargo.filter((item) =>
			item.exists() && item.carriedBy === this.ownerId
		)
		return this.cargo
	}

	load(debris: T) {
		if (this.returning || this.items.length >= SALVAGER_CARGO_CAPACITY ||
			!isDebreeAvailable(debris)) return false
		debris.carriedBy = this.ownerId
		this.cargo.push(debris)
		if (this.cargo.length === SALVAGER_CARGO_CAPACITY) this.returning = true
		return true
	}

	shouldReturn(hasNearbyDebree: boolean) {
		if (this.items.length === 0) this.returning = false
		else if (!hasNearbyDebree) this.returning = true
		return this.returning
	}

	release(delivered: boolean): T[] {
		const items = [...this.items]
		this.cargo = []
		this.returning = false
		for (const item of items) {
			item.carriedBy = undefined
			item.readyForPlayer = delivered
		}
		return items
	}
}
