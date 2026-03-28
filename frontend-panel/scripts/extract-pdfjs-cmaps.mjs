import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const publicPdfjsDir = path.join(projectRoot, "public", "pdfjs");

const pdfjsPackagePath = require.resolve("pdfjs-dist/package.json");
const pdfjsDistDir = path.dirname(pdfjsPackagePath);
const pdfjsVersion = JSON.parse(
	fs.readFileSync(pdfjsPackagePath, "utf8"),
).version;
const sourceCMapsDir = path.join(pdfjsDistDir, "cmaps");
const targetVersionDir = path.join(publicPdfjsDir, pdfjsVersion);
const targetCMapsDir = path.join(targetVersionDir, "cmaps");

fs.rmSync(publicPdfjsDir, {
	force: true,
	recursive: true,
});
fs.mkdirSync(targetVersionDir, {
	recursive: true,
});
fs.cpSync(sourceCMapsDir, targetCMapsDir, {
	recursive: true,
});

const cMapCount = fs.readdirSync(targetCMapsDir).length;
const manifestPath = path.join(targetVersionDir, "asset-manifest.json");

fs.writeFileSync(
	manifestPath,
	`${JSON.stringify(
		{
			cMapCount,
			cMapUrl: `/pdfjs/${pdfjsVersion}/cmaps/`,
			version: pdfjsVersion,
		},
		null,
		2,
	)}\n`,
);

console.log(
	`[extract-pdfjs-cmaps] extracted ${cMapCount} CMaps to ${path.relative(projectRoot, targetCMapsDir)}`,
);
