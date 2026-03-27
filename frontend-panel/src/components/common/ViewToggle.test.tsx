import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ViewToggle } from "@/components/common/ViewToggle";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => `translated:${key}`,
	}),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		className,
		onClick,
	}: {
		className?: string;
		onClick?: () => void;
	}) => <button className={className} onClick={onClick} type="button" />,
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: () => null,
}));

vi.mock("@/components/ui/tooltip", () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	TooltipTrigger: ({ render }: { render: React.ReactNode }) => render,
	TooltipContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

describe("ViewToggle", () => {
	it("highlights the active list button and switches to grid", () => {
		const onChange = vi.fn();

		render(<ViewToggle value="list" onChange={onChange} />);

		expect(screen.getByText("translated:list_view")).toBeInTheDocument();
		expect(screen.getByText("translated:grid_view")).toBeInTheDocument();

		const buttons = screen.getAllByRole("button");
		expect(buttons[0]).toHaveClass("bg-accent");
		expect(buttons[1]).not.toHaveClass("bg-accent");

		fireEvent.click(buttons[1]);

		expect(onChange).toHaveBeenCalledWith("grid");
	});

	it("highlights the active grid button and switches to list", () => {
		const onChange = vi.fn();

		render(<ViewToggle value="grid" onChange={onChange} />);

		const buttons = screen.getAllByRole("button");
		expect(buttons[0]).not.toHaveClass("bg-accent");
		expect(buttons[1]).toHaveClass("bg-accent");

		fireEvent.click(buttons[0]);

		expect(onChange).toHaveBeenCalledWith("list");
	});
});
