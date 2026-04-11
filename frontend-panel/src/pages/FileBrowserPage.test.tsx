import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FILE_BROWSER_FEEDBACK_DURATION_MS } from "@/lib/constants";
import FileBrowserPage from "@/pages/FileBrowserPage";

const mockState = vi.hoisted(() => ({
	batchDelete: vi.fn(),
	copyFile: vi.fn(),
	copyFolder: vi.fn(),
	streamArchiveDownload: vi.fn(),
	dispatchEvent: vi.fn(),
	fileGridProps: null as Record<string, unknown> | null,
	fileTableProps: null as Record<string, unknown> | null,
	formatBatchToast: vi.fn(),
	handleApiError: vi.fn(),
	navigate: vi.fn(),
	params: { folderId: "12" as string | undefined },
	previewAppStore: {
		isLoaded: false,
		load: vi.fn(async () => {}),
	},
	readInternalDragData: vi.fn(),
	refreshUser: vi.fn(),
	searchParams: new URLSearchParams("name=Projects"),
	setFileLock: vi.fn(),
	setFolderLock: vi.fn(),
	store: {
		breadcrumb: [
			{ id: null, name: "Root" },
			{ id: 12, name: "Projects" },
		] as Array<{ id: number | null; name: string }>,
		clearSelection: vi.fn(),
		currentFolderId: 12 as number | null,
		deleteFile: vi.fn(),
		deleteFolder: vi.fn(),
		error: null as string | null,
		files: [] as Array<Record<string, unknown>>,
		folders: [] as Array<Record<string, unknown>>,
		hasMoreFiles: vi.fn(),
		loadMoreFiles: vi.fn(),
		loading: false,
		loadingMore: false,
		moveToFolder: vi.fn(),
		navigateTo: vi.fn(),
		refresh: vi.fn(),
		search: vi.fn(),
		searchFiles: [] as Array<Record<string, unknown>>,
		searchFolders: [] as Array<Record<string, unknown>>,
		searchQuery: null as string | null,
		browserOpenMode: "single_click" as "single_click" | "double_click",
		setSortBy: vi.fn(),
		setSortOrder: vi.fn(),
		setViewMode: vi.fn(),
		sortBy: "name",
		sortOrder: "asc",
		viewMode: "grid" as "grid" | "list",
	},
	toastError: vi.fn(),
	toastSuccess: vi.fn(),
	useKeyboardShortcuts: vi.fn(),
}));

class MockIntersectionObserver {
	static instances: MockIntersectionObserver[] = [];

	disconnect = vi.fn();
	observe = vi.fn();
	root = null;
	rootMargin = "";
	thresholds: number[] = [];
	unobserve = vi.fn();

	private readonly callback: IntersectionObserverCallback;

	constructor(
		callback: IntersectionObserverCallback,
		options: IntersectionObserverInit = {},
	) {
		this.callback = callback;
		this.root = (options.root as Element | Document | null | undefined) ?? null;
		this.rootMargin = options.rootMargin ?? "";
		this.thresholds = Array.isArray(options.threshold)
			? options.threshold
			: options.threshold !== undefined
				? [options.threshold]
				: [];
		MockIntersectionObserver.instances.push(this);
	}

	takeRecords() {
		return [];
	}

	trigger(target: Element, isIntersecting = true) {
		this.callback(
			[
				{
					boundingClientRect: DOMRect.fromRect(),
					intersectionRatio: isIntersecting ? 1 : 0,
					intersectionRect: DOMRect.fromRect(),
					isIntersecting,
					rootBounds: null,
					target,
					time: 0,
				} as IntersectionObserverEntry,
			],
			this as unknown as IntersectionObserver,
		);
	}

	static reset() {
		MockIntersectionObserver.instances = [];
	}
}

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock("react-router-dom", () => ({
	useNavigate: () => mockState.navigate,
	useParams: () => mockState.params,
	useSearchParams: () => [mockState.searchParams, vi.fn()],
}));

vi.mock("sonner", () => ({
	toast: {
		error: (...args: unknown[]) => mockState.toastError(...args),
		success: (...args: unknown[]) => mockState.toastSuccess(...args),
	},
}));

vi.mock("@/stores/previewAppStore", () => ({
	usePreviewAppStore: (
		selector: (state: typeof mockState.previewAppStore) => unknown,
	) => selector(mockState.previewAppStore),
}));

vi.mock("@/components/common/BatchActionBar", () => ({
	BatchActionBar: () => <div>batch-action-bar</div>,
}));

vi.mock("@/components/common/EmptyState", () => ({
	EmptyState: ({
		description,
		title,
	}: {
		description?: string;
		title: string;
	}) => (
		<div>
			<div>{title}</div>
			<div>{description}</div>
		</div>
	),
}));

vi.mock("@/components/common/SkeletonFileGrid", () => ({
	SkeletonFileGrid: () => <div>skeleton-grid</div>,
}));

vi.mock("@/components/common/SkeletonFileTable", () => ({
	SkeletonFileTable: () => <div>skeleton-table</div>,
}));

vi.mock("@/components/common/SortMenu", () => ({
	SortMenu: ({
		onSortBy,
		onSortOrder,
		sortBy,
		sortOrder,
	}: {
		onSortBy: (value: string) => void;
		onSortOrder: (value: string) => void;
		sortBy: string;
		sortOrder: string;
	}) => (
		<div>
			<div>{`sort:${sortBy}:${sortOrder}`}</div>
			<button type="button" onClick={() => onSortBy("updated_at")}>
				sort-by-updated
			</button>
			<button type="button" onClick={() => onSortOrder("desc")}>
				sort-order-desc
			</button>
		</div>
	),
}));

vi.mock("@/components/common/ToolbarBar", () => ({
	ToolbarBar: ({
		left,
		right,
	}: {
		left?: React.ReactNode;
		right?: React.ReactNode;
	}) => (
		<div>
			<div>{left}</div>
			<div>{right}</div>
		</div>
	),
}));

vi.mock("@/components/common/ViewToggle", () => ({
	ViewToggle: ({
		onChange,
		value,
	}: {
		onChange: (value: "grid" | "list") => void;
		value: "grid" | "list";
	}) => (
		<div>
			<div>{`view:${value}`}</div>
			<button type="button" onClick={() => onChange("grid")}>
				view-grid
			</button>
			<button type="button" onClick={() => onChange("list")}>
				view-list
			</button>
		</div>
	),
}));

vi.mock("@/components/files/FileGrid", () => ({
	FileGrid: (props: Record<string, unknown>) => {
		mockState.fileGridProps = props;
		const folders = props.folders as Array<{ id: number; name: string }>;
		const files = props.files as Array<{ id: number; name: string }>;

		return (
			<div>
				<div>{`grid:${folders.length}:${files.length}`}</div>
				<button
					type="button"
					onClick={() =>
						(props.onFolderOpen as (id: number, name: string) => void)(
							5,
							"Docs A",
						)
					}
				>
					open-folder
				</button>
				<button
					type="button"
					onClick={() =>
						(props.onFileClick as (file: { id: number; name: string }) => void)(
							{
								id: 3,
								name: "report.pdf",
							},
						)
					}
				>
					open-file
				</button>
				<button
					type="button"
					onClick={() =>
						(props.onFileOpen as (file: { id: number; name: string }) => void)({
							id: 3,
							name: "report.pdf",
						})
					}
				>
					open-file-direct
				</button>
				<button
					type="button"
					onClick={() =>
						(
							props.onFileChooseOpenMethod as (file: {
								id: number;
								name: string;
							}) => void
						)({
							id: 3,
							name: "report.pdf",
						})
					}
				>
					open-file-picker
				</button>
				<button
					type="button"
					onClick={() =>
						(props.onCopy as (type: "file" | "folder", id: number) => void)(
							"file",
							9,
						)
					}
				>
					copy-file
				</button>
				<button
					type="button"
					onClick={() =>
						(props.onCopy as (type: "file" | "folder", id: number) => void)(
							"folder",
							10,
						)
					}
				>
					copy-folder
				</button>
				<button
					type="button"
					onClick={() =>
						(
							props.onShare as (target: {
								fileId?: number;
								folderId?: number;
								name: string;
								initialMode?: "page" | "direct";
							}) => void
						)({
							folderId: 5,
							name: "Docs A",
							initialMode: "page",
						})
					}
				>
					share-folder
				</button>
				<button
					type="button"
					onClick={() =>
						(
							props.onShare as (target: {
								fileId?: number;
								folderId?: number;
								name: string;
								initialMode?: "page" | "direct";
							}) => void
						)({
							fileId: 3,
							name: "report.pdf",
							initialMode: "page",
						})
					}
				>
					share-file-page
				</button>
				<button
					type="button"
					onClick={() =>
						(
							props.onShare as (target: {
								fileId?: number;
								folderId?: number;
								name: string;
								initialMode?: "page" | "direct";
							}) => void
						)({
							fileId: 3,
							name: "report.pdf",
							initialMode: "direct",
						})
					}
				>
					share-file-direct
				</button>
				<button
					type="button"
					onClick={() =>
						(
							props.onMoveToFolder as (
								fileIds: number[],
								folderIds: number[],
								targetFolderId: number | null,
							) => Promise<void>
						)([7], [8], 20)
					}
				>
					move-selection
				</button>
				<button
					type="button"
					onClick={() =>
						(props.onArchiveDownload as (folderId: number) => void)(5)
					}
				>
					archive-folder
				</button>
			</div>
		);
	},
}));

vi.mock("@/components/files/FileTable", () => ({
	FileTable: (props: Record<string, unknown>) => {
		mockState.fileTableProps = props;
		return <div>table-view</div>;
	},
}));

vi.mock("@/components/files/BatchTargetFolderDialog", () => ({
	BatchTargetFolderDialog: ({
		mode,
		onConfirm,
		open,
	}: {
		mode: string;
		onConfirm: (targetFolderId: number | null) => Promise<void>;
		open: boolean;
	}) =>
		open ? (
			<div>
				<div>{`batch-dialog:${mode}`}</div>
				<button type="button" onClick={() => void onConfirm(20)}>
					confirm-batch-dialog
				</button>
			</div>
		) : null,
}));

vi.mock("@/components/files/CreateFileDialog", () => ({
	CreateFileDialog: ({ open }: { open: boolean }) =>
		open ? <div>create-file-dialog</div> : null,
}));

vi.mock("@/components/files/CreateFolderDialog", () => ({
	CreateFolderDialog: ({ open }: { open: boolean }) =>
		open ? <div>create-folder-dialog</div> : null,
}));

vi.mock("@/components/files/FileInfoDialog", () => ({
	FileInfoDialog: ({
		file,
		folder,
		open,
	}: {
		file?: { name: string };
		folder?: { name: string };
		open: boolean;
	}) => (open ? <div>{`info:${file?.name ?? folder?.name ?? ""}`}</div> : null),
}));

vi.mock("@/components/files/FilePreview", () => ({
	FilePreview: ({
		file,
		openMode,
		onClose,
	}: {
		file: { name: string };
		openMode?: string;
		onClose: () => void;
	}) => (
		<div>
			<div>{`preview:${file.name}:${openMode ?? "auto"}`}</div>
			<button type="button" onClick={onClose}>
				close-preview
			</button>
		</div>
	),
}));

vi.mock("@/components/files/RenameDialog", () => ({
	RenameDialog: ({
		currentName,
		open,
	}: {
		currentName: string;
		open: boolean;
	}) => (open ? <div>{`rename:${currentName}`}</div> : null),
}));

vi.mock("@/components/files/ShareDialog", () => ({
	ShareDialog: ({
		name,
		open,
		initialMode,
	}: {
		name: string;
		open: boolean;
		initialMode?: "page" | "direct";
	}) => (open ? <div>{`share:${name}:${initialMode ?? "page"}`}</div> : null),
}));

vi.mock("@/components/files/UploadArea", () => ({
	UploadArea: forwardRef(function MockUploadArea(
		{ children }: { children: React.ReactNode },
		ref: React.ForwardedRef<{
			triggerFileUpload: () => void;
			triggerFolderUpload: () => void;
		}>,
	) {
		useImperativeHandle(ref, () => ({
			triggerFileUpload: vi.fn(),
			triggerFolderUpload: vi.fn(),
		}));
		return <div>{children}</div>;
	}),
}));

vi.mock("@/components/files/VersionHistoryDialog", () => ({
	VersionHistoryDialog: ({ open }: { open: boolean }) =>
		open ? <div>version-history-dialog</div> : null,
}));

vi.mock("@/components/layout/AppLayout", () => ({
	AppLayout: ({
		children,
		onMoveToFolder,
		onTrashDrop,
	}: {
		children: React.ReactNode;
		onMoveToFolder?: (
			fileIds: number[],
			folderIds: number[],
			targetFolderId: number | null,
		) => Promise<void>;
		onTrashDrop?: (data: {
			fileIds: number[];
			folderIds: number[];
		}) => Promise<void>;
	}) => (
		<div>
			<button type="button" onClick={() => void onMoveToFolder?.([1], [2], 30)}>
				layout-move
			</button>
			<button
				type="button"
				onClick={() => void onTrashDrop?.({ fileIds: [1], folderIds: [2] })}
			>
				layout-trash
			</button>
			<div>{children}</div>
		</div>
	),
}));

vi.mock("@/components/ui/breadcrumb", () => ({
	Breadcrumb: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	BreadcrumbItem: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	BreadcrumbLink: ({
		children,
		className,
		onClick,
		onDragOver,
		onDragLeave,
		onDrop,
	}: {
		children: React.ReactNode;
		className?: string;
		onClick?: () => void;
		onDragOver?: (event: React.DragEvent<HTMLButtonElement>) => void;
		onDragLeave?: (event: React.DragEvent<HTMLButtonElement>) => void;
		onDrop?: (event: React.DragEvent<HTMLButtonElement>) => void;
	}) => (
		<button
			type="button"
			className={className}
			onClick={onClick}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
		>
			{children}
		</button>
	),
	BreadcrumbList: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	BreadcrumbPage: ({ children }: { children: React.ReactNode }) => (
		<span>{children}</span>
	),
	BreadcrumbSeparator: ({ children }: { children?: React.ReactNode }) => (
		<span>{children ?? "/"}</span>
	),
}));

vi.mock("@/components/ui/context-menu", () => ({
	ContextMenu: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	ContextMenuContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	ContextMenuItem: ({
		children,
		disabled,
		onClick,
	}: {
		children: React.ReactNode;
		disabled?: boolean;
		onClick?: () => void;
	}) => (
		<button type="button" disabled={disabled} onClick={onClick}>
			{children}
		</button>
	),
	ContextMenuSeparator: () => <hr data-testid="context-menu-separator" />,
	ContextMenuTrigger: ({
		children,
		className,
	}: {
		children: React.ReactNode;
		className?: string;
	}) => <div className={className}>{children}</div>,
}));

vi.mock("@/components/ui/icon", () => ({
	Icon: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
	ScrollArea: forwardRef(function MockScrollArea(
		{
			children,
			className,
		}: {
			children: React.ReactNode;
			className?: string;
		},
		ref: React.ForwardedRef<HTMLDivElement>,
	) {
		return (
			<div ref={ref} className={className}>
				{children}
			</div>
		);
	}),
}));

vi.mock("@/hooks/useApiError", () => ({
	handleApiError: (...args: unknown[]) => mockState.handleApiError(...args),
}));

vi.mock("@/hooks/useKeyboardShortcuts", () => ({
	useKeyboardShortcuts: () => mockState.useKeyboardShortcuts(),
}));

vi.mock("@/lib/dragDrop", () => ({
	getInvalidInternalDropReason: vi.fn(() => null),
	hasInternalDragData: vi.fn(() => false),
	readInternalDragData: (...args: unknown[]) =>
		mockState.readInternalDragData(...args),
}));

vi.mock("@/lib/formatBatchToast", () => ({
	formatBatchToast: (...args: unknown[]) => mockState.formatBatchToast(...args),
}));

vi.mock("@/lib/utils", () => ({
	cn: (...values: Array<string | false | null | undefined>) =>
		values.filter(Boolean).join(" "),
}));

vi.mock("@/services/batchService", () => ({
	batchService: {
		batchDelete: (...args: unknown[]) => mockState.batchDelete(...args),
		streamArchiveDownload: (...args: unknown[]) =>
			mockState.streamArchiveDownload(...args),
	},
}));

vi.mock("@/services/fileService", () => ({
	fileService: {
		copyFile: (...args: unknown[]) => mockState.copyFile(...args),
		copyFolder: (...args: unknown[]) => mockState.copyFolder(...args),
		downloadUrl: (id: number) => `https://download/${id}`,
		setFileLock: (...args: unknown[]) => mockState.setFileLock(...args),
		setFolderLock: (...args: unknown[]) => mockState.setFolderLock(...args),
	},
}));

vi.mock("@/stores/authStore", () => {
	const useAuthStore = <T,>(
		selector: (state: { refreshUser: () => Promise<void> }) => T,
	) =>
		selector({
			refreshUser: mockState.refreshUser,
		});

	useAuthStore.getState = () => ({
		refreshUser: mockState.refreshUser,
	});

	return { useAuthStore };
});

vi.mock("@/stores/fileStore", () => {
	const useFileStore = <T,>(selector: (state: typeof mockState.store) => T) =>
		selector(mockState.store);

	useFileStore.getState = () => mockState.store;

	return { useFileStore };
});

function createFolder(overrides: Record<string, unknown> = {}) {
	return {
		created_at: "2026-03-28T00:00:00Z",
		id: 5,
		is_locked: false,
		name: "Docs",
		updated_at: "2026-03-28T00:00:00Z",
		...overrides,
	};
}

function createFile(overrides: Record<string, unknown> = {}) {
	return {
		created_at: "2026-03-28T00:00:00Z",
		id: 3,
		is_locked: false,
		mime_type: "text/plain",
		name: "notes.txt",
		size: 10,
		updated_at: "2026-03-28T00:00:00Z",
		...overrides,
	};
}

describe("FileBrowserPage", () => {
	beforeEach(() => {
		MockIntersectionObserver.reset();
		mockState.batchDelete.mockReset();
		mockState.copyFile.mockReset();
		mockState.copyFolder.mockReset();
		mockState.streamArchiveDownload.mockReset();
		mockState.dispatchEvent.mockReset();
		mockState.fileGridProps = null;
		mockState.fileTableProps = null;
		mockState.formatBatchToast.mockReset();
		mockState.handleApiError.mockReset();
		mockState.navigate.mockReset();
		mockState.previewAppStore.load.mockReset();
		mockState.readInternalDragData.mockReset();
		mockState.refreshUser.mockReset();
		mockState.setFileLock.mockReset();
		mockState.setFolderLock.mockReset();
		mockState.store.clearSelection.mockReset();
		mockState.store.deleteFile.mockReset();
		mockState.store.deleteFolder.mockReset();
		mockState.store.hasMoreFiles.mockReset();
		mockState.store.loadMoreFiles.mockReset();
		mockState.store.moveToFolder.mockReset();
		mockState.store.navigateTo.mockReset();
		mockState.store.refresh.mockReset();
		mockState.store.search.mockReset();
		mockState.store.setSortBy.mockReset();
		mockState.store.setSortOrder.mockReset();
		mockState.store.setViewMode.mockReset();
		mockState.toastError.mockReset();
		mockState.toastSuccess.mockReset();
		mockState.useKeyboardShortcuts.mockReset();

		mockState.params = { folderId: "12" };
		mockState.previewAppStore.isLoaded = false;
		mockState.previewAppStore.load.mockResolvedValue(undefined);
		mockState.searchParams = new URLSearchParams("name=Projects");
		mockState.store.browserOpenMode = "single_click";
		mockState.store.breadcrumb = [
			{ id: null, name: "Root" },
			{ id: 12, name: "Projects" },
		];
		mockState.store.currentFolderId = 12;
		mockState.store.error = null;
		mockState.store.files = [createFile()];
		mockState.store.folders = [createFolder()];
		mockState.store.hasMoreFiles.mockReturnValue(false);
		mockState.store.loading = false;
		mockState.store.loadingMore = false;
		mockState.store.moveToFolder.mockResolvedValue({ ok: true });
		mockState.store.navigateTo.mockResolvedValue(undefined);
		mockState.store.refresh.mockResolvedValue(undefined);
		mockState.store.search.mockResolvedValue(undefined);
		mockState.store.searchFiles = [];
		mockState.store.searchFolders = [];
		mockState.store.searchQuery = null;
		mockState.store.sortBy = "name";
		mockState.store.sortOrder = "asc";
		mockState.store.viewMode = "grid";

		mockState.batchDelete.mockResolvedValue({ ok: true });
		mockState.copyFile.mockResolvedValue(undefined);
		mockState.copyFolder.mockResolvedValue(undefined);
		mockState.formatBatchToast.mockImplementation((_t, action: string) => ({
			description: `${action}:desc`,
			title: `${action}:ok`,
			variant: "success",
		}));
		mockState.refreshUser.mockResolvedValue(undefined);
		mockState.readInternalDragData.mockReturnValue(null);

		vi.spyOn(document, "dispatchEvent").mockImplementation(
			(...args: [Event]) => {
				mockState.dispatchEvent(...args);
				return true;
			},
		);
	});

	it("navigates on mount, renders search results in grid view, and wires sort and view controls", async () => {
		mockState.store.searchQuery = "budget";
		mockState.store.searchFolders = [createFolder({ id: 8, name: "Reports" })];
		mockState.store.searchFiles = [createFile({ id: 9, name: "budget.csv" })];

		render(<FileBrowserPage />);

		await waitFor(() => {
			expect(mockState.store.navigateTo).toHaveBeenCalledWith(12, "Projects");
		});
		expect(mockState.previewAppStore.load).toHaveBeenCalledTimes(1);
		expect(screen.getByText(/core:search:\s*"budget"/)).toBeInTheDocument();
		expect(screen.getByText("grid:1:1")).toBeInTheDocument();
		expect(screen.getByText("view:grid")).toBeInTheDocument();
		expect(screen.getByText("sort:name:asc")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "view-list" }));
		fireEvent.click(screen.getByRole("button", { name: "sort-by-updated" }));
		fireEvent.click(screen.getByRole("button", { name: "sort-order-desc" }));

		expect(mockState.store.setViewMode).toHaveBeenCalledWith("list");
		expect(mockState.store.setSortBy).toHaveBeenCalledWith("updated_at");
		expect(mockState.store.setSortOrder).toHaveBeenCalledWith("desc");
	});

	it("refreshes and navigates from breadcrumb and folder open actions, and opens the preview", async () => {
		render(<FileBrowserPage />);

		await waitFor(() => {
			expect(mockState.store.navigateTo).toHaveBeenCalledWith(12, "Projects");
		});

		fireEvent.click(screen.getByTitle("core:refresh"));
		const contextRefreshButton = screen
			.getByText("core:refresh")
			.closest("button");
		expect(contextRefreshButton).toBeTruthy();
		if (!contextRefreshButton) {
			throw new Error("missing context menu refresh button");
		}
		fireEvent.click(contextRefreshButton);
		fireEvent.click(screen.getByRole("button", { name: "Root" }));
		fireEvent.click(screen.getByRole("button", { name: "open-folder" }));
		fireEvent.click(screen.getByRole("button", { name: "open-file" }));

		expect(mockState.store.refresh).toHaveBeenCalledTimes(2);
		expect(mockState.navigate).toHaveBeenCalledWith("/");
		expect(mockState.navigate).toHaveBeenCalledWith("/folder/5?name=Docs%20A");
		expect(
			await screen.findByText("preview:report.pdf:auto"),
		).toBeInTheDocument();
	});

	it("groups page context menu actions with separators", () => {
		render(<FileBrowserPage />);

		expect(screen.getAllByTestId("context-menu-separator")).toHaveLength(2);
	});

	it("copies files and folders through the batch target dialog and refreshes after success", async () => {
		render(<FileBrowserPage />);

		fireEvent.click(screen.getByRole("button", { name: "copy-file" }));

		expect(await screen.findByText("batch-dialog:copy")).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole("button", { name: "confirm-batch-dialog" }),
		);

		await waitFor(() => {
			expect(mockState.copyFile).toHaveBeenCalledWith(9, 20);
		});
		expect(mockState.toastSuccess).toHaveBeenCalledWith("copy_success");
		expect(mockState.store.refresh).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByRole("button", { name: "copy-folder" }));
		fireEvent.click(
			screen.getByRole("button", { name: "confirm-batch-dialog" }),
		);

		await waitFor(() => {
			expect(mockState.copyFolder).toHaveBeenCalledWith(10, 20);
		});
		expect(mockState.store.refresh).toHaveBeenCalledTimes(2);
	});

	it("opens the share dialog with the mode implied by the chosen menu entry", async () => {
		render(<FileBrowserPage />);

		fireEvent.click(screen.getByRole("button", { name: "share-folder" }));
		expect(await screen.findByText("share:Docs A:page")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "share-file-page" }));
		expect(
			await screen.findByText("share:report.pdf:page"),
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "share-file-direct" }));
		expect(
			await screen.findByText("share:report.pdf:direct"),
		).toBeInTheDocument();
	});

	it("starts a streamed archive download from a folder action", async () => {
		render(<FileBrowserPage />);

		fireEvent.click(screen.getByRole("button", { name: "archive-folder" }));

		expect(mockState.streamArchiveDownload).toHaveBeenCalledWith([], [5]);
		expect(mockState.toastSuccess).not.toHaveBeenCalled();
	});

	it("re-observes infinite scroll when pagination becomes available after the first render", async () => {
		const originalIntersectionObserver = window.IntersectionObserver;
		Object.defineProperty(window, "IntersectionObserver", {
			writable: true,
			value: MockIntersectionObserver,
		});

		try {
			mockState.store.hasMoreFiles.mockReturnValue(false);

			const { container, rerender } = render(<FileBrowserPage />);
			expect(MockIntersectionObserver.instances).toHaveLength(0);

			mockState.store.hasMoreFiles.mockReturnValue(true);
			rerender(<FileBrowserPage />);

			await waitFor(() => {
				expect(MockIntersectionObserver.instances).toHaveLength(1);
			});

			const observer = MockIntersectionObserver.instances[0];
			const target = observer?.observe.mock.calls[0]?.[0] as
				| Element
				| undefined;
			expect(target).toBeInstanceOf(HTMLElement);

			if (observer && target) {
				observer.trigger(target);
			}

			await waitFor(() => {
				expect(mockState.store.loadMoreFiles).toHaveBeenCalledTimes(1);
			});
			expect(container.querySelector(".flex.justify-center.py-4")).toBeTruthy();
		} finally {
			Object.defineProperty(window, "IntersectionObserver", {
				writable: true,
				value: originalIntersectionObserver,
			});
		}
	});

	it("moves items, dispatches folder-tree updates, and shows the formatted move toast", async () => {
		render(<FileBrowserPage />);

		vi.useFakeTimers();

		fireEvent.click(screen.getByRole("button", { name: "move-selection" }));

		await Promise.resolve();
		await Promise.resolve();
		expect(mockState.store.moveToFolder).toHaveBeenCalledWith([7], [8], 20);
		await vi.advanceTimersByTimeAsync(FILE_BROWSER_FEEDBACK_DURATION_MS);
		await Promise.resolve();
		await Promise.resolve();
		vi.useRealTimers();

		expect(mockState.dispatchEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "folder-tree-move",
			}),
		);
		expect(mockState.toastSuccess).toHaveBeenCalledWith("move:ok", {
			description: "move:desc",
		});
	});

	it("handles trash drops via the layout and refreshes selection and user state", async () => {
		render(<FileBrowserPage />);

		vi.useFakeTimers();

		fireEvent.click(screen.getByRole("button", { name: "layout-trash" }));

		await Promise.resolve();
		await Promise.resolve();
		expect(mockState.batchDelete).toHaveBeenCalledWith([1], [2]);
		await vi.advanceTimersByTimeAsync(FILE_BROWSER_FEEDBACK_DURATION_MS);
		await Promise.resolve();
		await Promise.resolve();
		vi.useRealTimers();

		expect(mockState.store.clearSelection).toHaveBeenCalledTimes(1);
		expect(mockState.store.refresh).toHaveBeenCalledTimes(1);
		expect(mockState.refreshUser).toHaveBeenCalledTimes(1);
		expect(mockState.toastSuccess).toHaveBeenCalledWith("delete:ok", {
			description: "delete:desc",
		});
	});
});
