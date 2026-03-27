import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
	handleApiError: vi.fn(),
}));

vi.mock("@/hooks/useApiError", () => ({
	handleApiError: mockState.handleApiError,
}));

describe("useApiList", () => {
	beforeEach(() => {
		mockState.handleApiError.mockReset();
	});

	it("loads list data on mount and exposes reload", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce({ items: ["a"], total: 1 })
			.mockResolvedValueOnce({ items: ["b"], total: 2 });
		const { useApiList } = await import("@/hooks/useApiList");
		const { result } = renderHook(() => useApiList(fetcher));

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});
		expect(result.current.items).toEqual(["a"]);
		expect(result.current.total).toBe(1);

		await result.current.reload();

		await waitFor(() => {
			expect(result.current.items).toEqual(["b"]);
		});
		expect(result.current.total).toBe(2);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it("reports fetch failures through handleApiError", async () => {
		const failure = new Error("load failed");
		const fetcher = vi.fn().mockRejectedValue(failure);
		const { useApiList } = await import("@/hooks/useApiList");
		const { result } = renderHook(() => useApiList(fetcher));

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});
		expect(result.current.items).toEqual([]);
		expect(result.current.total).toBe(0);
		expect(mockState.handleApiError).toHaveBeenCalledWith(failure);
	});
});
