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
	const results: FileWithPath[] = [];

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
			results.push(...(await readEntry(entry)));
			continue;
		}

		const file = item.getAsFile();
		if (file) {
			results.push({ file, relativePath: file.name });
		}
	}

	return results;
}
