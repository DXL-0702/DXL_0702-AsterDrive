import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppLayout } from "@/components/layout/AppLayout";

vi.mock("@/components/layout/TopBar", () => ({
	TopBar: ({
		onSidebarToggle,
		mobileOpen,
		actions,
	}: {
		onSidebarToggle: () => void;
		mobileOpen: boolean;
		actions?: React.ReactNode;
	}) => (
		<div data-testid="topbar" data-mobile-open={String(mobileOpen)}>
			<button type="button" onClick={onSidebarToggle}>
				Toggle Sidebar
			</button>
			{actions}
		</div>
	),
}));

vi.mock("@/components/layout/Sidebar", () => ({
	Sidebar: ({
		mobileOpen,
		onMobileClose,
		onTrashDrop,
		onMoveToFolder,
	}: {
		mobileOpen: boolean;
		onMobileClose: () => void;
		onTrashDrop?: unknown;
		onMoveToFolder?: unknown;
	}) => (
		<div
			data-testid="sidebar"
			data-mobile-open={String(mobileOpen)}
			data-has-trash-drop={String(Boolean(onTrashDrop))}
			data-has-move={String(Boolean(onMoveToFolder))}
		>
			<button type="button" onClick={onMobileClose}>
				Close Sidebar
			</button>
		</div>
	),
}));

describe("AppLayout", () => {
	it("renders children and forwards actions and drag handlers", () => {
		const onTrashDrop = vi.fn();
		const onMoveToFolder = vi.fn();

		render(
			<AppLayout
				actions={<button type="button">Extra</button>}
				onTrashDrop={onTrashDrop}
				onMoveToFolder={onMoveToFolder}
			>
				<div>Page Content</div>
			</AppLayout>,
		);

		expect(screen.getByRole("button", { name: "Extra" })).toBeInTheDocument();
		expect(screen.getByText("Page Content")).toBeInTheDocument();
		expect(screen.getByTestId("topbar")).toHaveAttribute(
			"data-mobile-open",
			"false",
		);
		expect(screen.getByTestId("sidebar")).toHaveAttribute(
			"data-has-trash-drop",
			"true",
		);
		expect(screen.getByTestId("sidebar")).toHaveAttribute(
			"data-has-move",
			"true",
		);
	});

	it("toggles and closes the mobile sidebar", () => {
		render(<AppLayout>Page Content</AppLayout>);

		expect(screen.getByTestId("sidebar")).toHaveAttribute(
			"data-mobile-open",
			"false",
		);
		expect(screen.getByTestId("topbar")).toHaveAttribute(
			"data-mobile-open",
			"false",
		);

		fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
		expect(screen.getByTestId("sidebar")).toHaveAttribute(
			"data-mobile-open",
			"true",
		);
		expect(screen.getByTestId("topbar")).toHaveAttribute(
			"data-mobile-open",
			"true",
		);

		fireEvent.click(screen.getByRole("button", { name: "Close Sidebar" }));
		expect(screen.getByTestId("sidebar")).toHaveAttribute(
			"data-mobile-open",
			"false",
		);
		expect(screen.getByTestId("topbar")).toHaveAttribute(
			"data-mobile-open",
			"false",
		);
	});
});
