import { authenticate, gotoAdminPage } from "./support/auth";
import {
	clickRowAction,
	dialogByTitle,
	tableRowByCellText,
} from "./support/files";
import { uniqueAccountName, uniqueName } from "./support/fixtures";
import { expect, test } from "./support/test";

test.describe
	.serial("Admin E2E", () => {
		test("manages admin users end-to-end", async ({ page, request }) => {
			await authenticate(page, request);

			const username = uniqueAccountName("pwuser");
			const email = `${username}@example.com`;

			await gotoAdminPage(page, "/admin/users", "Users");

			await page.getByRole("button", { name: "New User" }).click();
			const createDialog = dialogByTitle(page, "Create user");
			await expect(createDialog).toBeVisible();
			await createDialog.locator("#create-user-username").fill(username);
			await createDialog.locator("#create-user-email").fill(email);
			await createDialog
				.locator("#create-user-password")
				.fill("Playwright123!");
			await createDialog.getByRole("button", { name: "Create" }).click();
			await expect(createDialog).toBeHidden();

			await expect(tableRowByCellText(page, username)).toBeVisible({
				timeout: 30_000,
			});

			await page
				.getByPlaceholder("Search by username, email, or ID...")
				.fill(username);
			await expect(tableRowByCellText(page, username)).toBeVisible({
				timeout: 30_000,
			});

			await tableRowByCellText(page, username).click();
			const detailDialog = dialogByTitle(page, "User details");
			await expect(detailDialog).toBeVisible();
			await expect(
				detailDialog.getByText(email, { exact: true }),
			).toBeVisible();
			await detailDialog
				.locator('[data-slot="dialog-footer"]')
				.getByRole("button", { name: "Close" })
				.click();
			await expect(detailDialog).toBeHidden();

			await clickRowAction(tableRowByCellText(page, username), "Delete user");
			const deleteDialog = page.getByRole("alertdialog", {
				name: "Delete user",
			});
			await expect(deleteDialog).toBeVisible();
			await deleteDialog.getByRole("button", { name: "Delete" }).click();
			await expect(tableRowByCellText(page, username)).toHaveCount(0, {
				timeout: 30_000,
			});
		});

		test("configures local storage policies through the admin flow", async ({
			page,
			request,
		}) => {
			await authenticate(page, request);

			const policyName = uniqueName("pw-local-policy");
			const initialBasePath = `/tmp/${policyName}-v1`;
			const updatedBasePath = `/tmp/${policyName}-v2`;

			await gotoAdminPage(page, "/admin/policies", "Storage Policies");

			await page.getByRole("button", { name: "New Policy" }).click();
			const createDialog = dialogByTitle(page, "Create Policy");
			await expect(createDialog).toBeVisible();
			await createDialog.getByRole("button", { name: "Local" }).click();
			await createDialog.getByRole("button", { name: "Next" }).click();
			await createDialog.locator("#name").fill(policyName);
			await createDialog.locator("#base_path").fill(initialBasePath);
			await createDialog
				.getByRole("button", { exact: true, name: "Review" })
				.click();
			await createDialog.getByRole("button", { name: "Create" }).click();
			await expect(createDialog).toBeHidden();

			await expect(tableRowByCellText(page, policyName)).toBeVisible({
				timeout: 30_000,
			});
			await expect(tableRowByCellText(page, policyName)).toContainText(
				initialBasePath,
			);

			await tableRowByCellText(page, policyName).click();
			const editDialog = dialogByTitle(page, "Edit Policy");
			await expect(editDialog).toBeVisible();
			await editDialog.locator("#base_path").fill(updatedBasePath);
			await editDialog.getByRole("button", { name: "Save Changes" }).click();
			await expect(editDialog).toBeHidden();
			await expect(tableRowByCellText(page, policyName)).toContainText(
				updatedBasePath,
			);

			await clickRowAction(
				tableRowByCellText(page, policyName),
				"Delete Policy",
			);
			const deleteDialog = page.getByRole("alertdialog", {
				name: `Delete Policy "${policyName}"?`,
			});
			await expect(deleteDialog).toBeVisible();
			await deleteDialog.getByRole("button", { name: "Delete" }).click();
			await expect(tableRowByCellText(page, policyName)).toHaveCount(0, {
				timeout: 30_000,
			});
		});
	});
