import { batchService } from "@/services/batchService";
import { fileService } from "@/services/fileService";
import { useAuthStore } from "@/stores/authStore";
import {
	applyWorkspaceRequestState,
	beginWorkspaceRequest,
	fetchFolder,
	getInitialPageParams,
	isRequestCanceled,
	resolveBreadcrumb,
} from "./request";
import type { CrudSlice, FileStoreSlice } from "./types";

export const createCrudSlice: FileStoreSlice<CrudSlice> = (set, get) => ({
	createFile: async (name) => {
		const { currentFolderId } = get();
		await fileService.createEmptyFile(name, currentFolderId);
		await Promise.all([get().refresh(), useAuthStore.getState().refreshUser()]);
	},

	createFolder: async (name) => {
		const { currentFolderId } = get();
		await fileService.createFolder(name, currentFolderId);
		await get().refresh();
	},

	deleteFile: async (id) => {
		await fileService.deleteFile(id);
		const next = new Set(get().selectedFileIds);
		next.delete(id);
		set({ selectedFileIds: next });
		await Promise.all([get().refresh(), useAuthStore.getState().refreshUser()]);
	},

	deleteFolder: async (id) => {
		await fileService.deleteFolder(id);
		const next = new Set(get().selectedFolderIds);
		next.delete(id);
		set({ selectedFolderIds: next });
		await Promise.all([get().refresh(), useAuthStore.getState().refreshUser()]);
	},

	moveToFolder: async (fileIds, folderIds, targetFolderId) => {
		const revision = get().workspaceRequestRevision;
		const result = await batchService.batchMove(
			fileIds,
			folderIds,
			targetFolderId,
		);
		get().clearSelection();

		if (get().workspaceRequestRevision !== revision) {
			return result;
		}

		const { currentFolderId } = get();
		const request = beginWorkspaceRequest(set, get);

		try {
			const [contents, breadcrumb] = await Promise.all([
				fetchFolder(
					currentFolderId,
					getInitialPageParams(get().sortBy, get().sortOrder),
					request.signal,
				),
				resolveBreadcrumb(currentFolderId, undefined, request.signal),
			]);

			applyWorkspaceRequestState(set, get, request, {
				folders: contents.folders,
				files: contents.files,
				foldersTotalCount: contents.folders_total,
				filesTotalCount: contents.files_total,
				nextFileCursor: contents.next_file_cursor ?? null,
				breadcrumb,
			});
		} catch (error) {
			if (!isRequestCanceled(error)) {
				throw error;
			}
		}

		return result;
	},
});
