import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRetainedDialogValue } from "@/hooks/useRetainedDialogValue";

describe("useRetainedDialogValue", () => {
	it("retains the last value until the close animation completes", () => {
		const { result, rerender } = renderHook(
			({ open, value }: { open: boolean; value: string | null }) =>
				useRetainedDialogValue(value, open),
			{
				initialProps: {
					open: true,
					value: "dialog-payload",
				},
			},
		);

		expect(result.current.retainedValue).toBe("dialog-payload");

		rerender({
			open: false,
			value: null,
		});

		expect(result.current.retainedValue).toBe("dialog-payload");

		act(() => {
			result.current.handleOpenChangeComplete(false);
		});

		expect(result.current.retainedValue).toBeNull();
	});

	it("does not keep stale content when the dialog is still open without a value", () => {
		const { result, rerender } = renderHook(
			({ open, value }: { open: boolean; value: string | null }) =>
				useRetainedDialogValue(value, open),
			{
				initialProps: {
					open: true,
					value: "dialog-payload",
				},
			},
		);

		rerender({
			open: true,
			value: null,
		});

		expect(result.current.retainedValue).toBeNull();
	});
});
