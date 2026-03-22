import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	base: "/",
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		proxy: {
			"/api": "http://127.0.0.1:3000",
			"/health": "http://127.0.0.1:3000",
		},
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
});
