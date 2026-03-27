import { describe, expect, it } from "vitest";
import {
	extractFilesFromDrop,
	extractFilesFromInput,
	hasDirectoryInDropItems,
} from "@/utils/directoryUtils";

function createFileList(files: File[]): FileList {
	const list = {
		length: files.length,
		item: (index: number) => files[index] ?? null,
		...files,
	};
	return list as unknown as FileList;
}

describe("directoryUtils", () => {
	it("extracts files from file input and normalizes relative paths", () => {
		const nestedFile = new File(["a"], "child.txt");
		Object.defineProperty(nestedFile, "webkitRelativePath", {
			configurable: true,
			value: "\\folder\\child.txt",
		});
		const rootFile = new File(["b"], "root.txt");

		expect(
			extractFilesFromInput(createFileList([nestedFile, rootFile])),
		).toEqual([
			{
				file: nestedFile,
				relativePath: "folder/child.txt",
			},
			{
				file: rootFile,
				relativePath: "root.txt",
			},
		]);
	});

	it("detects directory entries in drop items", () => {
		const directoryItems = [
			{
				kind: "file",
				webkitGetAsEntry: () => ({
					isDirectory: true,
					isFile: false,
					name: "folder",
				}),
			},
		];

		const plainItems = [
			{
				kind: "file",
				webkitGetAsEntry: () => ({
					isDirectory: false,
					isFile: true,
					name: "file.txt",
				}),
			},
		];

		expect(
			hasDirectoryInDropItems(
				directoryItems as unknown as DataTransferItemList,
			),
		).toBe(true);
		expect(
			hasDirectoryInDropItems(plainItems as unknown as DataTransferItemList),
		).toBe(false);
	});

	it("extracts nested file entries and fallback files from drops", async () => {
		const nestedFile = new File(["nested"], "nested.txt");
		const looseFile = new File(["loose"], "loose.txt");
		const fileEntry = {
			fullPath: "/folder\\nested.txt",
			isDirectory: false,
			isFile: true,
			name: "nested.txt",
			file: (callback: (file: File) => void) => callback(nestedFile),
		};
		const directoryEntry = {
			isDirectory: true,
			isFile: false,
			name: "folder",
			createReader: () => {
				let callCount = 0;
				return {
					readEntries: (
						callback: (entries: Array<typeof fileEntry>) => void,
					) => {
						callCount += 1;
						callback(callCount === 1 ? [fileEntry] : []);
					},
				};
			},
		};

		const items = [
			{
				kind: "file",
				getAsFile: () => null,
				webkitGetAsEntry: () => directoryEntry,
			},
			{
				kind: "file",
				getAsFile: () => looseFile,
			},
		];

		await expect(
			extractFilesFromDrop(items as unknown as DataTransferItemList),
		).resolves.toEqual([
			{
				file: nestedFile,
				relativePath: "folder/nested.txt",
			},
			{
				file: looseFile,
				relativePath: "loose.txt",
			},
		]);
	});
});
