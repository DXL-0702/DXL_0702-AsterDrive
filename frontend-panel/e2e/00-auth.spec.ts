import { hasUsers, loginAsAdmin, openUserMenu, setupAdmin } from "./support/auth";
import { expect, test } from "./support/test";

test.describe.serial("Auth E2E", () => {
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
});
