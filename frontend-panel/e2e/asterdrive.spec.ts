import { readFile } from "node:fs/promises";
import path from "node:path";
import {
	type APIRequestContext,
	type Browser,
	expect,
	type Page,
	test,
} from "@playwright/test";

const ADMIN = {
	email: "admin@example.com",
	password: "Playwright123!",
	username: "admin",
} as const;

const CODE_CONTENT = `const greeting = "Hello from Playwright";
console.log(greeting);
`;

const IMAGE_FILE = {
	buffer: Buffer.from(
		"R0lGODdhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
		"base64",
	),
	mimeType: "image/gif",
	name: "playwright-image.gif",
} as const;

const PDF_FILE = {
	buffer: createMinimalPdf("Playwright PDF"),
	mimeType: "application/pdf",
	name: "playwright-document.pdf",
} as const;

const CODE_FILE = {
	buffer: Buffer.from(CODE_CONTENT, "utf8"),
	mimeType: "text/typescript",
	name: "playwright-code.ts",
} as const;

const PREVIEW_APPS_CACHE_KEY = "aster-cached-preview-apps";

const DEFAULT_STORAGE_STATE = {
	"aster-browser-open-mode": "single_click",
	"aster-language": "en",
	"aster-sort-by": "name",
	"aster-sort-order": "asc",
	"aster-view-mode": "list",
} as const;

test.describe
	.serial("AsterDrive E2E", () => {
		test.beforeEach(async ({ page }) => {
			await seedClientState(page);
		});

		test("creates the initial admin, logs out, and signs back in", async ({
			page,
			request,
		}) => {
			expect(await hasUsers(request)).toBe(false);
			await setupAdmin(page);
			expect(await hasUsers(request)).toBe(true);

			await openUserMenu(page);
			await page.getByRole("button", { name: "Logout" }).click();
			await expect(page).toHaveURL(/\/login$/);

			await loginAsAdmin(page);
		});

		test("uploads, previews, downloads, and opens an anonymous share page", async ({
			browser,
			page,
			request,
		}, testInfo) => {
			await authenticate(page, request);

			await uploadViaPicker(page, [IMAGE_FILE, PDF_FILE]);
			await uploadViaDragDrop(page, [CODE_FILE]);

			for (const fileName of [IMAGE_FILE.name, PDF_FILE.name, CODE_FILE.name]) {
				await expect(fileNameCell(page, fileName)).toBeVisible({
					timeout: 30_000,
				});
			}

			await expectImagePreview(page, IMAGE_FILE.name);
			await closeActiveDialog(page);

			await expectPdfPreview(page, PDF_FILE.name);
			await closeActiveDialog(page);

			await expectCodePreview(page, CODE_FILE.name);
			await closeActiveDialog(page);

			await expectDownloadMatches(
				page,
				CODE_FILE.name,
				CODE_FILE.buffer,
				testInfo.outputDir,
			);

			const shareUrl = await createPageShare(page, IMAGE_FILE.name);
			const clientState = await captureClientState(page);
			await expectAnonymousSharePreview(
				browser,
				shareUrl,
				IMAGE_FILE.name,
				clientState,
			);
		});
	});

async function seedClientState(
	page: Page,
	entries: Record<string, string> = DEFAULT_STORAGE_STATE,
) {
	await page.addInitScript((entries) => {
		for (const [key, value] of Object.entries(entries)) {
			window.localStorage.setItem(key, value);
		}
	}, entries);
}

async function captureClientState(page: Page) {
	const entries = { ...DEFAULT_STORAGE_STATE };
	const cachedPreviewApps = await page.evaluate(
		(key) => window.localStorage.getItem(key),
		PREVIEW_APPS_CACHE_KEY,
	);

	if (cachedPreviewApps) {
		entries[PREVIEW_APPS_CACHE_KEY] = cachedPreviewApps;
	}

	return entries;
}

function createMinimalPdf(text: string) {
	const escapedText = text
		.replaceAll("\\", "\\\\")
		.replaceAll("(", "\\(")
		.replaceAll(")", "\\)");
	const contentStream = `BT
/F1 18 Tf
48 96 Td
(${escapedText}) Tj
ET`;
	const objects = [
		"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
		"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
		"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
		`4 0 obj\n<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
		"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
	];
	let pdf = "%PDF-1.4\n";
	const offsets = [0];

	for (const object of objects) {
		offsets.push(Buffer.byteLength(pdf, "utf8"));
		pdf += object;
	}

	const xrefOffset = Buffer.byteLength(pdf, "utf8");
	pdf += `xref
0 ${objects.length + 1}
0000000000 65535 f 
`;

	for (let index = 1; index <= objects.length; index += 1) {
		pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n 
`;
	}

	pdf += `trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF
`;

	return Buffer.from(pdf, "utf8");
}

function fileDropZone(page: Page) {
	return page.locator('[aria-label="File drop zone"]').first();
}

function fileNameCell(page: Page, fileName: string) {
	return page.getByRole("cell", { exact: true, name: fileName }).first();
}

function fileRow(page: Page, fileName: string) {
	return page
		.getByRole("row")
		.filter({ has: page.getByRole("cell", { exact: true, name: fileName }) })
		.first();
}

async function hasUsers(request: APIRequestContext) {
	const response = await request.post("/api/v1/auth/check");
	expect(response.ok()).toBe(true);
	const payload = (await response.json()) as {
		code: number;
		data?: {
			has_users?: boolean;
		} | null;
	};
	expect(payload.code).toBe(0);
	return payload.data?.has_users ?? false;
}

async function authenticate(page: Page, request: APIRequestContext) {
	if (await hasUsers(request)) {
		await loginAsAdmin(page);
		return;
	}

	await setupAdmin(page);
}

async function setupAdmin(page: Page) {
	await page.goto("/login");
	await expect(page.locator("#extra")).toBeVisible();
	await page.locator("#identifier").fill(ADMIN.email);
	await page.locator("#extra").fill(ADMIN.username);
	await page.locator("#password").fill(ADMIN.password);
	await page.locator("form button[type='submit']").click();
	await expect(page).toHaveURL(/\/$/);
	await expect(fileDropZone(page)).toBeVisible();
}

async function loginAsAdmin(page: Page) {
	await page.goto("/login");
	await page.locator("#identifier").fill(ADMIN.email);
	await page.locator("#password").fill(ADMIN.password);
	await page.locator("form button[type='submit']").click();
	await expect(page).toHaveURL(/\/$/);
	await expect(fileDropZone(page)).toBeVisible();
}

async function openUserMenu(page: Page) {
	await page.getByRole("button", { name: ADMIN.username }).click();
}

async function uploadViaPicker(
	page: Page,
	files: ReadonlyArray<{
		buffer: Buffer;
		mimeType: string;
		name: string;
	}>,
) {
	await page.getByTestId("upload-file-input").setInputFiles(
		files.map((file) => ({
			buffer: file.buffer,
			mimeType: file.mimeType,
			name: file.name,
		})),
	);
}

async function uploadViaDragDrop(
	page: Page,
	files: ReadonlyArray<{
		buffer: Buffer;
		mimeType: string;
		name: string;
	}>,
) {
	const dataTransfer = await page.evaluateHandle(
		(payload) => {
			const transfer = new DataTransfer();

			for (const file of payload) {
				const binary = atob(file.bufferBase64);
				const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
				transfer.items.add(
					new File([bytes], file.name, { type: file.mimeType }),
				);
			}

			return transfer;
		},
		files.map((file) => ({
			bufferBase64: file.buffer.toString("base64"),
			mimeType: file.mimeType,
			name: file.name,
		})),
	);

	const dropZone = fileDropZone(page);
	await dropZone.dispatchEvent("dragenter", { dataTransfer });
	await dropZone.dispatchEvent("dragover", { dataTransfer });
	await dropZone.dispatchEvent("drop", { dataTransfer });
}

async function expectImagePreview(page: Page, fileName: string) {
	await fileNameCell(page, fileName).click();
	await chooseOpenMethodIfPrompted(page, "Image preview");
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole("img", { name: fileName })).toBeVisible({
		timeout: 30_000,
	});
}

async function expectPdfPreview(page: Page, fileName: string) {
	await fileNameCell(page, fileName).click();
	await chooseOpenMethodIfPrompted(page, "PDF preview");
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await expect(dialog.getByText("Page 1 / 1")).toBeVisible({ timeout: 30_000 });
}

async function expectCodePreview(page: Page, fileName: string) {
	await fileNameCell(page, fileName).click();
	await chooseOpenMethodIfPrompted(page, "Source view");
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByText('const greeting = "Hello from Playwright";'),
	).toBeVisible({
		timeout: 30_000,
	});
}

async function closeActiveDialog(page: Page) {
	const dialog = page.getByRole("dialog");
	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
}

async function chooseOpenMethodIfPrompted(
	page: Page,
	label: string,
	timeoutMs = 0,
) {
	const chooser = page.getByRole("dialog", {
		name: "Choose how to open this file",
	});
	const chooserVisible =
		timeoutMs > 0
			? await chooser
					.waitFor({
						state: "visible",
						timeout: timeoutMs,
					})
					.then(() => true)
					.catch(() => false)
			: await chooser.isVisible().catch(() => false);

	if (!chooserVisible) {
		return;
	}

	let option = chooser.getByRole("button", { exact: true, name: label });
	if (!(await option.isVisible().catch(() => false))) {
		const more = chooser.getByRole("button", {
			exact: true,
			name: "More open methods",
		});
		if (await more.isVisible().catch(() => false)) {
			await more.click();
		}
		option = chooser.getByRole("button", { exact: true, name: label });
	}

	await option.click();
}

async function openFileContextMenu(page: Page, fileName: string) {
	await fileRow(page, fileName).click({ button: "right" });
}

async function expectDownloadMatches(
	page: Page,
	fileName: string,
	expected: Buffer,
	outputDir: string,
) {
	const downloadPromise = page.waitForEvent("download");
	await openFileContextMenu(page, fileName);
	await page.getByRole("menuitem", { name: "Download" }).click();

	const download = await downloadPromise;
	const targetPath = path.join(outputDir, download.suggestedFilename());
	await download.saveAs(targetPath);

	const actual = await readFile(targetPath);
	expect(actual.equals(expected)).toBe(true);
}

async function createPageShare(page: Page, fileName: string) {
	await openFileContextMenu(page, fileName);
	await page.getByRole("menuitem", { name: "Share page" }).click();

	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await dialog.getByRole("button", { name: "Create share link" }).click();

	const shareUrlInput = dialog.getByTestId("share-primary-url");
	await expect(shareUrlInput).toHaveValue(/\/s\//);
	const shareUrl = await shareUrlInput.inputValue();

	await dialog.getByRole("button", { name: "Done" }).click();
	await expect(dialog).toBeHidden();

	return shareUrl;
}

async function expectAnonymousSharePreview(
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
