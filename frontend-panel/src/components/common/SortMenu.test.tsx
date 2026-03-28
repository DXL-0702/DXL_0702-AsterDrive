import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SortMenu } from "@/components/common/SortMenu";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => `translated:${key}`,
	}),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({ children }: { children: React.ReactNode }) => (
		<button type="button">{children}</button>
	),
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: ({ name }: { name: string }) => (
		<span data-testid="icon" data-name={name} />
	),
}));

vi.mock("@/components/ui/dropdown-menu", async () => {
	const React = await import("react");
	const RadioGroupContext = React.createContext<(value: string) => void>(
		() => {},
	);

	return {
		DropdownMenu: ({ children }: { children: React.ReactNode }) => (
			<div>{children}</div>
		),
		DropdownMenuTrigger: ({ render }: { render: React.ReactNode }) => render,
		DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
			<div>{children}</div>
		),
		DropdownMenuSeparator: () => <hr />,
		DropdownMenuRadioGroup: ({
			children,
			onValueChange,
		}: {
			children: React.ReactNode;
			onValueChange?: (value: string) => void;
		}) => (
			<RadioGroupContext.Provider value={onValueChange ?? (() => {})}>
				<div>{children}</div>
			</RadioGroupContext.Provider>
		),
		DropdownMenuRadioItem: ({
			children,
			value,
		}: {
			children: React.ReactNode;
			value: string;
		}) => {
			const onValueChange = React.useContext(RadioGroupContext);
			return (
				<button
					type="button"
					data-value={value}
					onClick={() => onValueChange(value)}
				>
					{children}
				</button>
			);
		},
	};
});

describe("SortMenu", () => {
	it("renders the active sort label and ascending icon", () => {
		render(
			<SortMenu
				sortBy="name"
				sortOrder="asc"
				onSortBy={vi.fn()}
				onSortOrder={vi.fn()}
			/>,
		);

		expect(screen.getAllByText("translated:sort_name")[0]).toBeInTheDocument();
		expect(screen.getAllByTestId("icon")[0]).toHaveAttribute(
			"data-name",
			"SortAscending",
		);
	});

	it("calls sort handlers for field and order changes", () => {
		const onSortBy = vi.fn();
		const onSortOrder = vi.fn();

		render(
			<SortMenu
				sortBy="updated_at"
				sortOrder="desc"
				onSortBy={onSortBy}
				onSortOrder={onSortOrder}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", { name: "translated:sort_size" }),
		);
		fireEvent.click(
			screen.getByRole("button", { name: "translated:sort_asc" }),
		);

		expect(screen.getAllByTestId("icon")[0]).toHaveAttribute(
			"data-name",
			"SortDescending",
		);
		expect(
			screen.getAllByText("translated:sort_updated_at")[0],
		).toBeInTheDocument();

		expect(onSortBy).toHaveBeenCalledWith("size");
		expect(onSortOrder).toHaveBeenCalledWith("asc");
	});
});
