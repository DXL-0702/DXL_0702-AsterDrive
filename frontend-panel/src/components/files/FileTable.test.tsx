import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileTable } from "@/components/files/FileTable";
import { DRAG_SOURCE_MIME } from "@/lib/constants";

const mockState = vi.hoisted(() => ({
	store: {
		selectedFileIds: new Set<number>(),
		selectedFolderIds: new Set<number>(),
		toggleFileSelection: vi.fn(),
		toggleFolderSelection: vi.fn(),
		selectAll: vi.fn(),
		clearSelection: vi.fn(),
		sortBy: "name",
		sortOrder: "asc",
		setSortBy: vi.fn(),
		setSortOrder: vi.fn(),
	},
	getInvalidInternalDropReason: vi.fn(),
	hasInternalDragData: vi.fn(),
	readInternalDragData: vi.fn(),
	setInternalDragPreview: vi.fn(),
	writeInternalDragData: vi.fn(),
}));

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => `translated:${key}`,
	}),
}));

vi.mock("@/stores/fileStore", () => ({
	useFileStore: (selector: (state: typeof mockState.store) => unknown) =>
		selector(mockState.store),
}));

vi.mock("@/components/files/FileContextMenu", () => ({
	FileContextMenu: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/files/FileTableCells", () => ({
	FileNameCell: ({ file }: { file: { name: string } }) => <td>{file.name}</td>,
	FolderNameCell: ({ folder }: { folder: { name: string } }) => (
		<td>{folder.name}</td>
	),
	FileSizeCell: ({ size }: { size: number }) => <td>{size}</td>,
	FolderSizeCell: () => <td>---</td>,
	UpdatedAtCell: ({ updatedAt }: { updatedAt: string }) => <td>{updatedAt}</td>,
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: ({ name }: { name: string }) => (
		<span data-testid="icon" data-name={name} />
	),
}));

vi.mock("@/components/ui/item-checkbox", () => ({
	ItemCheckbox: ({
		checked,
		onChange,
	}: {
		checked: boolean;
		onChange: () => void;
	}) => (
		<button
			type="button"
			data-testid="checkbox"
			aria-label={`checkbox-${checked ? "checked" : "unchecked"}`}
			onClick={onChange}
		/>
	),
}));

vi.mock("@/components/ui/table", () => ({
	Table: ({ children }: { children: React.ReactNode }) => (
		<table>{children}</table>
	),
	TableHeader: ({ children }: { children: React.ReactNode }) => (
		<thead>{children}</thead>
	),
	TableBody: ({ children }: { children: React.ReactNode }) => (
		<tbody>{children}</tbody>
	),
	TableRow: ({
		children,
		onClick,
		onDragStart,
		onDragOver,
		onDragLeave,
		onDrop,
		className,
		...props
	}: {
		children: React.ReactNode;
		onClick?: () => void;
		onDragStart?: (event: React.DragEvent<HTMLTableRowElement>) => void;
		onDragOver?: (event: React.DragEvent<HTMLTableRowElement>) => void;
		onDragLeave?: () => void;
		onDrop?: (event: React.DragEvent<HTMLTableRowElement>) => void;
		className?: string;
	}) => (
		<tr
			data-testid="row"
			className={className}
			onClick={onClick}
			onDragStart={onDragStart}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
			{...props}
		>
			{children}
		</tr>
	),
	TableHead: ({
		children,
		onClick,
		className,
	}: {
		children?: React.ReactNode;
		onClick?: () => void;
		className?: string;
	}) => (
		<th className={className} onClick={onClick}>
			{children}
		</th>
	),
	TableCell: ({
		children,
		onClick,
		className,
	}: {
		children?: React.ReactNode;
		onClick?: (event: React.MouseEvent<HTMLTableCellElement>) => void;
		className?: string;
	}) => (
		<td
			className={className}
			onClick={onClick}
			onKeyDown={(event) => {
				if (!onClick || (event.key !== "Enter" && event.key !== " ")) {
					return;
				}
				onClick(event as unknown as React.MouseEvent<HTMLTableCellElement>);
			}}
		>
			{children}
		</td>
	),
}));

vi.mock("@/lib/dragDrop", () => ({
	getInvalidInternalDropReason: (...args: unknown[]) =>
		mockState.getInvalidInternalDropReason(...args),
	hasInternalDragData: (...args: unknown[]) =>
		mockState.hasInternalDragData(...args),
	readInternalDragData: (...args: unknown[]) =>
		mockState.readInternalDragData(...args),
	setInternalDragPreview: (...args: unknown[]) =>
		mockState.setInternalDragPreview(...args),
	writeInternalDragData: (...args: unknown[]) =>
		mockState.writeInternalDragData(...args),
}));

const folder = {
	id: 1,
	name: "Docs",
	updated_at: "2026-01-01",
	is_locked: false,
};

const file = {
	id: 2,
	name: "report.pdf",
	size: 123,
	updated_at: "2026-01-02",
	is_locked: true,
};

describe("FileTable", () => {
	beforeEach(() => {
		mockState.store.selectedFileIds = new Set();
		mockState.store.selectedFolderIds = new Set();
		mockState.store.toggleFileSelection.mockReset();
		mockState.store.toggleFolderSelection.mockReset();
		mockState.store.selectAll.mockReset();
		mockState.store.clearSelection.mockReset();
		mockState.store.sortBy = "name";
		mockState.store.sortOrder = "asc";
		mockState.store.setSortBy.mockReset();
		mockState.store.setSortOrder.mockReset();
		mockState.getInvalidInternalDropReason.mockReset();
		mockState.hasInternalDragData.mockReset();
		mockState.readInternalDragData.mockReset();
		mockState.setInternalDragPreview.mockReset();
		mockState.writeInternalDragData.mockReset();
		mockState.hasInternalDragData.mockReturnValue(false);
		mockState.readInternalDragData.mockReturnValue(null);
		mockState.getInvalidInternalDropReason.mockReturnValue(null);
	});

	it("renders current sort state and updates sorting from header clicks", () => {
		mockState.store.sortBy = "name";
		mockState.store.sortOrder = "asc";

		render(
			<FileTable
				folders={[folder as never]}
				files={[file as never]}
				onFolderOpen={vi.fn()}
				onFileClick={vi.fn()}
				onShare={vi.fn()}
				onDownload={vi.fn()}
				onCopy={vi.fn()}
				onToggleLock={vi.fn()}
				onDelete={vi.fn()}
			/>,
		);

		expect(screen.getByText("translated:name")).toBeInTheDocument();
		expect(screen.getByText("translated:size")).toBeInTheDocument();
		expect(screen.getByText("translated:date")).toBeInTheDocument();
		expect(screen.getAllByTestId("icon")[0]).toHaveAttribute(
			"data-name",
			"SortAscending",
		);

		fireEvent.click(screen.getByText("translated:name"));
		fireEvent.click(screen.getByText("translated:size"));

		expect(mockState.store.setSortOrder).toHaveBeenCalledWith("desc");
		expect(mockState.store.setSortBy).toHaveBeenCalledWith("size");
	});

	it("toggles all selections depending on current state", () => {
		mockState.store.selectedFileIds = new Set([2]);
		mockState.store.selectedFolderIds = new Set([1]);

		const { rerender } = render(
			<FileTable
				folders={[folder as never]}
				files={[file as never]}
				onFolderOpen={vi.fn()}
				onFileClick={vi.fn()}
				onShare={vi.fn()}
				onDownload={vi.fn()}
				onCopy={vi.fn()}
				onToggleLock={vi.fn()}
				onDelete={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getAllByTestId("checkbox")[0]);
		expect(mockState.store.clearSelection).toHaveBeenCalledTimes(1);

		mockState.store.selectedFileIds = new Set();
		mockState.store.selectedFolderIds = new Set();
		rerender(
			<FileTable
				folders={[folder as never]}
				files={[file as never]}
				onFolderOpen={vi.fn()}
				onFileClick={vi.fn()}
				onShare={vi.fn()}
				onDownload={vi.fn()}
				onCopy={vi.fn()}
				onToggleLock={vi.fn()}
				onDelete={vi.fn()}
			/>,
		);

		fireEvent.click(screen.getAllByTestId("checkbox")[0]);
		expect(mockState.store.selectAll).toHaveBeenCalledTimes(1);
	});

	it("wires row clicks, selection toggles, and drag start metadata", () => {
		const onFolderOpen = vi.fn();
		const onFileClick = vi.fn();
		const dataTransfer = { types: [] } as unknown as DataTransfer;

		render(
			<FileTable
				folders={[folder as never]}
				files={[file as never]}
				onFolderOpen={onFolderOpen}
				onFileClick={onFileClick}
				onShare={vi.fn()}
				onDownload={vi.fn()}
				onCopy={vi.fn()}
				onToggleLock={vi.fn()}
				onDelete={vi.fn()}
			/>,
		);

		const rows = screen.getAllByTestId("row");
		fireEvent.click(rows[1]);
		fireEvent.click(rows[2]);
		fireEvent.click(screen.getAllByTestId("checkbox")[1]);
		fireEvent.click(screen.getAllByTestId("checkbox")[2]);
		fireEvent.dragStart(rows[1], { dataTransfer });

		expect(onFolderOpen).toHaveBeenCalledWith(1, "Docs");
		expect(onFileClick).toHaveBeenCalledWith(
			expect.objectContaining({ id: 2 }),
		);
		expect(mockState.store.toggleFolderSelection).toHaveBeenCalledWith(1);
		expect(mockState.store.toggleFileSelection).toHaveBeenCalledWith(2);
		expect(mockState.writeInternalDragData).toHaveBeenCalledWith(dataTransfer, {
			fileIds: [],
			folderIds: [1],
		});
		expect(mockState.setInternalDragPreview).toHaveBeenCalledWith(
			expect.anything(),
			{
				variant: "list-row",
				itemCount: 1,
			},
		);
	});

	it("accepts valid folder drops and ignores invalid ones", () => {
		const onMoveToFolder = vi.fn();
		const dataTransfer = {
			types: ["application/x-asterdrive-move"],
			dropEffect: "copy",
		} as unknown as DataTransfer;
		mockState.hasInternalDragData.mockReturnValue(true);
		mockState.readInternalDragData.mockReturnValue({
			fileIds: [2],
			folderIds: [3],
		});

		render(
			<FileTable
				folders={[folder as never]}
				files={[]}
				breadcrumbPathIds={[10]}
				onFolderOpen={vi.fn()}
				onFileClick={vi.fn()}
				onShare={vi.fn()}
				onDownload={vi.fn()}
				onCopy={vi.fn()}
				onToggleLock={vi.fn()}
				onDelete={vi.fn()}
				onMoveToFolder={onMoveToFolder}
			/>,
		);

		const folderRow = screen.getAllByTestId("row")[1];

		fireEvent.dragOver(folderRow, { dataTransfer });
		expect(dataTransfer.dropEffect).toBe("move");
		expect(folderRow).toHaveClass("ring-2", "ring-primary");

		fireEvent.drop(folderRow, { dataTransfer });
		expect(mockState.getInvalidInternalDropReason).toHaveBeenCalledWith(
			{ fileIds: [2], folderIds: [3] },
			1,
			[10, 1],
		);
		expect(onMoveToFolder).toHaveBeenCalledWith([2], [3], 1);

		mockState.getInvalidInternalDropReason.mockReturnValueOnce("descendant");
		fireEvent.drop(folderRow, { dataTransfer });
		expect(onMoveToFolder).toHaveBeenCalledTimes(1);

		const sourceDataTransfer = {
			types: [DRAG_SOURCE_MIME],
		} as unknown as DataTransfer;
		fireEvent.dragOver(folderRow, { dataTransfer: sourceDataTransfer });
		fireEvent.drop(folderRow, { dataTransfer: sourceDataTransfer });
		expect(onMoveToFolder).toHaveBeenCalledTimes(1);
	});
});
