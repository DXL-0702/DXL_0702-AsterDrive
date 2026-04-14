import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopBarShell } from "@/components/layout/TopBarShell";

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		className,
		onClick,
		"aria-label": ariaLabel,
		"aria-expanded": ariaExpanded,
	}: {
		children: React.ReactNode;
		className?: string;
		onClick?: () => void;
		"aria-label"?: string;
		"aria-expanded"?: boolean;
	}) => (
		<button
			type="button"
			className={className}
			onClick={onClick}
			aria-label={ariaLabel}
			aria-expanded={ariaExpanded}
		>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: ({ name }: { name: string }) => (
		<span data-testid="icon" data-name={name} />
	),
}));

describe("TopBarShell", () => {
	it("renders the optional sidebar toggle and triggers it", () => {
		const onSidebarToggle = vi.fn();

		render(
			<TopBarShell
				onSidebarToggle={onSidebarToggle}
				sidebarToggleLabels={{
					open: "Open sidebar",
					close: "Close sidebar",
				}}
				left={<span>Left</span>}
				center={<span>Center</span>}
				right={<span>Right</span>}
			/>,
		);

		expect(screen.getByText("Left")).toBeInTheDocument();
		expect(screen.getByText("Center")).toBeInTheDocument();
		expect(screen.getByText("Right")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Open sidebar" }),
		).toHaveAttribute("aria-expanded", "false");
		expect(screen.getAllByTestId("icon")).toHaveLength(2);
		expect(screen.getAllByTestId("icon")[0]).toHaveAttribute(
			"data-name",
			"List",
		);
		expect(screen.getAllByTestId("icon")[1]).toHaveAttribute("data-name", "X");

		fireEvent.click(screen.getByRole("button", { name: "Open sidebar" }));

		expect(onSidebarToggle).toHaveBeenCalledTimes(1);
	});

	it("switches the toggle label and expanded state when the sidebar is open", () => {
		render(
			<TopBarShell
				onSidebarToggle={vi.fn()}
				sidebarOpen
				sidebarToggleLabels={{
					open: "Open sidebar",
					close: "Close sidebar",
				}}
				left={<span>Left</span>}
				right={<span>Right</span>}
			/>,
		);

		expect(
			screen.getByRole("button", { name: "Close sidebar" }),
		).toHaveAttribute("aria-expanded", "true");
	});

	it("renders a spacer when center content is omitted", () => {
		const { container } = render(
			<TopBarShell
				left={<span>Left</span>}
				right={<span>Right</span>}
				heightClassName="h-20"
			/>,
		);

		expect(screen.getByText("Left")).toBeInTheDocument();
		expect(screen.getByText("Right")).toBeInTheDocument();
		expect(screen.queryByTestId("icon")).not.toBeInTheDocument();
		expect(container.querySelector(".h-20")).toBeInTheDocument();
	});
});
