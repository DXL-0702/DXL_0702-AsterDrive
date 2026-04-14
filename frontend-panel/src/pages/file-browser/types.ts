import type {
	FileInfo,
	FileListItem,
	FolderInfo,
	FolderListItem,
} from "@/types/api";

export interface FileBrowserPreviewState {
	file: FileInfo | FileListItem;
	openMode: "auto" | "direct" | "picker";
}

export interface FileBrowserShareTarget {
	fileId?: number;
	folderId?: number;
	name: string;
	initialMode?: "page" | "direct";
}

export interface FileBrowserCopyTarget {
	type: "file" | "folder";
	id: number;
}

export interface FileBrowserMoveTarget {
	fileIds: number[];
	folderIds: number[];
}

export interface FileBrowserVersionTarget {
	fileId: number;
	fileName: string;
	mimeType: string;
}

export interface FileBrowserRenameTarget {
	type: "file" | "folder";
	id: number;
	name: string;
}

export interface FileBrowserInfoTarget {
	file?: FileInfo | FileListItem;
	folder?: FolderInfo | FolderListItem;
}
