import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnsavedChangesGuard } from "@/components/files/preview/UnsavedChangesGuard";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => `translated:${key}`,
	}),
}));

vi.mock("@/components/common/ConfirmDialog", () => ({
	ConfirmDialog: ({
		open,
		onOpenChange,
		title,
		description,
		confirmLabel,
		onConfirm,
		variant,
	}: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		title: string;
		description: string;
		confirmLabel: string;
		onConfirm: () => void;
		variant?: string;
	}) =>
		open ? (
			<div data-testid="confirm-dialog" data-variant={variant}>
				<h2>{title}</h2>
				<p>{description}</p>
				<button type="button" onClick={() => onOpenChange(false)}>
					close
				</button>
				<button type="button" onClick={onConfirm}>
					{confirmLabel}
				</button>
			</div>
		) : null,
}));

describe("UnsavedChangesGuard", () => {
	it("passes translated strings and destructive semantics to ConfirmDialog", () => {
		const onOpenChange = vi.fn();
		const onConfirm = vi.fn();

		render(
			<UnsavedChangesGuard
				open
				onOpenChange={onOpenChange}
				onConfirm={onConfirm}
			/>,
		);

		expect(screen.getByTestId("confirm-dialog")).toHaveAttribute(
			"data-variant",
			"destructive",
		);
		expect(screen.getByText("translated:are_you_sure")).toBeInTheDocument();
		expect(
			screen.getByText("translated:files:unsaved_confirm_desc"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", {
				name: "translated:files:discard_changes",
			}),
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "close" }));
		fireEvent.click(
			screen.getByRole("button", {
				name: "translated:files:discard_changes",
			}),
		);

		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});
});
