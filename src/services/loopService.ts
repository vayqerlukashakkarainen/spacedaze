import { KEventController } from "kaplay";
import { k, timeScale } from "../main";

const controllers: KEventController[] = [];

export const loopService = {
	loop: (interval: number, action: () => void, iterations?: number) => {
		const controller = k.loop(interval, action, iterations);
		controllers.push(controller);
		
		// Remove from array when finished
		controller.onEnd(() => {
			const index = controllers.indexOf(controller);
			if (index !== -1) {
				controllers.splice(index, 1);
			}
		});
		
		return controller;
	},
	
	pauseAll: () => {
		for (const controller of controllers) {
			controller.paused = true;
		}
	},
	
	resumeAll: () => {
		for (const controller of controllers) {
			controller.paused = false;
		}
	},
	
	cancelAll: () => {
		for (const controller of controllers) {
			controller.cancel();
		}
		controllers.length = 0;
	}
};
