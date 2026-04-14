import type { StateCreator } from "zustand";
import type {
	BatchResult,
	FileListItem,
	FolderContents,
	FolderListItem,
} from "@/types/api";

export interface BreadcrumbItem {
	id: number | null;
	name: string;
}

export interface Clipboard {
	fileIds: number[];
	folderIds: number[];
	mode: "copy" | "cut";
}

export type ViewMode = "grid" | "list";
export type BrowserOpenMode = "single_click" | "double_click";
export type SortBy = "name" | "size" | "created_at" | "updated_at" | "type";
export type SortOrder = "asc" | "desc";

export interface RequestSlice {
	resetWorkspaceState: () => void;
	workspaceRequestRevision: number;
	_workspaceRequestId: number;
	_workspaceRequestController: AbortController | null;
}

export interface NavigationSlice {
	currentFolderId: number | null;
	breadcrumb: BreadcrumbItem[];
	folders: FolderListItem[];
	files: FileListItem[];
	loading: boolean;
	error: string | null;
	filesTotalCount: number;
	foldersTotalCount: number;
	loadingMore: boolean;
	nextFileCursor: FolderContents["next_file_cursor"];
	navigateTo: (
		folderId: number | null,
		folderName?: string,
		breadcrumbPath?: BreadcrumbItem[],
	) => Promise<void>;
	refresh: () => Promise<void>;
	loadMoreFiles: () => Promise<void>;
	hasMoreFiles: () => boolean;
}

export interface SearchSlice {
	searchQuery: string | null;
	searchFolders: FolderListItem[];
	searchFiles: FileListItem[];
	search: (query: string) => Promise<void>;
	clearSearch: () => void;
}

export interface PreferencesSlice {
	viewMode: ViewMode;
	browserOpenMode: BrowserOpenMode;
	sortBy: SortBy;
	sortOrder: SortOrder;
	setViewMode: (mode: ViewMode) => void;
	setBrowserOpenMode: (mode: BrowserOpenMode) => void;
	setSortBy: (sortBy: SortBy) => void;
	setSortOrder: (sortOrder: SortOrder) => void;
	_applyFromServer: (prefs: {
		viewMode: ViewMode;
		browserOpenMode: BrowserOpenMode;
		sortBy: SortBy;
		sortOrder: SortOrder;
	}) => void;
}

export interface SelectionSlice {
	selectedFileIds: Set<number>;
	selectedFolderIds: Set<number>;
	toggleFileSelection: (id: number) => void;
	toggleFolderSelection: (id: number) => void;
	selectOnlyFile: (id: number) => void;
	selectOnlyFolder: (id: number) => void;
	selectAll: () => void;
	clearSelection: () => void;
	selectionCount: () => number;
}

export interface ClipboardSlice {
	clipboard: Clipboard | null;
	clipboardCopy: () => number;
	clipboardCut: () => number;
	clipboardPaste: () => Promise<{ mode: "copy" | "cut"; result: BatchResult }>;
	clearClipboard: () => void;
}

export interface CrudSlice {
	createFile: (name: string) => Promise<void>;
	createFolder: (name: string) => Promise<void>;
	deleteFile: (id: number) => Promise<void>;
	deleteFolder: (id: number) => Promise<void>;
	moveToFolder: (
		fileIds: number[],
		folderIds: number[],
		targetFolderId: number | null,
	) => Promise<BatchResult>;
}

export type FileState = RequestSlice &
	NavigationSlice &
	SearchSlice &
	PreferencesSlice &
	SelectionSlice &
	ClipboardSlice &
	CrudSlice;

export type FileStoreSlice<T> = StateCreator<FileState, [], [], T>;
export type FileStoreGet = () => FileState;
export type FileStoreSet = (
	partial: Partial<FileState> | ((state: FileState) => Partial<FileState>),
) => void;

export function createRootBreadcrumb(): BreadcrumbItem[] {
	return [{ id: null, name: "Root" }];
}

export function createWorkspaceContentReset() {
	return {
		folders: [] as FolderListItem[],
		files: [] as FileListItem[],
		filesTotalCount: 0,
		foldersTotalCount: 0,
		loadingMore: false,
		nextFileCursor: null as FolderContents["next_file_cursor"],
	};
}

export function createSearchReset() {
	return {
		searchQuery: null as string | null,
		searchFolders: [] as FolderListItem[],
		searchFiles: [] as FileListItem[],
	};
}

export function createSelectionReset() {
	return {
		selectedFileIds: new Set<number>(),
		selectedFolderIds: new Set<number>(),
	};
}

export function createWorkspaceResetState() {
	return {
		currentFolderId: null as number | null,
		breadcrumb: createRootBreadcrumb(),
		loading: false,
		error: null as string | null,
		clipboard: null as Clipboard | null,
		...createWorkspaceContentReset(),
		...createSearchReset(),
		...createSelectionReset(),
	};
}
