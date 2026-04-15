import { authenticate, captureClientState } from "./support/auth";
import {
	createFolderFromSurface,
	createPageShare,
	fileNameCell,
	navigateToRoot,
	openFolder,
	uploadViaPicker,
} from "./support/files";
import { IMAGE_FILE } from "./support/fixtures";
import { expectProtectedFolderSharePreview } from "./support/shares";
import { expect, test } from "./support/test";

test.describe.serial("Share E2E", () => {
	test("opens a password-protected folder share and previews files anonymously", async ({
		browser,
		page,
		request,
	}) => {
		await authenticate(page, request);

		const sharedFolder = "pw-share-protected-folder";
		const sharedImage = {
			...IMAGE_FILE,
			name: "pw-share-protected-image.gif",
		} as const;
		const sharePassword = "PlaywrightShare123!";

		await createFolderFromSurface(page, sharedFolder);
		await openFolder(page, sharedFolder);
		await uploadViaPicker(page, [sharedImage]);
		await expect(fileNameCell(page, sharedImage.name)).toBeVisible({
			timeout: 30_000,
		});

		await navigateToRoot(page);
		const shareUrl = await createPageShare(page, sharedFolder, {
			password: sharePassword,
		});
		const clientState = await captureClientState(page);

		await expectProtectedFolderSharePreview(
			browser,
			shareUrl,
			sharedImage.name,
			sharePassword,
			clientState,
		);
	});
});
