export interface FileWithPath {
	file: File;
	relativePath: string;
}

interface FileSystemEntryCompat {
	isFile: boolean;
	isDirectory: boolean;
	fullPath?: string;
	name: string;
}

interface FileSystemFileEntryCompat extends FileSystemEntryCompat {
	isFile: true;
	file: (
		callback: (file: File) => void,
		errorCallback?: (error: DOMException) => void,
	) => void;
}

interface FileSystemDirectoryReaderCompat {
	readEntries: (
		callback: (entries: FileSystemEntryCompat[]) => void,
		errorCallback?: (error: DOMException) => void,
	) => void;
}

interface FileSystemDirectoryEntryCompat extends FileSystemEntryCompat {
	isDirectory: true;
	createReader: () => FileSystemDirectoryReaderCompat;
}

type DataTransferItemWithEntry = DataTransferItem & {
	webkitGetAsEntry?: () => FileSystemEntryCompat | null;
};

function normalizeRelativePath(path: string) {
	return path.replaceAll("\\", "/").replace(/^\/+/, "");
}

export function extractFilesFromInput(files: FileList): FileWithPath[] {
	return Array.from(files).map((file) => ({
		file,
		relativePath: normalizeRelativePath(file.webkitRelativePath || file.name),
	}));
}

export function hasDirectoryInDropItems(items: DataTransferItemList): boolean {
	for (const item of Array.from(items)) {
		if (item.kind !== "file") {
			continue;
		}

		const compatItem = item as DataTransferItemWithEntry;
		const entry =
			typeof compatItem.webkitGetAsEntry === "function"
				? compatItem.webkitGetAsEntry()
				: null;
		if (entry?.isDirectory) {
			return true;
		}
	}

	return false;
}

function readFileEntry(
	entry: FileSystemFileEntryCompat,
): Promise<FileWithPath[]> {
	return new Promise((resolve, reject) => {
		entry.file((file) => {
			const relativePath = normalizeRelativePath(entry.fullPath || file.name);
			resolve([{ file, relativePath }]);
		}, reject);
	});
}

function readDirectoryEntries(
	reader: FileSystemDirectoryReaderCompat,
): Promise<FileSystemEntryCompat[]> {
	return new Promise((resolve, reject) => {
		reader.readEntries(resolve, reject);
	});
}

async function readDirectoryEntry(
	entry: FileSystemDirectoryEntryCompat,
): Promise<FileWithPath[]> {
	const reader = entry.createReader();
	const results: FileWithPath[] = [];

	while (true) {
		const entries = await readDirectoryEntries(reader);
		if (entries.length === 0) {
			break;
		}
		for (const child of entries) {
			results.push(...(await readEntry(child)));
		}
	}

	return results;
}

async function readEntry(
	entry: FileSystemEntryCompat,
): Promise<FileWithPath[]> {
	if (entry.isFile) {
		return readFileEntry(entry as FileSystemFileEntryCompat);
	}
	if (entry.isDirectory) {
		return readDirectoryEntry(entry as FileSystemDirectoryEntryCompat);
	}
	return [];
}

export async function extractFilesFromDrop(
	items: DataTransferItemList,
): Promise<FileWithPath[]> {
	// DataTransferItemList 在 drop 事件 handler 返回（或首个 async 边界）后
	// 会被浏览器清空。必须在 await 之前同步收集所有 entry 和 File。
	const syncEntries: FileSystemEntryCompat[] = [];
	const syncFiles: File[] = [];

	for (const item of Array.from(items)) {
		if (item.kind !== "file") {
			continue;
		}

		const compatItem = item as DataTransferItemWithEntry;
		const entry =
			typeof compatItem.webkitGetAsEntry === "function"
				? compatItem.webkitGetAsEntry()
				: null;
		if (entry) {
			syncEntries.push(entry);
			continue;
		}

		const file = item.getAsFile();
		if (file) {
			syncFiles.push(file);
		}
	}

	// FileSystemEntry 对象在 DataTransfer 清空后仍然有效
	const results: FileWithPath[] = [];
	for (const entry of syncEntries) {
		results.push(...(await readEntry(entry)));
	}
	for (const file of syncFiles) {
		results.push({ file, relativePath: file.name });
	}

	return results;
}
