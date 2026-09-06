import { defineConfig } from "vite";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const runtimeLogPath = resolve(process.cwd(), ".debug/runtime.log");

const runtimeDebugLog = () => ({
    name: "spacedaze-runtime-debug-log",
    configureServer(server) {
        server.middlewares.use("/__spacedaze-debug", (request, response) => {
            mkdirSync(resolve(process.cwd(), ".debug"), { recursive: true });
            if (request.method === "DELETE") {
                writeFileSync(runtimeLogPath, "");
                response.statusCode = 204;
                response.end();
                return;
            }
            if (request.method !== "POST") {
                response.statusCode = 405;
                response.end();
                return;
            }
            let body = "";
            request.on("data", (chunk) => body += chunk.toString());
            request.on("end", () => {
                if (body) appendFileSync(runtimeLogPath, `${body.trimEnd()}\n`);
                response.statusCode = 204;
                response.end();
            });
        });
    },
});

const kaplayCongrats = () => {
    return {
        name: "vite-plugin-kaplay-hello",
        buildEnd() {
            const line =
                "---------------------------------------------------------";
            const msg = `🦖 Awesome pal! Send your game to us:\n\n💎 Discord: https://discord.com/invite/aQ6RuQm3TF \n💖 Donate to KAPLAY: https://opencollective.com/kaplay\n\ (you can disable this msg on vite.config)`;

            process.stdout.write(`\n${line}\n${msg}\n${line}\n`);
        },
    };
};

export default defineConfig({
    // index.html out file will start with a relative path for script
    base: "./",
    server: {
        port: 3001,
    },
    build: {
        // disable this for low bundle sizes
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    kaplay: ["kaplay"],
                },
            },
        },
    },
    plugins: [
        runtimeDebugLog(),
        // Disable messages removing this line
        kaplayCongrats(),
    ],
});
