import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileBrowserToolbar } from "@/pages/file-browser/FileBrowserToolbar";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock("@/components/common/SortMenu", () => ({
	SortMenu: (props: {
		onSortBy: (value: "updated_at") => void;
		onSortOrder: (value: "desc") => void;
	}) => (
		<div>
			<button type="button" onClick={() => props.onSortBy("updated_at")}>
				sort-by-updated
			</button>
			<button type="button" onClick={() => props.onSortOrder("desc")}>
				sort-order-desc
			</button>
		</div>
	),
}));

vi.mock("@/components/common/ToolbarBar", () => ({
	ToolbarBar: (props: { left?: React.ReactNode; right?: React.ReactNode }) => (
		<div>
			<div>{props.left}</div>
			<div>{props.right}</div>
		</div>
	),
}));

vi.mock("@/components/common/ViewToggle", () => ({
	ViewToggle: (props: { onChange: (value: "grid" | "list") => void }) => (
		<button type="button" onClick={() => props.onChange("list")}>
			view-list
		</button>
	),
}));

vi.mock("@/components/ui/breadcrumb", () => ({
	Breadcrumb: (props: { children: React.ReactNode }) => (
		<div>{props.children}</div>
	),
	BreadcrumbEllipsis: () => <span>ellipsis</span>,
	BreadcrumbItem: (props: {
		children: React.ReactNode;
		className?: string;
	}) => <div className={props.className}>{props.children}</div>,
	BreadcrumbLink: (props: {
		children: React.ReactNode;
		className?: string;
		onClick?: () => void;
		onDragLeave?: (event: unknown) => void;
		onDragOver?: (event: unknown) => void;
		onDrop?: (event: unknown) => void;
	}) => (
		<button
			type="button"
			className={props.className}
			onClick={props.onClick}
			onDragLeave={props.onDragLeave as never}
			onDragOver={props.onDragOver as never}
			onDrop={props.onDrop as never}
		>
			{props.children}
		</button>
	),
	BreadcrumbList: (props: {
		children: React.ReactNode;
		className?: string;
	}) => <div className={props.className}>{props.children}</div>,
	BreadcrumbPage: (props: {
		children: React.ReactNode;
		className?: string;
	}) => <span className={props.className}>{props.children}</span>,
	BreadcrumbSeparator: (props: { className?: string }) => (
		<span className={props.className}>/</span>
	),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
	DropdownMenu: (props: { children: React.ReactNode }) => (
		<div>{props.children}</div>
	),
	DropdownMenuContent: (props: {
		children: React.ReactNode;
		className?: string;
	}) => <div className={props.className}>{props.children}</div>,
	DropdownMenuItem: (props: {
		children: React.ReactNode;
		onClick?: () => void;
	}) => (
		<button type="button" onClick={props.onClick}>
			{props.children}
		</button>
	),
	DropdownMenuTrigger: (props: {
		children?: React.ReactNode;
		render?: React.ReactNode;
	}) => <div>{props.render ?? props.children}</div>,
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: () => <span>icon</span>,
}));

function renderToolbar(
	overrides: Partial<React.ComponentProps<typeof FileBrowserToolbar>> = {},
) {
	const handlers = {
		onBreadcrumbDragLeave: vi.fn(),
		onBreadcrumbDragOver: vi.fn(),
		onBreadcrumbDrop: vi.fn().mockResolvedValue(undefined),
		onNavigateToFolder: vi.fn(),
		onRefresh: vi.fn(),
		onSetSortBy: vi.fn(),
		onSetSortOrder: vi.fn(),
		onSetViewMode: vi.fn(),
	};

	render(
		<FileBrowserToolbar
			breadcrumb={[
				{ id: null, name: "Root" },
				{ id: 2, name: "Docs" },
				{ id: 3, name: "Workspace" },
				{ id: 4, name: "Final" },
			]}
			dragOverBreadcrumbIndex={null}
			isCompactBreadcrumb
			isRootFolder={false}
			isSearching={false}
			searchQuery={null}
			sortBy="name"
			sortOrder="asc"
			viewMode="grid"
			{...handlers}
			{...overrides}
		/>,
	);

	return handlers;
}

describe("FileBrowserToolbar", () => {
	it("renders compact breadcrumbs and wires toolbar actions", () => {
		const handlers = renderToolbar();

		fireEvent.click(screen.getByText("Docs"));
		fireEvent.click(screen.getByRole("button", { name: "core:refresh" }));
		fireEvent.click(screen.getByRole("button", { name: "sort-by-updated" }));
		fireEvent.click(screen.getByRole("button", { name: "sort-order-desc" }));
		fireEvent.click(screen.getByRole("button", { name: "view-list" }));

		expect(
			screen.getByRole("button", { name: "core:more" }),
		).toBeInTheDocument();
		expect(screen.getByText("Final")).toBeInTheDocument();
		expect(handlers.onNavigateToFolder).toHaveBeenCalledWith(2, "Docs");
		expect(handlers.onRefresh).toHaveBeenCalledTimes(1);
		expect(handlers.onSetSortBy).toHaveBeenCalledWith("updated_at");
		expect(handlers.onSetSortOrder).toHaveBeenCalledWith("desc");
		expect(handlers.onSetViewMode).toHaveBeenCalledWith("list");
	});

	it("shows the search summary instead of breadcrumbs while searching", () => {
		renderToolbar({
			isSearching: true,
			searchQuery: "budget",
		});

		expect(screen.getByText('core:search: "budget"')).toBeInTheDocument();
		expect(screen.queryByText("Root")).not.toBeInTheDocument();
	});
});
