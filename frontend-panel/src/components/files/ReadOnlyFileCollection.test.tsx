import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReadOnlyFileCollection } from "@/components/files/ReadOnlyFileCollection";

vi.mock("@/components/common/EmptyState", () => ({
	EmptyState: ({
		title,
		description,
	}: {
		title: string;
		description?: string;
	}) => (
		<div>
			<div>{title}</div>
			<div>{description}</div>
		</div>
	),
}));

vi.mock("@/components/files/ReadOnlyFileGrid", () => ({
	ReadOnlyFileGrid: ({
		folders,
		files,
	}: {
		folders: Array<{ id: number }>;
		files: Array<{ id: number }>;
	}) => (
		<div
			data-testid="grid"
			data-folders={folders.length}
			data-files={files.length}
		/>
	),
}));

vi.mock("@/components/files/ReadOnlyFileTable", () => ({
	ReadOnlyFileTable: ({
		folders,
		files,
	}: {
		folders: Array<{ id: number }>;
		files: Array<{ id: number }>;
	}) => (
		<div
			data-testid="table"
			data-folders={folders.length}
			data-files={files.length}
		/>
	),
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: () => <span data-testid="icon" />,
}));

describe("ReadOnlyFileCollection", () => {
	it("renders the empty state when there are no folders or files", () => {
		render(
			<ReadOnlyFileCollection
				folders={[]}
				files={[]}
				viewMode="grid"
				emptyTitle="Nothing here"
				emptyDescription="Try another folder."
			/>,
		);

		expect(screen.getByText("Nothing here")).toBeInTheDocument();
		expect(screen.getByText("Try another folder.")).toBeInTheDocument();
		expect(screen.queryByTestId("grid")).not.toBeInTheDocument();
	});

	it("renders the grid view for non-empty grid collections", () => {
		render(
			<ReadOnlyFileCollection
				folders={[{ id: 1 } as never]}
				files={[{ id: 2 } as never]}
				viewMode="grid"
				emptyTitle="Nothing here"
				emptyDescription="Try another folder."
			/>,
		);

		expect(screen.getByTestId("grid")).toHaveAttribute("data-folders", "1");
		expect(screen.getByTestId("grid")).toHaveAttribute("data-files", "1");
		expect(screen.queryByTestId("table")).not.toBeInTheDocument();
	});

	it("renders the table view for non-empty list collections", () => {
		render(
			<ReadOnlyFileCollection
				folders={[{ id: 1 } as never]}
				files={[{ id: 2 } as never]}
				viewMode="list"
				emptyTitle="Nothing here"
				emptyDescription="Try another folder."
			/>,
		);

		expect(screen.getByTestId("table")).toHaveAttribute("data-folders", "1");
		expect(screen.getByTestId("table")).toHaveAttribute("data-files", "1");
		expect(screen.queryByTestId("grid")).not.toBeInTheDocument();
	});
});
