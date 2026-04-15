import {
	authenticate,
	loginAsAdmin,
	loginWithCredentials,
	logout,
} from "./support/auth";
import { fileDropZone } from "./support/files";
import { uniqueAccountName } from "./support/fixtures";
import { apiJsonInPage } from "./support/network";
import { expect, test } from "./support/test";

test.describe
	.serial("Access Control E2E", () => {
		test("redirects non-admin users away from admin routes", async ({
			page,
			request,
		}) => {
			await authenticate(page, request);

			const username = uniqueAccountName("pwbasic");
			const email = `${username}@example.com`;
			const password = "Playwright123!";

			await apiJsonInPage(page, "/api/v1/admin/users", {
				method: "POST",
				body: {
					username,
					email,
					password,
				},
				withCsrf: true,
			});

			await logout(page);
			await loginWithCredentials(page, email, password);

			await page.goto("/admin/users");
			await expect(page).toHaveURL(/\/$/);
			await expect(fileDropZone(page)).toBeVisible();

			await page.goto("/admin/overview");
			await expect(page).toHaveURL(/\/$/);
			await expect(fileDropZone(page)).toBeVisible();

			await logout(page, username);
			await loginAsAdmin(page);
		});
	});
