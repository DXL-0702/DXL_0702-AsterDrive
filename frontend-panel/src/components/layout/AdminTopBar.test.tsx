import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminTopBar } from "@/components/layout/AdminTopBar";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => `translated:${key}`,
	}),
}));

vi.mock("@/components/layout/HeaderControls", () => ({
	HeaderControls: ({ showHomeButton }: { showHomeButton?: boolean }) => (
		<div data-testid="header-controls" data-home={String(showHomeButton)} />
	),
}));

vi.mock("@/components/layout/TopBarShell", () => ({
	TopBarShell: ({
		onSidebarToggle,
		sidebarOpen,
		sidebarToggleLabels,
		left,
		right,
		heightClassName,
	}: {
		onSidebarToggle?: () => void;
		sidebarOpen?: boolean;
		sidebarToggleLabels?: {
			open: string;
			close: string;
		};
		left: React.ReactNode;
		right: React.ReactNode;
		heightClassName?: string;
	}) => (
		<div
			data-testid="topbar-shell"
			data-height={heightClassName}
			data-sidebar-open={String(Boolean(sidebarOpen))}
			data-open-label={sidebarToggleLabels?.open}
			data-close-label={sidebarToggleLabels?.close}
		>
			<button type="button" onClick={onSidebarToggle}>
				Toggle
			</button>
			<div>{left}</div>
			<div>{right}</div>
		</div>
	),
}));

describe("AdminTopBar", () => {
	it("renders the translated admin title, logo, and home-enabled header controls", () => {
		render(<AdminTopBar onSidebarToggle={vi.fn()} mobileOpen={false} />);

		expect(screen.getByAltText("translated:app_name")).toBeInTheDocument();
		expect(screen.getByText("translated:admin_panel")).toBeInTheDocument();
		expect(screen.getByTestId("header-controls")).toHaveAttribute(
			"data-home",
			"true",
		);
		expect(screen.getByTestId("topbar-shell")).toHaveAttribute(
			"data-height",
			"h-16",
		);
		expect(screen.getByTestId("topbar-shell")).toHaveAttribute(
			"data-sidebar-open",
			"false",
		);
		expect(screen.getByTestId("topbar-shell")).toHaveAttribute(
			"data-open-label",
			"translated:open_admin_sidebar",
		);
		expect(screen.getByTestId("topbar-shell")).toHaveAttribute(
			"data-close-label",
			"translated:close_admin_sidebar",
		);
	});

	it("forwards sidebar toggle requests to the layout", () => {
		const onSidebarToggle = vi.fn();
		render(<AdminTopBar onSidebarToggle={onSidebarToggle} mobileOpen />);

		fireEvent.click(screen.getByRole("button", { name: "Toggle" }));

		expect(onSidebarToggle).toHaveBeenCalledTimes(1);
	});
});
