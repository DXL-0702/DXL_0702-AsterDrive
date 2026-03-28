import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminTableList } from "@/components/common/AdminTableList";

vi.mock("@/components/common/EmptyState", () => ({
	EmptyState: ({
		description,
		icon,
		title,
	}: {
		description?: string;
		icon?: React.ReactNode;
		title: string;
	}) => (
		<div>
			<div>{title}</div>
			<div>{description}</div>
			<div>{icon}</div>
		</div>
	),
}));

vi.mock("@/components/common/SkeletonTable", () => ({
	SkeletonTable: ({ columns, rows }: { columns: number; rows: number }) => (
		<div>{`skeleton:${columns}:${rows}`}</div>
	),
}));

vi.mock("@/components/layout/AdminSurface", () => ({
	AdminSurface: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="admin-surface">{children}</div>
	),
}));

vi.mock("@/components/ui/scroll-area", () => ({
	ScrollArea: ({
		children,
		className,
	}: {
		children: React.ReactNode;
		className?: string;
	}) => (
		<div data-testid="scroll-area" className={className}>
			{children}
		</div>
	),
}));

vi.mock("@/components/ui/table", () => ({
	Table: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="table">{children}</div>
	),
	TableBody: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="table-body">{children}</div>
	),
}));

describe("AdminTableList", () => {
	it("renders a skeleton table while loading", () => {
		render(
			<AdminTableList
				loading
				items={[]}
				columns={4}
				emptyTitle="empty"
				headerRow={<div>header</div>}
				renderRow={() => <div>row</div>}
			/>,
		);

		expect(screen.getByText("skeleton:4:5")).toBeInTheDocument();
	});

	it("renders the empty state when there are no items", () => {
		render(
			<AdminTableList
				loading={false}
				items={[]}
				columns={3}
				emptyIcon={<span>icon</span>}
				emptyTitle="No accounts"
				emptyDescription="Create one first"
				headerRow={<div>header</div>}
				renderRow={() => <div>row</div>}
			/>,
		);

		expect(screen.getByText("No accounts")).toBeInTheDocument();
		expect(screen.getByText("Create one first")).toBeInTheDocument();
		expect(screen.getByText("icon")).toBeInTheDocument();
	});

	it("renders the table surface, header, and each row", () => {
		const renderRow = vi.fn((item: { id: number; name: string }) => (
			<div key={item.id}>{`row:${item.name}`}</div>
		));

		render(
			<AdminTableList
				loading={false}
				items={[
					{ id: 1, name: "Alpha" },
					{ id: 2, name: "Beta" },
				]}
				columns={2}
				rows={7}
				emptyTitle="empty"
				headerRow={<div>header-row</div>}
				renderRow={renderRow}
			/>,
		);

		expect(screen.getByTestId("admin-surface")).toBeInTheDocument();
		expect(screen.getByTestId("scroll-area")).toHaveClass("min-h-0", "flex-1");
		expect(screen.getByTestId("table")).toBeInTheDocument();
		expect(screen.getByText("header-row")).toBeInTheDocument();
		expect(screen.getByText("row:Alpha")).toBeInTheDocument();
		expect(screen.getByText("row:Beta")).toBeInTheDocument();
		expect(renderRow).toHaveBeenCalledTimes(2);
		expect(renderRow).toHaveBeenNthCalledWith(
			1,
			{ id: 1, name: "Alpha" },
			0,
			expect.any(Array),
		);
		expect(renderRow).toHaveBeenNthCalledWith(
			2,
			{ id: 2, name: "Beta" },
			1,
			expect.any(Array),
		);
	});
});
