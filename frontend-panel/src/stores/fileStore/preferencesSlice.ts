import { STORAGE_KEYS } from "@/config/app";
import { logger } from "@/lib/logger";
import { queuePreferenceSync } from "@/lib/preferenceSync";
import {
	applyWorkspaceRequestState,
	beginWorkspaceRequest,
	fetchFolder,
	getInitialPageParams,
	getStored,
	isRequestCanceled,
} from "./request";
import type {
	FileStoreGet,
	FileStoreSet,
	FileStoreSlice,
	PreferencesSlice,
	SortBy,
	SortOrder,
} from "./types";
import { createWorkspaceContentReset } from "./types";

function reloadSortedFolder(
	set: FileStoreSet,
	get: FileStoreGet,
	sortBy: SortBy,
	sortOrder: SortOrder,
) {
	const request = beginWorkspaceRequest(set, get);

	void fetchFolder(
		get().currentFolderId,
		getInitialPageParams(sortBy, sortOrder),
		request.signal,
	)
		.then((contents) => {
			applyWorkspaceRequestState(set, get, request, {
				files: contents.files,
				folders: contents.folders,
				filesTotalCount: contents.files_total,
				foldersTotalCount: contents.folders_total,
				nextFileCursor: contents.next_file_cursor ?? null,
			});
		})
		.catch((error) => {
			if (isRequestCanceled(error)) {
				return;
			}

			applyWorkspaceRequestState(set, get, request, {});
			logger.warn("sort refresh failed", error);
		});
}

export const createPreferencesSlice: FileStoreSlice<PreferencesSlice> = (
	set,
	get,
) => ({
	viewMode: getStored(STORAGE_KEYS.viewMode, "list"),
	browserOpenMode: getStored(STORAGE_KEYS.browserOpenMode, "single_click"),
	sortBy: getStored(STORAGE_KEYS.sortBy, "name"),
	sortOrder: getStored(STORAGE_KEYS.sortOrder, "asc"),

	setViewMode: (mode) => {
		localStorage.setItem(STORAGE_KEYS.viewMode, mode);
		set({ viewMode: mode });
		queuePreferenceSync({ view_mode: mode });
	},

	setBrowserOpenMode: (mode) => {
		localStorage.setItem(STORAGE_KEYS.browserOpenMode, mode);
		set({ browserOpenMode: mode });
		queuePreferenceSync({ browser_open_mode: mode });
	},

	setSortBy: (sortBy) => {
		localStorage.setItem(STORAGE_KEYS.sortBy, sortBy);
		queuePreferenceSync({ sort_by: sortBy });
		set({
			sortBy,
			...createWorkspaceContentReset(),
		});
		reloadSortedFolder(set, get, sortBy, get().sortOrder);
	},

	setSortOrder: (sortOrder) => {
		localStorage.setItem(STORAGE_KEYS.sortOrder, sortOrder);
		queuePreferenceSync({ sort_order: sortOrder });
		set({
			sortOrder,
			...createWorkspaceContentReset(),
		});
		reloadSortedFolder(set, get, get().sortBy, sortOrder);
	},

	_applyFromServer: ({ viewMode, browserOpenMode, sortBy, sortOrder }) => {
		localStorage.setItem(STORAGE_KEYS.viewMode, viewMode);
		localStorage.setItem(STORAGE_KEYS.browserOpenMode, browserOpenMode);
		localStorage.setItem(STORAGE_KEYS.sortBy, sortBy);
		localStorage.setItem(STORAGE_KEYS.sortOrder, sortOrder);
		set({ viewMode, browserOpenMode, sortBy, sortOrder });
	},
});
