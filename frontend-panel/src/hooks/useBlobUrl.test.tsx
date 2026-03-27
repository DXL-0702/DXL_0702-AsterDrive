import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
	get: vi.fn(),
	warn: vi.fn(),
}));

vi.mock("@/services/http", () => ({
	api: {
		client: {
			get: mockState.get,
		},
	},
}));

vi.mock("@/lib/logger", () => ({
	logger: {
		warn: mockState.warn,
	},
}));

async function loadHookModule() {
	vi.resetModules();
	return await import("@/hooks/useBlobUrl");
}

describe("useBlobUrl", () => {
	beforeEach(() => {
		mockState.get.mockReset();
		mockState.warn.mockReset();
		Object.defineProperty(URL, "createObjectURL", {
			configurable: true,
			value: vi
				.fn()
				.mockReturnValueOnce("blob:1")
				.mockReturnValueOnce("blob:2")
				.mockReturnValue("blob:3"),
		});
		Object.defineProperty(URL, "revokeObjectURL", {
			configurable: true,
			value: vi.fn(),
		});
	});

	it("loads blob URLs once and reuses the cache for concurrent consumers", async () => {
		mockState.get.mockResolvedValue({
			status: 200,
			data: new Blob(["image"]),
			headers: { etag: '"etag-1"' },
		});
		const { clearBlobUrlCache, useBlobUrl } = await loadHookModule();

		const first = renderHook(() => useBlobUrl("/thumb"));
		await waitFor(() => {
			expect(first.result.current.blobUrl).toBe("blob:1");
		});

		const second = renderHook(() => useBlobUrl("/thumb"));
		await waitFor(() => {
			expect(second.result.current.blobUrl).toBe("blob:1");
		});

		expect(mockState.get).toHaveBeenCalledTimes(1);

		first.unmount();
		second.unmount();
		clearBlobUrlCache();

		expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:1");
	});

	it("retries thumbnail generation after 202 responses", async () => {
		mockState.get
			.mockResolvedValueOnce({
				status: 202,
				data: new Blob([]),
				headers: { "retry-after": "0.001" },
			})
			.mockResolvedValueOnce({
				status: 200,
				data: new Blob(["image"]),
				headers: { etag: '"etag-2"' },
			});
		const { clearBlobUrlCache, useBlobUrl } = await loadHookModule();

		const { result } = renderHook(() => useBlobUrl("/thumb"));

		await waitFor(() => {
			expect(mockState.get).toHaveBeenCalledTimes(2);
		});
		await waitFor(() => {
			expect(result.current.blobUrl).toBe("blob:1");
		});
		clearBlobUrlCache();
	});

	it("exposes errors and allows retries after failures", async () => {
		mockState.get
			.mockRejectedValueOnce(new Error("fetch failed"))
			.mockResolvedValueOnce({
				status: 200,
				data: new Blob(["image"]),
				headers: { etag: '"etag-3"' },
			});
		const { clearBlobUrlCache, useBlobUrl } = await loadHookModule();

		const { result } = renderHook(() => useBlobUrl("/thumb"));

		await waitFor(() => {
			expect(result.current.error).toBe(true);
		});
		expect(mockState.warn).toHaveBeenCalledWith(
			"blob fetch failed",
			"/thumb",
			expect.any(Error),
		);

		result.current.retry();

		await waitFor(() => {
			expect(result.current.blobUrl).toBe("blob:1");
		});
		expect(result.current.error).toBe(false);
		clearBlobUrlCache();
	});

	it("revalidates cached blobs with etags and keeps the same object url on 304", async () => {
		mockState.get
			.mockResolvedValueOnce({
				status: 200,
				data: new Blob(["image"]),
				headers: { etag: '"etag-4"' },
			})
			.mockResolvedValueOnce({
				status: 304,
				data: new Blob([]),
				headers: {},
			});
		const { clearBlobUrlCache, useBlobUrl } = await loadHookModule();

		const first = renderHook(() => useBlobUrl("/thumb"));
		await waitFor(() => {
			expect(first.result.current.blobUrl).toBe("blob:1");
		});
		first.unmount();

		const second = renderHook(() => useBlobUrl("/thumb"));
		await waitFor(() => {
			expect(second.result.current.blobUrl).toBe("blob:1");
		});

		expect(mockState.get).toHaveBeenNthCalledWith(2, "/thumb", {
			headers: { "If-None-Match": '"etag-4"' },
			responseType: "blob",
			validateStatus: expect.any(Function),
		});
		expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
		clearBlobUrlCache();
	});

	it("stays idle when no path is provided", async () => {
		const { clearBlobUrlCache, useBlobUrl } = await loadHookModule();

		const { result } = renderHook(() => useBlobUrl(null));

		expect(result.current.blobUrl).toBeNull();
		expect(result.current.error).toBe(false);
		expect(result.current.loading).toBe(false);
		expect(mockState.get).not.toHaveBeenCalled();
		clearBlobUrlCache();
	});
});
