import { authenticate, gotoAdminPage } from "./support/auth";
import { fileDropZone } from "./support/files";
import { expect, test } from "./support/test";

test.describe
	.serial("Navigation E2E", () => {
		test("supports mobile navigation for the user and admin layouts", async ({
			page,
			request,
		}) => {
			await authenticate(page, request);

			await page.setViewportSize({ width: 390, height: 844 });
			await page.goto("/");
			await expect(fileDropZone(page)).toBeVisible();

			await page.getByRole("button", { name: "Open sidebar" }).click();
			await expect(
				page.getByRole("button", { name: "Close sidebar" }).first(),
			).toBeVisible();
			await page.getByRole("link", { name: "Trash" }).click();
			await expect(page).toHaveURL(/\/trash$/);

			await gotoAdminPage(page, "/admin/users", "Users");
			await page.getByRole("button", { name: "Open admin sidebar" }).click();
			await page.getByRole("link", { name: "Storage Policies" }).click();
			await expect(page).toHaveURL(/\/admin\/policies$/);
		});
	});
