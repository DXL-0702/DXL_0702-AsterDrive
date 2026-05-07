import type { FileListItem, FolderListItem, SearchResults } from "@/types/api";

export type SearchFilter = "all" | "file" | "folder";

export type SearchEntry =
	| { key: string; kind: "folder"; item: FolderListItem }
	| { key: string; kind: "file"; item: FileListItem };

export interface SearchPreviewLocationState {
	searchPreviewFile?: FileListItem;
}

export const SEARCH_FILTER_OPTIONS: Array<{
	labelKey: string;
	value: SearchFilter;
}> = [
	{ value: "all", labelKey: "all" },
	{ value: "file", labelKey: "files_only" },
	{ value: "folder", labelKey: "folders_only" },
];

export const EMPTY_RESULTS: SearchResults = {
	files: [],
	folders: [],
	total_files: 0,
	total_folders: 0,
};
