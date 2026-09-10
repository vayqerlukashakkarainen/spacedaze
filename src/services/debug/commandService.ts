import { runtimeDebug } from "./runtimeDebugService";

interface Command {
	description: string;
	run: (args: string[]) => string | void;
}

const commands = new Map<string, Command>();
let isCapturingInput = false;

export const commandService = {
	register(
		name: string,
		description: string,
		run: (args: string[]) => string | void
	) {
		commands.set(name.toLowerCase(), { description, run });
	},

	execute(input: string) {
		const parts = input.trim().split(/\s+/);
		const name = parts.shift()?.toLowerCase();
		if (!name) return "";
		runtimeDebug.log("command", "command:execute", { name, args: parts });

		const command = commands.get(name);
		if (!command) {
			runtimeDebug.log("command", "command:unknown", { name });
			return `Unknown command: ${name}. Type help.`;
		}

		const result = command.run(parts) ?? "OK";
		runtimeDebug.log("command", "command:complete", { name, result });
		return result;
	},

	list() {
		return [...commands.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([name, command]) => `${name} - ${command.description}`);
	},

	setCapturingInput(value: boolean) {
		isCapturingInput = value;
	},

	isCapturingInput() {
		return isCapturingInput;
	},
};
