import {
	type DragEvent,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
	useLocation,
	useNavigate,
	useParams,
	useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { BatchActionBar } from "@/components/common/BatchActionBar";
import type { FileBrowserContextValue } from "@/components/files/FileBrowserContext";
import { FilePreview } from "@/components/files/FilePreview";
import {
	UploadArea,
	type UploadAreaHandle,
} from "@/components/files/UploadArea";
import { AppLayout } from "@/components/layout/AppLayout";
import { handleApiError } from "@/hooks/useApiError";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
	DRAG_SOURCE_MIME,
	FILE_BROWSER_FEEDBACK_DURATION_MS,
} from "@/lib/constants";
import {
	getInvalidInternalDropReason,
	hasInternalDragData,
	type InternalDragData,
	readInternalDragData,
} from "@/lib/dragDrop";
import { formatBatchToast } from "@/lib/formatBatchToast";
import { runWhenIdle } from "@/lib/idleTask";
import { workspaceFolderPath } from "@/lib/workspace";
import { FileBrowserToolbar } from "@/pages/file-browser/FileBrowserToolbar";
import { FileBrowserWorkspace } from "@/pages/file-browser/FileBrowserWorkspace";
import {
	ArchiveTaskNameDialog,
	BatchTargetFolderDialog,
	CreateFileDialog,
	CreateFolderDialog,
	FILE_BROWSER_LAZY_PRELOADERS,
	RenameDialog,
	ShareDialog,
	VersionHistoryDialog,
} from "@/pages/file-browser/fileBrowserLazy";
import type {
	FileBrowserArchiveTaskTarget,
	FileBrowserCopyTarget,
	FileBrowserInfoTarget,
	FileBrowserMoveTarget,
	FileBrowserPreviewState,
	FileBrowserRenameTarget,
	FileBrowserShareTarget,
	FileBrowserVersionTarget,
} from "@/pages/file-browser/types";
import { useMediaQuery } from "@/pages/file-browser/useMediaQuery";
import { batchService } from "@/services/batchService";
import { fileService } from "@/services/fileService";
import { useAuthStore } from "@/stores/authStore";
import { useFileStore } from "@/stores/fileStore";
import { usePreviewAppStore } from "@/stores/previewAppStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { FileInfo, FileListItem, FolderListItem } from "@/types/api";

interface FileBrowserLocationState {
	searchPreviewFile?: FileListItem;
}

function buildArchiveTimestamp() {
	const now = new Date();
	const pad = (value: number) => value.toString().padStart(2, "0");
	return (
		[
			now.getUTCFullYear().toString(),
			pad(now.getUTCMonth() + 1),
			pad(now.getUTCDate()),
		].join("") +
		"-" +
		[
			pad(now.getUTCHours()),
			pad(now.getUTCMinutes()),
			pad(now.getUTCSeconds()),
		].join("")
	);
}

function ensureZipSuffix(name: string) {
	return name.toLowerCase().endsWith(".zip") ? name : `${name}.zip`;
}

function stripZipSuffix(name: string) {
	return name.toLowerCase().endsWith(".zip") && name.length > 4
		? name.slice(0, -4)
		: "";
}

function defaultArchiveCompressName(
	fileIds: number[],
	folderIds: number[],
	files: FileListItem[],
	folders: FolderListItem[],
) {
	if (folderIds.length === 1 && fileIds.length === 0) {
		const folder = folders.find((entry) => entry.id === folderIds[0]);
		if (folder) {
			return ensureZipSuffix(folder.name);
		}
	}

	if (fileIds.length === 1 && folderIds.length === 0) {
		const file = files.find((entry) => entry.id === fileIds[0]);
		if (file) {
			return ensureZipSuffix(file.name);
		}
	}

	return `archive-${buildArchiveTimestamp()}.zip`;
}

function defaultArchiveExtractFolderName(sourceFileName: string) {
	const stripped = stripZipSuffix(sourceFileName);
	if (stripped) {
		return stripped;
	}
	return `extracted-${buildArchiveTimestamp()}`;
}

export default function FileBrowserPage() {
	const { t } = useTranslation(["files", "tasks"]);
	const location = useLocation();
	const navigate = useNavigate();
	const workspace = useWorkspaceStore((s) => s.workspace);
	const params = useParams<{ folderId?: string }>();
	const [searchParams] = useSearchParams();
	const folderId = params.folderId ? Number(params.folderId) : null;
	const folderName = searchParams.get("name") ?? undefined;

	const navigateTo = useFileStore((s) => s.navigateTo);
	const refresh = useFileStore((s) => s.refresh);
	const moveToFolder = useFileStore((s) => s.moveToFolder);
	const search = useFileStore((s) => s.search);
	const previewAppsLoaded = usePreviewAppStore((s) => s.isLoaded);
	const loadPreviewApps = usePreviewAppStore((s) => s.load);
	const breadcrumb = useFileStore((s) => s.breadcrumb);
	const folders = useFileStore((s) => s.folders);
	const files = useFileStore((s) => s.files);
	const loading = useFileStore((s) => s.loading);
	const viewMode = useFileStore((s) => s.viewMode);
	const browserOpenMode = useFileStore((s) => s.browserOpenMode);
	const setViewMode = useFileStore((s) => s.setViewMode);
	const searchQuery = useFileStore((s) => s.searchQuery);
	const searchFolders = useFileStore((s) => s.searchFolders);
	const searchFiles = useFileStore((s) => s.searchFiles);
	const error = useFileStore((s) => s.error);
	const clearSelection = useFileStore((s) => s.clearSelection);
	const loadMoreFiles = useFileStore((s) => s.loadMoreFiles);
	const loadingMore = useFileStore((s) => s.loadingMore);
	const sortBy = useFileStore((s) => s.sortBy);
	const sortOrder = useFileStore((s) => s.sortOrder);
	const setSortBy = useFileStore((s) => s.setSortBy);
	const setSortOrder = useFileStore((s) => s.setSortOrder);
	const hasMoreFiles = useFileStore((s) => s.hasMoreFiles());

	const isSearching = searchQuery !== null;
	const displayFolders = isSearching ? searchFolders : folders;
	const displayFiles = isSearching ? searchFiles : files;
	const currentBreadcrumbItem = breadcrumb[breadcrumb.length - 1];
	const currentFolderName = currentBreadcrumbItem?.name;
	const isRootFolder =
		currentBreadcrumbItem != null
			? currentBreadcrumbItem.id == null
			: folderId == null;
	const isCompactBreadcrumb = useMediaQuery("(max-width: 639px)");
	const pageTitle = isSearching
		? `${t("core:search")}: ${searchQuery}`
		: folderId == null
			? t("core:all_files")
			: (currentFolderName ?? t("core:all_files"));

	usePageTitle(pageTitle);
	useKeyboardShortcuts();

	const uploadAreaRef = useRef<UploadAreaHandle | null>(null);
	const sentinelRef = useRef<HTMLDivElement | null>(null);
	const [scrollViewport, setScrollViewport] = useState<HTMLDivElement | null>(
		null,
	);

	useEffect(() => {
		return runWhenIdle(() => {
			for (const preloader of FILE_BROWSER_LAZY_PRELOADERS) {
				void preloader.preload();
			}
		});
	}, []);

	useEffect(() => {
		if (isSearching || !hasMoreFiles || loadingMore) return;
		const el = sentinelRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					void loadMoreFiles();
				}
			},
			{ root: scrollViewport, rootMargin: "200px" },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [hasMoreFiles, isSearching, loadingMore, loadMoreFiles, scrollViewport]);

	const [createFolderOpen, setCreateFolderOpen] = useState(false);
	const [createFileOpen, setCreateFileOpen] = useState(false);
	const [fadingFileIds, setFadingFileIds] = useState<Set<number>>(new Set());
	const [fadingFolderIds, setFadingFolderIds] = useState<Set<number>>(
		new Set(),
	);
	const [previewState, setPreviewState] =
		useState<FileBrowserPreviewState | null>(null);
	const [shareTarget, setShareTarget] = useState<FileBrowserShareTarget | null>(
		null,
	);
	const [copyTarget, setCopyTarget] = useState<FileBrowserCopyTarget | null>(
		null,
	);
	const [moveTarget, setMoveTarget] = useState<FileBrowserMoveTarget | null>(
		null,
	);
	const [versionTarget, setVersionTarget] =
		useState<FileBrowserVersionTarget | null>(null);
	const [archiveTaskTarget, setArchiveTaskTarget] =
		useState<FileBrowserArchiveTaskTarget | null>(null);
	const [dragOverBreadcrumbIndex, setDragOverBreadcrumbIndex] = useState<
		number | null
	>(null);
	const [contentDragOver, setContentDragOver] = useState(false);
	const [renameTarget, setRenameTarget] =
		useState<FileBrowserRenameTarget | null>(null);
	const [infoPanelOpen, setInfoPanelOpen] = useState(false);
	const [infoTarget, setInfoTarget] = useState<FileBrowserInfoTarget | null>(
		null,
	);

	useEffect(() => {
		setInfoPanelOpen(false);
		setInfoTarget(null);
		navigateTo(folderId, folderName).catch(handleApiError);
	}, [folderId, folderName, navigateTo]);

	useEffect(() => {
		if (previewAppsLoaded) return;
		void loadPreviewApps();
	}, [loadPreviewApps, previewAppsLoaded]);

	useEffect(() => {
		if (!infoPanelOpen || infoTarget == null) {
			return;
		}

		if (infoTarget.file) {
			const nextFile = displayFiles.find(
				(entry) => entry.id === infoTarget.file?.id,
			);
			if (nextFile && nextFile !== infoTarget.file) {
				setInfoTarget({ file: nextFile });
			}
			return;
		}

		if (infoTarget.folder) {
			const nextFolder = displayFolders.find(
				(entry) => entry.id === infoTarget.folder?.id,
			);
			if (nextFolder && nextFolder !== infoTarget.folder) {
				setInfoTarget({ folder: nextFolder });
			}
		}
	}, [displayFiles, displayFolders, infoPanelOpen, infoTarget]);

	useEffect(() => {
		const locationState = location.state as FileBrowserLocationState | null;
		const previewFile = locationState?.searchPreviewFile;
		if (!previewFile) {
			return;
		}

		setPreviewState({ file: previewFile, openMode: "auto" });
		navigate(
			{
				pathname: location.pathname,
				search: location.search,
			},
			{
				replace: true,
				state: null,
			},
		);
	}, [location.pathname, location.search, location.state, navigate]);

	useEffect(() => {
		function onRenameRequest(event: Event) {
			const { type, id, name } = (event as CustomEvent).detail as {
				type: "file" | "folder";
				id: number;
				name: string;
			};
			void RenameDialog.preload();
			setRenameTarget({ type, id, name });
		}
		document.addEventListener("rename-request", onRenameRequest);
		return () =>
			document.removeEventListener("rename-request", onRenameRequest);
	}, []);

	const handleDownload = useCallback((fileId: number, _fileName: string) => {
		const anchor = document.createElement("a");
		anchor.href = fileService.downloadUrl(fileId);
		anchor.download = "";
		anchor.click();
	}, []);

	const handleCopy = useCallback((type: "file" | "folder", id: number) => {
		void BatchTargetFolderDialog.preload();
		setCopyTarget({ type, id });
	}, []);

	const handleCopyConfirm = useCallback(
		async (targetFolderId: number | null) => {
			if (!copyTarget) return;
			try {
				if (copyTarget.type === "file") {
					await fileService.copyFile(copyTarget.id, targetFolderId);
				} else {
					await fileService.copyFolder(copyTarget.id, targetFolderId);
				}
				toast.success(t("copy_success"));
				setCopyTarget(null);
				await refresh();
			} catch (err) {
				handleApiError(err);
			}
		},
		[copyTarget, refresh, t],
	);

	const handleMove = useCallback((type: "file" | "folder", id: number) => {
		void BatchTargetFolderDialog.preload();
		setMoveTarget(
			type === "file"
				? { fileIds: [id], folderIds: [] }
				: { fileIds: [], folderIds: [id] },
		);
	}, []);

	const handleToggleLock = useCallback(
		async (type: "file" | "folder", id: number, locked: boolean) => {
			try {
				if (type === "file") await fileService.setFileLock(id, !locked);
				else await fileService.setFolderLock(id, !locked);
				toast.success(!locked ? t("lock_success") : t("unlock_success"));
				refresh();
				return true;
			} catch (err) {
				handleApiError(err);
				return false;
			}
		},
		[refresh, t],
	);

	const handleVersions = useCallback(
		(fileId: number) => {
			const targetFile = displayFiles.find((entry) => entry.id === fileId);
			if (!targetFile) return;
			void VersionHistoryDialog.preload();
			setVersionTarget({
				fileId,
				fileName: targetFile.name,
				mimeType: targetFile.mime_type,
			});
		},
		[displayFiles],
	);

	const openPreview = useCallback(
		(file: FileInfo | FileListItem, openMode: "auto" | "direct" | "picker") => {
			setPreviewState({ file, openMode });
		},
		[],
	);

	const openShareDialog = useCallback((target: FileBrowserShareTarget) => {
		void ShareDialog.preload();
		setShareTarget(target);
	}, []);

	const openRenameDialog = useCallback(
		(type: "file" | "folder", id: number, name: string) => {
			void RenameDialog.preload();
			setRenameTarget({ type, id, name });
		},
		[],
	);

	const handleDelete = useCallback(
		async (type: "file" | "folder", id: number) => {
			try {
				if (type === "file") await useFileStore.getState().deleteFile(id);
				else await useFileStore.getState().deleteFolder(id);
				toast.success(t("delete_success"));
			} catch (err) {
				handleApiError(err);
			}
		},
		[t],
	);

	const notifyTaskQueued = useCallback(
		(displayName: string) => {
			toast.success(t("tasks:task_created_success"), {
				description: displayName,
			});
		},
		[t],
	);

	const startArchiveDownload = useCallback(
		async (fileIds: number[], folderIds: number[]) => {
			if (fileIds.length === 0 && folderIds.length === 0) {
				return;
			}

			await batchService.streamArchiveDownload(fileIds, folderIds);
		},
		[],
	);

	const requestArchiveCompress = useCallback(
		(
			fileIds: number[],
			folderIds: number[],
			options?: { clearSelectionOnSuccess?: boolean },
		) => {
			if (fileIds.length === 0 && folderIds.length === 0) {
				return;
			}

			void ArchiveTaskNameDialog.preload();
			setArchiveTaskTarget({
				mode: "compress",
				fileIds,
				folderIds,
				initialName: defaultArchiveCompressName(
					fileIds,
					folderIds,
					displayFiles,
					displayFolders,
				),
				clearSelectionOnSuccess: options?.clearSelectionOnSuccess ?? false,
			});
		},
		[displayFiles, displayFolders],
	);

	const requestArchiveExtract = useCallback(
		(fileId: number) => {
			const sourceFile = displayFiles.find((entry) => entry.id === fileId);
			void ArchiveTaskNameDialog.preload();
			setArchiveTaskTarget({
				mode: "extract",
				fileId,
				initialName: defaultArchiveExtractFolderName(sourceFile?.name ?? ""),
			});
		},
		[displayFiles],
	);

	const submitArchiveTask = useCallback(
		async (name: string | undefined) => {
			if (!archiveTaskTarget) {
				return;
			}

			if (archiveTaskTarget.mode === "compress") {
				const task = await batchService.createArchiveCompressTask(
					archiveTaskTarget.fileIds,
					archiveTaskTarget.folderIds,
					name,
				);
				notifyTaskQueued(task.display_name);
				if (archiveTaskTarget.clearSelectionOnSuccess) {
					clearSelection();
				}
				return;
			}

			const task = await fileService.createArchiveExtractTask(
				archiveTaskTarget.fileId,
				undefined,
				name,
			);
			notifyTaskQueued(task.display_name);
		},
		[archiveTaskTarget, clearSelection, notifyTaskQueued],
	);

	const handleMoveToFolder = useCallback(
		async (
			fileIds: number[],
			folderIds: number[],
			targetFolderId: number | null,
		) => {
			try {
				setFadingFileIds(new Set(fileIds));
				setFadingFolderIds(new Set(folderIds));
				const result = await moveToFolder(fileIds, folderIds, targetFolderId);
				document.dispatchEvent(
					new CustomEvent("folder-tree-move", {
						detail: { folderIds, targetFolderId },
					}),
				);
				await new Promise((resolve) =>
					setTimeout(resolve, FILE_BROWSER_FEEDBACK_DURATION_MS),
				);
				setFadingFileIds(new Set());
				setFadingFolderIds(new Set());
				const batchToast = formatBatchToast(t, "move", result);
				if (batchToast.variant === "error") {
					toast.error(batchToast.title, {
						description: batchToast.description,
					});
				} else {
					toast.success(batchToast.title, {
						description: batchToast.description,
					});
				}
			} catch (err) {
				setFadingFileIds(new Set());
				setFadingFolderIds(new Set());
				handleApiError(err);
			}
		},
		[moveToFolder, t],
	);

	const handleMoveConfirm = useCallback(
		async (targetFolderId: number | null) => {
			if (!moveTarget) return;
			await handleMoveToFolder(
				moveTarget.fileIds,
				moveTarget.folderIds,
				targetFolderId,
			);
			setMoveTarget(null);
		},
		[handleMoveToFolder, moveTarget],
	);

	const handleBreadcrumbDragOver = useCallback(
		(event: DragEvent, index: number) => {
			if (!hasInternalDragData(event.dataTransfer)) return;
			event.preventDefault();
			event.dataTransfer.dropEffect = "move";
			setDragOverBreadcrumbIndex(index);
		},
		[],
	);

	const handleBreadcrumbDragLeave = useCallback((event: DragEvent) => {
		const nextTarget = event.relatedTarget;
		if (
			nextTarget instanceof Node &&
			event.currentTarget.contains(nextTarget)
		) {
			return;
		}
		setDragOverBreadcrumbIndex(null);
	}, []);

	const handleBreadcrumbDrop = useCallback(
		async (event: DragEvent, index: number, targetFolderId: number | null) => {
			setDragOverBreadcrumbIndex(null);
			event.preventDefault();
			const data = readInternalDragData(event.dataTransfer);
			if (!data) return;

			const targetPathIds = breadcrumb
				.slice(0, index + 1)
				.map((item) => item.id)
				.filter((id): id is number => id !== null);
			if (
				getInvalidInternalDropReason(data, targetFolderId, targetPathIds) !==
				null
			) {
				return;
			}

			await handleMoveToFolder(data.fileIds, data.folderIds, targetFolderId);
		},
		[breadcrumb, handleMoveToFolder],
	);

	const handleContentDragOver = useCallback(
		(event: DragEvent<HTMLElement>) => {
			const isTreeDrag = event.dataTransfer.types.includes(DRAG_SOURCE_MIME);
			if (
				!hasInternalDragData(event.dataTransfer) ||
				isSearching ||
				!isTreeDrag
			) {
				setContentDragOver(false);
				return;
			}
			event.preventDefault();
			event.dataTransfer.dropEffect = "move";
			setContentDragOver(true);
		},
		[isSearching],
	);

	const handleContentDragLeave = useCallback(
		(event: DragEvent<HTMLElement>) => {
			const nextTarget = event.relatedTarget;
			if (
				nextTarget instanceof Node &&
				event.currentTarget.contains(nextTarget)
			) {
				return;
			}
			setContentDragOver(false);
		},
		[],
	);

	const handleContentDrop = useCallback(
		async (event: DragEvent<HTMLElement>) => {
			setContentDragOver(false);
			if (isSearching || !event.dataTransfer.types.includes(DRAG_SOURCE_MIME)) {
				return;
			}
			event.preventDefault();
			const data = readInternalDragData(event.dataTransfer);
			if (!data) return;
			const currentPathIds = breadcrumb
				.map((item) => item.id)
				.filter((id): id is number => id !== null);
			if (
				getInvalidInternalDropReason(data, folderId, currentPathIds) !== null
			) {
				return;
			}
			await handleMoveToFolder(data.fileIds, data.folderIds, folderId);
		},
		[breadcrumb, folderId, handleMoveToFolder, isSearching],
	);

	const handleTrashDrop = useCallback(
		async ({ fileIds, folderIds }: InternalDragData) => {
			if (fileIds.length === 0 && folderIds.length === 0) return;
			try {
				setFadingFileIds(new Set(fileIds));
				setFadingFolderIds(new Set(folderIds));
				const result = await batchService.batchDelete(fileIds, folderIds);
				await new Promise((resolve) =>
					setTimeout(resolve, FILE_BROWSER_FEEDBACK_DURATION_MS),
				);
				setFadingFileIds(new Set());
				setFadingFolderIds(new Set());
				const batchToast = formatBatchToast(t, "delete", result);
				if (batchToast.variant === "error") {
					toast.error(batchToast.title, {
						description: batchToast.description,
					});
				} else {
					toast.success(batchToast.title, {
						description: batchToast.description,
					});
				}
				clearSelection();
				await Promise.all([
					searchQuery ? search(searchQuery) : refresh(),
					useAuthStore.getState().refreshUser(),
				]);
			} catch (err) {
				setFadingFileIds(new Set());
				setFadingFolderIds(new Set());
				handleApiError(err);
			}
		},
		[clearSelection, refresh, search, searchQuery, t],
	);

	const breadcrumbPathIds = useMemo(
		() =>
			breadcrumb
				.map((item) => item.id)
				.filter((id): id is number => id !== null),
		[breadcrumb],
	);
	const handleNavigateToFolder = useCallback(
		(targetFolderId: number | null, targetFolderName: string) => {
			navigate(
				workspaceFolderPath(workspace, targetFolderId, targetFolderName),
			);
		},
		[navigate, workspace],
	);
	const handleFolderOpen = useCallback(
		(id: number, name: string) => {
			handleNavigateToFolder(id, name);
		},
		[handleNavigateToFolder],
	);
	const handleFileClick = useCallback(
		(file: FileListItem) => openPreview(file, "auto"),
		[openPreview],
	);
	const handleFileOpen = useCallback(
		(file: FileListItem) => openPreview(file, "direct"),
		[openPreview],
	);
	const handleFileChooseOpenMethod = useCallback(
		(file: FileListItem) => openPreview(file, "picker"),
		[openPreview],
	);
	const handleArchiveDownload = useCallback(
		(targetFolderId: number) => {
			void startArchiveDownload([], [targetFolderId]).catch(handleApiError);
		},
		[startArchiveDownload],
	);
	const handleBatchArchiveCompress = useCallback(
		async (fileIds: number[], folderIds: number[]) => {
			requestArchiveCompress(fileIds, folderIds, {
				clearSelectionOnSuccess: true,
			});
		},
		[requestArchiveCompress],
	);
	const handleArchiveCompress = useCallback(
		(type: "file" | "folder", id: number) => {
			const fileIds = type === "file" ? [id] : [];
			const folderIds = type === "folder" ? [id] : [];
			requestArchiveCompress(fileIds, folderIds);
		},
		[requestArchiveCompress],
	);
	const handleArchiveExtract = useCallback(
		(fileId: number) => {
			requestArchiveExtract(fileId);
		},
		[requestArchiveExtract],
	);
	const handleInfo = useCallback(
		(type: "file" | "folder", id: number) => {
			if (type === "file") {
				const file = displayFiles.find((entry) => entry.id === id);
				if (file) {
					setInfoTarget({ file });
					setInfoPanelOpen(true);
				}
				return;
			}

			const folder = displayFolders.find((entry) => entry.id === id);
			if (folder) {
				setInfoTarget({ folder });
				setInfoPanelOpen(true);
			}
		},
		[displayFiles, displayFolders],
	);
	const fileBrowserContextValue = useMemo<FileBrowserContextValue>(
		() => ({
			folders: displayFolders,
			files: displayFiles,
			browserOpenMode,
			breadcrumbPathIds,
			onFolderOpen: handleFolderOpen,
			onFileClick: handleFileClick,
			onFileOpen: handleFileOpen,
			onFileChooseOpenMethod: handleFileChooseOpenMethod,
			onShare: openShareDialog,
			onDownload: handleDownload,
			onArchiveDownload: handleArchiveDownload,
			onArchiveCompress: handleArchiveCompress,
			onArchiveExtract: handleArchiveExtract,
			onCopy: handleCopy,
			onMove: handleMove,
			onToggleLock: handleToggleLock,
			onDelete: handleDelete,
			onRename: openRenameDialog,
			onVersions: handleVersions,
			onInfo: handleInfo,
			onMoveToFolder: handleMoveToFolder,
			fadingFileIds,
			fadingFolderIds,
		}),
		[
			displayFolders,
			displayFiles,
			browserOpenMode,
			breadcrumbPathIds,
			handleFolderOpen,
			handleFileClick,
			handleFileOpen,
			handleFileChooseOpenMethod,
			openShareDialog,
			handleDownload,
			handleArchiveDownload,
			handleArchiveCompress,
			handleArchiveExtract,
			handleCopy,
			handleMove,
			handleToggleLock,
			handleDelete,
			openRenameDialog,
			handleVersions,
			handleInfo,
			handleMoveToFolder,
			fadingFileIds,
			fadingFolderIds,
		],
	);

	const isEmpty =
		!loading && displayFolders.length === 0 && displayFiles.length === 0;
	const uploadReady = uploadAreaRef.current !== null;
	const handleUploadAreaReady = useCallback(
		(instance: UploadAreaHandle | null) => {
			uploadAreaRef.current = instance;
		},
		[],
	);
	const handleScrollViewportRef = useCallback((node: HTMLDivElement | null) => {
		setScrollViewport(node);
	}, []);
	const pageCore = (
		<>
			<FileBrowserToolbar
				breadcrumb={breadcrumb}
				dragOverBreadcrumbIndex={dragOverBreadcrumbIndex}
				isCompactBreadcrumb={isCompactBreadcrumb}
				isRootFolder={isRootFolder}
				isSearching={isSearching}
				searchQuery={searchQuery}
				sortBy={sortBy}
				sortOrder={sortOrder}
				viewMode={viewMode}
				onBreadcrumbDragLeave={handleBreadcrumbDragLeave}
				onBreadcrumbDragOver={handleBreadcrumbDragOver}
				onBreadcrumbDrop={handleBreadcrumbDrop}
				onNavigateToFolder={handleNavigateToFolder}
				onRefresh={refresh}
				onSetSortBy={setSortBy}
				onSetSortOrder={setSortOrder}
				onSetViewMode={setViewMode}
			/>
			<FileBrowserWorkspace
				breadcrumb={breadcrumb}
				contentDragOver={contentDragOver}
				error={error}
				fileBrowserContextValue={fileBrowserContextValue}
				hasMoreFiles={hasMoreFiles}
				infoPanelOpen={infoPanelOpen}
				infoTarget={infoTarget}
				isEmpty={isEmpty}
				isSearching={isSearching}
				loading={loading}
				loadingMore={loadingMore}
				scrollViewport={scrollViewport}
				sentinelRef={sentinelRef}
				uploadReady={uploadReady}
				viewMode={viewMode}
				onContentDragLeave={handleContentDragLeave}
				onContentDragOver={handleContentDragOver}
				onContentDrop={handleContentDrop}
				onCreateFile={() => setCreateFileOpen(true)}
				onCreateFolder={() => setCreateFolderOpen(true)}
				onDownload={handleDownload}
				onInfoPanelOpenChange={setInfoPanelOpen}
				onOpenInfoFolder={(targetFolder) =>
					handleNavigateToFolder(targetFolder.id, targetFolder.name)
				}
				onPreview={(targetFile) => openPreview(targetFile, "auto")}
				onRefresh={refresh}
				onRename={openRenameDialog}
				onScrollViewportRef={handleScrollViewportRef}
				onShare={openShareDialog}
				onToggleLock={handleToggleLock}
				onTriggerFileUpload={() => uploadAreaRef.current?.triggerFileUpload()}
				onTriggerFolderUpload={() =>
					uploadAreaRef.current?.triggerFolderUpload()
				}
				onVersions={handleVersions}
			/>
		</>
	);

	return (
		<AppLayout
			onTrashDrop={handleTrashDrop}
			onMoveToFolder={handleMoveToFolder}
		>
			<UploadArea ref={handleUploadAreaReady}>{pageCore}</UploadArea>

			<Suspense fallback={null}>
				<CreateFolderDialog
					open={createFolderOpen}
					onOpenChange={setCreateFolderOpen}
				/>
			</Suspense>

			<Suspense fallback={null}>
				<CreateFileDialog
					open={createFileOpen}
					onOpenChange={setCreateFileOpen}
				/>
			</Suspense>

			<BatchActionBar
				onArchiveCompress={handleBatchArchiveCompress}
				onArchiveDownload={startArchiveDownload}
			/>

			<Suspense fallback={null}>
				<ArchiveTaskNameDialog
					open={archiveTaskTarget !== null}
					onOpenChange={(open) => {
						if (!open) setArchiveTaskTarget(null);
					}}
					mode={archiveTaskTarget?.mode ?? "compress"}
					initialName={archiveTaskTarget?.initialName ?? ""}
					onSubmit={submitArchiveTask}
				/>
			</Suspense>

			<Suspense fallback={null}>
				<ShareDialog
					open={shareTarget !== null}
					onOpenChange={(open) => {
						if (!open) setShareTarget(null);
					}}
					fileId={shareTarget?.fileId}
					folderId={shareTarget?.folderId}
					name={shareTarget?.name ?? ""}
					initialMode={shareTarget?.initialMode}
				/>
			</Suspense>
			{previewState && (
				<FilePreview
					file={previewState.file}
					openMode={previewState.openMode}
					onClose={() => setPreviewState(null)}
					onFileUpdated={() => refresh()}
					previewLinkFactory={() =>
						fileService.createPreviewLink(previewState.file.id)
					}
					wopiSessionFactory={(appKey) =>
						fileService.createWopiSession(previewState.file.id, appKey)
					}
				/>
			)}
			<Suspense fallback={null}>
				<BatchTargetFolderDialog
					open={copyTarget !== null}
					onOpenChange={(open) => {
						if (!open) setCopyTarget(null);
					}}
					mode="copy"
					onConfirm={handleCopyConfirm}
					currentFolderId={folderId}
					initialBreadcrumb={breadcrumb}
					selectedFolderIds={
						copyTarget?.type === "folder" ? [copyTarget.id] : []
					}
				/>
			</Suspense>
			<Suspense fallback={null}>
				<BatchTargetFolderDialog
					open={moveTarget !== null}
					onOpenChange={(open) => {
						if (!open) setMoveTarget(null);
					}}
					mode="move"
					onConfirm={handleMoveConfirm}
					currentFolderId={folderId}
					initialBreadcrumb={breadcrumb}
					selectedFolderIds={moveTarget?.folderIds ?? []}
				/>
			</Suspense>
			<Suspense fallback={null}>
				<VersionHistoryDialog
					open={versionTarget !== null}
					onOpenChange={(open) => {
						if (!open) setVersionTarget(null);
					}}
					fileId={versionTarget?.fileId ?? 0}
					fileName={versionTarget?.fileName ?? ""}
					mimeType={versionTarget?.mimeType}
					onRestored={() => {
						setVersionTarget(null);
						refresh();
					}}
				/>
			</Suspense>
			<Suspense fallback={null}>
				<RenameDialog
					open={renameTarget !== null}
					onOpenChange={(open) => {
						if (!open) setRenameTarget(null);
					}}
					type={renameTarget?.type ?? "file"}
					id={renameTarget?.id ?? 0}
					currentName={renameTarget?.name ?? ""}
				/>
			</Suspense>
		</AppLayout>
	);
}
