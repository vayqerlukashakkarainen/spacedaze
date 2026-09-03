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

		const command = commands.get(name);
		if (!command) return `Unknown command: ${name}. Type help.`;

		return command.run(parts) ?? "OK";
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
