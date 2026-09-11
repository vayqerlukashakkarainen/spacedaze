export type CombatCreditKind =
	| "primary"
	| "secondary"
	| "mobility"
	| "ultimate"
	| "lasso"
	| "companion"
	| "environment"

export interface CombatCredit {
	kind: CombatCreditKind
	id?: string
	explosive?: boolean
	critical?: boolean
	ultimateCharge?: number
}
