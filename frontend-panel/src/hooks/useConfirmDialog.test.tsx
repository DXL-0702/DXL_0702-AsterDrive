import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

describe("useConfirmDialog", () => {
	it("opens and closes around the requested confirm id", () => {
		const onConfirm = vi.fn();
		const { result } = renderHook(() => useConfirmDialog<number>(onConfirm));

		expect(result.current.confirmId).toBeNull();
		expect(result.current.dialogProps.open).toBe(false);

		act(() => {
			result.current.requestConfirm(42);
		});

		expect(result.current.confirmId).toBe(42);
		expect(result.current.dialogProps.open).toBe(true);
		expect(result.current.dialogProps.confirmId).toBe(42);

		act(() => {
			result.current.dialogProps.onOpenChange(false);
		});

		expect(result.current.confirmId).toBeNull();
		expect(result.current.dialogProps.open).toBe(false);
	});

	it("invokes the confirm callback with the active id and clears state", () => {
		const onConfirm = vi.fn();
		const { result } = renderHook(() => useConfirmDialog<string>(onConfirm));

		act(() => {
			result.current.requestConfirm("file-7");
		});

		act(() => {
			result.current.dialogProps.onConfirm();
		});

		expect(onConfirm).toHaveBeenCalledWith("file-7");
		expect(result.current.confirmId).toBeNull();
		expect(result.current.dialogProps.open).toBe(false);
	});

	it("does nothing when confirm is triggered without a selected id", () => {
		const onConfirm = vi.fn();
		const { result } = renderHook(() => useConfirmDialog<number>(onConfirm));

		act(() => {
			result.current.dialogProps.onConfirm();
		});

		expect(onConfirm).not.toHaveBeenCalled();
	});
});
