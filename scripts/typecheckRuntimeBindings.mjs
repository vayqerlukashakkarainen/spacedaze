import * as ts from "typescript"

const configPath = ts.findConfigFile(
	process.cwd(),
	ts.sys.fileExists,
	"tsconfig.json"
)

if (!configPath) {
	process.stderr.write("Unable to find tsconfig.json\n")
	process.exit(1)
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
if (configFile.error) {
	process.stderr.write(`${formatDiagnostics([configFile.error])}\n`)
	process.exit(1)
}

const parsedConfig = ts.parseJsonConfigFileContent(
	configFile.config,
	ts.sys,
	process.cwd()
)
const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options)
const runtimeBindingDiagnosticCodes = new Set([
	2304, // Cannot find name.
	2552, // Cannot find name. Did you mean ...?
	18004, // No value exists in scope for the shorthand property.
])
const diagnostics = ts.getPreEmitDiagnostics(program).filter(
	(diagnostic) => runtimeBindingDiagnosticCodes.has(diagnostic.code)
)

if (diagnostics.length > 0) {
	process.stderr.write(`${formatDiagnostics(diagnostics)}\n`)
	process.exit(1)
}

process.stdout.write("Runtime binding typecheck passed\n")

function formatDiagnostics(diagnostics) {
	return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
		getCanonicalFileName: (fileName) => fileName,
		getCurrentDirectory: () => process.cwd(),
		getNewLine: () => "\n",
	})
}
