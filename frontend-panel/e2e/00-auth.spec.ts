import { hasUsers, loginAsAdmin, logout, setupAdmin } from "./support/auth";
import { expect, test } from "./support/test";

test.describe
	.serial("Auth E2E", () => {
		test("creates the initial admin, logs out, and signs back in", async ({
			page,
			request,
		}) => {
			expect(await hasUsers(request)).toBe(false);
			await setupAdmin(page);
			expect(await hasUsers(request)).toBe(true);

			await logout(page);
			await loginAsAdmin(page);
		});
	});
