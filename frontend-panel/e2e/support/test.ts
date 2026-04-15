import { expect, test as base } from "@playwright/test";
import { seedClientState } from "./auth";

const test = base;

test.beforeEach(async ({ page }) => {
	await seedClientState(page);
});

export { expect, test };
