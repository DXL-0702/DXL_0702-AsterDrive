import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopBarShell } from "@/components/layout/TopBarShell";

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		className,
		onClick,
	}: {
		children: React.ReactNode;
		className?: string;
		onClick?: () => void;
	}) => (
		<button type="button" className={className} onClick={onClick}>
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
				left={<span>Left</span>}
				center={<span>Center</span>}
				right={<span>Right</span>}
			/>,
		);

		expect(screen.getByText("Left")).toBeInTheDocument();
		expect(screen.getByText("Center")).toBeInTheDocument();
		expect(screen.getByText("Right")).toBeInTheDocument();
		expect(screen.getByTestId("icon")).toHaveAttribute("data-name", "List");

		fireEvent.click(screen.getByRole("button"));

		expect(onSidebarToggle).toHaveBeenCalledTimes(1);
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
