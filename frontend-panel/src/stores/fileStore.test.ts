import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FILE_PAGE_SIZE, FOLDER_LIMIT } from "@/lib/constants";
import { createFolderContents } from "@/test/fixtures";

const listRoot = vi.fn();
const listFolder = vi.fn();
const getFolderAncestors = vi.fn();
const queuePreferenceSync = vi.fn();

vi.mock("@/services/fileService", () => ({
	fileService: {
		listRoot,
		listFolder,
		getFolderAncestors,
	},
}));

vi.mock("@/lib/preferenceSync", () => ({
	cancelPreferenceSync: vi.fn(),
	queuePreferenceSync,
}));

vi.mock("@/services/batchService", () => ({
	batchService: {
		batchCopy: vi.fn(),
		batchDelete: vi.fn(),
		batchMove: vi.fn(),
	},
}));

vi.mock("@/services/searchService", () => ({
	searchService: {
		search: vi.fn(),
	},
}));

vi.mock("@/stores/authStore", () => ({
	useAuthStore: {
		getState: () => ({
			refreshUser: vi.fn().mockResolvedValue(undefined),
		}),
	},
}));

async function loadStore() {
	vi.resetModules();
	const { useFileStore } = await import("@/stores/fileStore");
	return useFileStore;
}

describe("useFileStore", () => {
	beforeEach(() => {
		listRoot.mockReset();
		listFolder.mockReset();
		getFolderAncestors.mockReset();
		queuePreferenceSync.mockReset();
	});

	it("loads the root folder with initial sort and page params", async () => {
		listRoot.mockResolvedValue(
			createFolderContents({
				files: [{ id: 101, name: "report.txt" }],
				folders: [{ id: 7, name: "Docs" }],
				files_total: 1,
				folders_total: 1,
			}),
		);

		const useFileStore = await loadStore();

		await useFileStore.getState().navigateTo(null);

		expect(listRoot).toHaveBeenCalledWith({
			folder_limit: FOLDER_LIMIT,
			file_limit: FILE_PAGE_SIZE,
			sort_by: "name",
			sort_order: "asc",
		});
		expect(useFileStore.getState()).toMatchObject({
			currentFolderId: null,
			breadcrumb: [{ id: null, name: "Root" }],
			filesTotalCount: 1,
			foldersTotalCount: 1,
		});
		expect(useFileStore.getState().files).toEqual([
			expect.objectContaining({ id: 101, name: "report.txt" }),
		]);
	});

	it("appends the next cursor page when loading more files", async () => {
		listRoot
			.mockResolvedValueOnce(
				createFolderContents({
					files: [{ id: 101, name: "alpha.txt" }],
					files_total: 2,
					next_file_cursor: { id: 101, value: "alpha.txt" },
				}),
			)
			.mockResolvedValueOnce(
				createFolderContents({
					files: [{ id: 102, name: "beta.txt" }],
					files_total: 2,
					next_file_cursor: null,
				}),
			);

		const useFileStore = await loadStore();

		await useFileStore.getState().navigateTo(null);
		await useFileStore.getState().loadMoreFiles();

		expect(listRoot).toHaveBeenNthCalledWith(2, {
			folder_limit: 0,
			file_limit: FILE_PAGE_SIZE,
			file_after_value: "alpha.txt",
			file_after_id: 101,
			sort_by: "name",
			sort_order: "asc",
		});
		expect(useFileStore.getState().files).toEqual([
			expect.objectContaining({ id: 101 }),
			expect.objectContaining({ id: 102 }),
		]);
		expect(useFileStore.getState().nextFileCursor).toBeNull();
	});

	it("refetches with the updated sort field and persists the preference", async () => {
		listRoot
			.mockResolvedValueOnce(
				createFolderContents({
					files: [{ id: 101, name: "alpha.txt" }],
				}),
			)
			.mockResolvedValueOnce(
				createFolderContents({
					files: [{ id: 102, name: "latest.txt" }],
				}),
			);

		const useFileStore = await loadStore();

		await useFileStore.getState().navigateTo(null);
		useFileStore.getState().setSortBy("updated_at");

		await waitFor(() => {
			expect(listRoot).toHaveBeenNthCalledWith(2, {
				folder_limit: FOLDER_LIMIT,
				file_limit: FILE_PAGE_SIZE,
				sort_by: "updated_at",
				sort_order: "asc",
			});
		});

		expect(queuePreferenceSync).toHaveBeenCalledWith({
			sort_by: "updated_at",
		});
		expect(localStorage.getItem("aster-sort-by")).toBe("updated_at");
		expect(useFileStore.getState().files).toEqual([
			expect.objectContaining({ id: 102, name: "latest.txt" }),
		]);
	});
});
