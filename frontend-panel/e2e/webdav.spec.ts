import { authenticate } from "./support/auth";
import { dialogByTitle } from "./support/files";
import { uniqueAccountName, uniqueName } from "./support/fixtures";
import {
	apiJsonInPage,
	basicAuth,
	normalizeWebdavPrefix,
	webdavRequest,
} from "./support/network";
import { expect, test } from "./support/test";

test.describe.serial("WebDAV E2E", () => {
	test("creates a WebDAV account and exercises basic WebDAV methods", async ({
		page,
		request,
	}) => {
		await authenticate(page, request);

		const username = uniqueAccountName("pwdav");
		const password = "PlaywrightDav123!";
		const settings = await apiJsonInPage<{
			endpoint: string;
			prefix: string;
		}>(page, "/api/v1/webdav-accounts/settings");
		const prefix = normalizeWebdavPrefix(settings.prefix);
		const authHeader = basicAuth(username, password);
		const directoryName = uniqueName("pw-dav-dir");
		const fileName = `${uniqueName("pw-dav-file")}.txt`;
		const fileContent = "WebDAV content from Playwright";
		const rootPath = `${prefix}/`;
		const directoryPath = `${rootPath}${directoryName}/`;
		const filePath = `${directoryPath}${fileName}`;

		await page.goto("/settings/webdav");
		await expect(
			page.getByRole("heading", { exact: true, name: "WebDAV" }),
		).toBeVisible();
		await page.getByRole("button", { name: "Create WebDAV Account" }).click();

		const createDialog = dialogByTitle(page, "Create WebDAV Account");
		await expect(createDialog).toBeVisible();
		await createDialog.locator("#username").fill(username);
		await createDialog.locator("#password").fill(password);
		await createDialog.getByRole("button", { name: "Create" }).click();

		const credentialsDialog = dialogByTitle(page, "Latest Credentials");
		await expect(credentialsDialog).toBeVisible();
		await credentialsDialog
			.getByRole("button", { name: "Test Connection" })
			.click();
		await expect(
			credentialsDialog.getByText("Connection successful", {
				exact: true,
			}),
		).toBeVisible({
			timeout: 30_000,
		});

		const rootListing = await webdavRequest(page, rootPath, {
			headers: {
				Authorization: authHeader,
				Depth: "0",
			},
			method: "PROPFIND",
		});
		expect(rootListing.status).toBe(207);

		const createDirectory = await webdavRequest(page, directoryPath, {
			headers: {
				Authorization: authHeader,
			},
			method: "MKCOL",
		});
		expect(createDirectory.status).toBe(201);

		const nestedListing = await webdavRequest(page, rootPath, {
			headers: {
				Authorization: authHeader,
				Depth: "1",
			},
			method: "PROPFIND",
		});
		expect(nestedListing.status).toBe(207);
		expect(nestedListing.text).toContain(directoryName);

		const putFile = await webdavRequest(page, filePath, {
			body: fileContent,
			headers: {
				Authorization: authHeader,
				"Content-Type": "text/plain",
			},
			method: "PUT",
		});
		expect([201, 204]).toContain(putFile.status);

		const getFile = await webdavRequest(page, filePath, {
			headers: {
				Authorization: authHeader,
			},
			method: "GET",
		});
		expect(getFile.status).toBe(200);
		expect(getFile.text).toContain(fileContent);

		const deleteFile = await webdavRequest(page, filePath, {
			headers: {
				Authorization: authHeader,
			},
			method: "DELETE",
		});
		expect([200, 204]).toContain(deleteFile.status);

		const deleteDirectory = await webdavRequest(page, directoryPath, {
			headers: {
				Authorization: authHeader,
			},
			method: "DELETE",
		});
		expect([200, 204]).toContain(deleteDirectory.status);
	});
});
