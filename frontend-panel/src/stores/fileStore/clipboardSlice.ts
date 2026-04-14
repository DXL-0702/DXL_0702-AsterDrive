import { batchService } from "@/services/batchService";
import {
	applyWorkspaceRequestState,
	beginWorkspaceRequest,
	fetchFolder,
	getInitialPageParams,
	isRequestCanceled,
} from "./request";
import type { ClipboardSlice, FileStoreSlice } from "./types";

export const createClipboardSlice: FileStoreSlice<ClipboardSlice> = (
	set,
	get,
) => ({
	clipboard: null,

	clipboardCopy: () => {
		const { selectedFileIds, selectedFolderIds } = get();
		const count = selectedFileIds.size + selectedFolderIds.size;
		if (count === 0) return 0;

		set({
			clipboard: {
				fileIds: Array.from(selectedFileIds),
				folderIds: Array.from(selectedFolderIds),
				mode: "copy",
			},
		});
		return count;
	},

	clipboardCut: () => {
		const { selectedFileIds, selectedFolderIds } = get();
		const count = selectedFileIds.size + selectedFolderIds.size;
		if (count === 0) return 0;

		set({
			clipboard: {
				fileIds: Array.from(selectedFileIds),
				folderIds: Array.from(selectedFolderIds),
				mode: "cut",
			},
		});
		return count;
	},

	clipboardPaste: async () => {
		const { clipboard, currentFolderId, workspaceRequestRevision } = get();
		if (!clipboard) {
			throw new Error("No clipboard");
		}

		const result =
			clipboard.mode === "copy"
				? await batchService.batchCopy(
						clipboard.fileIds,
						clipboard.folderIds,
						currentFolderId,
					)
				: await batchService.batchMove(
						clipboard.fileIds,
						clipboard.folderIds,
						currentFolderId,
					);

		const mode = clipboard.mode;
		if (mode === "cut") {
			set({ clipboard: null });
		}

		get().clearSelection();

		if (get().workspaceRequestRevision !== workspaceRequestRevision) {
			return { mode, result };
		}

		const request = beginWorkspaceRequest(set, get);

		try {
			const contents = await fetchFolder(
				currentFolderId,
				getInitialPageParams(get().sortBy, get().sortOrder),
				request.signal,
			);

			applyWorkspaceRequestState(set, get, request, {
				folders: contents.folders,
				files: contents.files,
				foldersTotalCount: contents.folders_total,
				filesTotalCount: contents.files_total,
				nextFileCursor: contents.next_file_cursor ?? null,
			});
		} catch (error) {
			if (!isRequestCanceled(error)) {
				throw error;
			}
		}

		return { mode, result };
	},

	clearClipboard: () => {
		set({ clipboard: null });
	},
});
