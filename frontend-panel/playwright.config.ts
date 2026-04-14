import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const port = Number(process.env.ASTER_E2E_PORT ?? "3310");
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	timeout: 90_000,
	expect: {
		timeout: 15_000,
	},
	reporter: [
		["list"],
		["html", { open: "never", outputFolder: "playwright-report" }],
	],
	use: {
		baseURL,
		acceptDownloads: true,
		locale: "en-US",
		serviceWorkers: "block",
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
		video: "retain-on-failure",
		viewport: { width: 1440, height: 960 },
	},
	webServer: {
		command: "bun run build && ./scripts/run-e2e-server.sh",
		cwd: configDir,
		reuseExistingServer: false,
		stderr: "pipe",
		stdout: "pipe",
		timeout: 10 * 60 * 1000,
		url: `${baseURL}/health/ready`,
	},
});
