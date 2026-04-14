import {
	applyWorkspaceRequestState,
	beginWorkspaceRequest,
	cancelWorkspaceRequest,
	isRequestCanceled,
	runSearch,
} from "./request";
import type { FileStoreSlice, SearchSlice } from "./types";
import { createSearchReset, createSelectionReset } from "./types";

export const createSearchSlice: FileStoreSlice<SearchSlice> = (set, get) => ({
	searchQuery: null,
	searchFolders: [],
	searchFiles: [],

	search: async (query) => {
		const request = beginWorkspaceRequest(set, get);
		set({ loading: true, searchQuery: query });

		try {
			const results = await runSearch({ q: query, limit: 100 }, request.signal);

			applyWorkspaceRequestState(set, get, request, {
				searchFiles: results.files,
				searchFolders: results.folders,
				loading: false,
				...createSelectionReset(),
			});
		} catch (error) {
			if (isRequestCanceled(error)) {
				applyWorkspaceRequestState(set, get, request, { loading: false });
				return;
			}

			applyWorkspaceRequestState(set, get, request, { loading: false });
			throw error;
		}
	},

	clearSearch: () => {
		cancelWorkspaceRequest(set, get);
		set({
			loading: false,
			...createSearchReset(),
		});
	},
});
