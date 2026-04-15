import { expect, type Browser } from "@playwright/test";
import { seedClientState } from "./auth";
import { chooseOpenMethodIfPrompted, closeActiveDialog } from "./files";

export async function expectAnonymousSharePreview(
	browser: Browser,
	shareUrl: string,
	fileName: string,
	clientState: Record<string, string>,
) {
	const context = await browser.newContext({
		acceptDownloads: true,
		locale: "en-US",
		serviceWorkers: "block",
	});
	const page = await context.newPage();

	await seedClientState(page, clientState);
	await page.goto(shareUrl);

	await expect(page.getByText(fileName, { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Preview" }).click();
	await chooseOpenMethodIfPrompted(page, "Image preview", 5_000);

	const dialog = page.getByRole("dialog");
	await expect(dialog.getByRole("img", { name: fileName })).toBeVisible({
		timeout: 30_000,
	});

	await closeActiveDialog(page);
	await context.close();
}

export async function expectProtectedFolderSharePreview(
	browser: Browser,
	shareUrl: string,
	fileName: string,
	password: string,
	clientState: Record<string, string>,
) {
	const context = await browser.newContext({
		acceptDownloads: true,
		locale: "en-US",
		serviceWorkers: "block",
	});
	const page = await context.newPage();

	await seedClientState(page, clientState);
	await page.goto(shareUrl);

	await expect(
		page.getByText("This share is password protected"),
	).toBeVisible();
	await page.getByPlaceholder("Password").fill(password);
	await page.getByRole("button", { name: "Verify" }).click();

	await expect(page.getByText(fileName, { exact: true })).toBeVisible({
		timeout: 30_000,
	});
	await page.getByRole("button", { exact: true, name: fileName }).click();
	await chooseOpenMethodIfPrompted(page, "Image preview", 5_000);

	const dialog = page.getByRole("dialog");
	await expect(dialog.getByRole("img", { name: fileName })).toBeVisible({
		timeout: 30_000,
	});

	await closeActiveDialog(page);
	await context.close();
}
