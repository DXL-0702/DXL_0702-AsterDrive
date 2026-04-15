import { test as base, expect } from "@playwright/test";
import { seedClientState } from "./auth";

const test = base;

test.beforeEach(async ({ page }) => {
	await seedClientState(page);
});

export { expect, test };
