/**
 * Global UI state shared across the application
 */
export interface UIState {
	isOverUI: boolean;
	modalOpen: boolean;
	pauseMenuOpen: boolean;
}

/**
 * Global UI state instance
 */
export const uiState: UIState = {
	isOverUI: false,
	modalOpen: false,
	pauseMenuOpen: false,
};

export function menuBlocksPostProcessing() {
	return uiState.modalOpen || uiState.pauseMenuOpen;
}
