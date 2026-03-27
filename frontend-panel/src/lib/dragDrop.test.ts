import { describe, expect, it, vi } from "vitest";
import { DRAG_MIME } from "@/lib/constants";
import {
	getInvalidInternalDropReason,
	hasInternalDragData,
	readInternalDragData,
	writeInternalDragData,
} from "@/lib/dragDrop";

describe("dragDrop", () => {
	it("detects whether a data transfer contains internal drag data", () => {
		expect(hasInternalDragData(null)).toBe(false);
		expect(
			hasInternalDragData({
				types: ["text/plain", DRAG_MIME],
			} as unknown as DataTransfer),
		).toBe(true);
		expect(
			hasInternalDragData({
				types: ["text/plain"],
			} as unknown as DataTransfer),
		).toBe(false);
	});

	it("reads and sanitizes internal drag payloads", () => {
		const dataTransfer = {
			types: [DRAG_MIME],
			getData: vi.fn().mockReturnValue(
				JSON.stringify({
					fileIds: [7, -1, 0, 3.2, 8],
					folderIds: [4, "6", null, 9],
				}),
			),
		} as unknown as DataTransfer;

		expect(readInternalDragData(dataTransfer)).toEqual({
			fileIds: [7, 8],
			folderIds: [4, 9],
		});
	});

	it("returns null for invalid or empty internal drag payloads", () => {
		expect(
			readInternalDragData({
				types: [DRAG_MIME],
				getData: vi.fn().mockReturnValue(""),
			} as unknown as DataTransfer),
		).toBeNull();
		expect(
			readInternalDragData({
				types: [DRAG_MIME],
				getData: vi.fn().mockReturnValue("{bad json"),
			} as unknown as DataTransfer),
		).toBeNull();
		expect(
			readInternalDragData({
				types: [DRAG_MIME],
				getData: vi.fn().mockReturnValue(
					JSON.stringify({
						fileIds: [-1, 0],
						folderIds: ["x"],
					}),
				),
			} as unknown as DataTransfer),
		).toBeNull();
	});

	it("writes the expected MIME payload and move effect", () => {
		const setData = vi.fn();
		const dataTransfer = {
			effectAllowed: "copy",
			setData,
		} as unknown as DataTransfer;

		writeInternalDragData(dataTransfer, {
			fileIds: [7, 8],
			folderIds: [3],
		});

		expect(setData).toHaveBeenCalledWith(
			DRAG_MIME,
			JSON.stringify({
				fileIds: [7, 8],
				folderIds: [3],
			}),
		);
		expect(dataTransfer.effectAllowed).toBe("move");
	});

	it("identifies invalid self and descendant drops", () => {
		const dragData = { fileIds: [10], folderIds: [4, 7] };

		expect(getInvalidInternalDropReason(dragData, 7, [1, 2, 3])).toBe("self");
		expect(getInvalidInternalDropReason(dragData, 9, [1, 4, 9])).toBe(
			"descendant",
		);
		expect(getInvalidInternalDropReason(dragData, null, [1, 2, 3])).toBeNull();
	});
});
