import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SkeletonTree } from "@/components/common/SkeletonTree";
import { Icon } from "@/components/ui/icon";
import { handleApiError } from "@/hooks/useApiError";
import {
	DRAG_MIME,
	FOLDER_TREE_DRAG_EXPAND_DELAY_MS,
	FOLDER_TREE_INDENT_PX,
	FOLDER_TREE_ROW_OFFSET_PX,
	SIDEBAR_SECTION_PADDING_CLASS,
} from "@/lib/constants";
import { formatBatchToast } from "@/lib/formatBatchToast";
import { folderTreeRowClass } from "@/lib/utils";
import { fileService } from "@/services/fileService";
import { useAuthStore } from "@/stores/authStore";
import { useFileStore } from "@/stores/fileStore";
import type { FolderInfo } from "@/types/api";

interface FolderTreeNode {
	folder: FolderInfo;
	parentId: number | null;
	childIds: number[];
}

interface FolderTreeSnapshot {
	expandedIds: number[];
	loadedIds: number[];
	nodeEntries: Array<[number, FolderTreeNode]>;
	rootIds: number[];
	userId: number | null;
}

interface TreeNodeProps {
	currentFolderId: number | null;
	depth: number;
	expandedIds: Set<number>;
	loadedIds: Set<number>;
	loadingIds: Set<number>;
	nodeId: number;
	nodeMap: Map<number, FolderTreeNode>;
	onDragHoverEnd: (id: number) => void;
	onDragHoverStart: (id: number) => void;
	onDrop: (
		fileIds: number[],
		folderIds: number[],
		targetFolderId: number,
	) => void;
	onNavigate: (id: number, name: string) => void;
	onToggle: (id: number) => void;
	renderChildren: (ids: number[], depth: number) => React.ReactNode;
}

let folderTreeSnapshot: FolderTreeSnapshot | null = null;

function cloneNodeEntries(
	nodeMap: Map<number, FolderTreeNode>,
): Array<[number, FolderTreeNode]> {
	return Array.from(nodeMap.entries()).map(([id, node]) => [
		id,
		{
			folder: node.folder,
			parentId: node.parentId,
			childIds: [...node.childIds],
		},
	]);
}

function upsertChildren(
	nodeMap: Map<number, FolderTreeNode>,
	parentId: number | null,
	folders: FolderInfo[],
	getCachedChildIds?: (id: number) => number[] | undefined,
): { nodeMap: Map<number, FolderTreeNode>; rootIds: number[] } {
	const nextNodeMap = new Map(nodeMap);
	const childIds = folders.map((folder) => folder.id);

	for (const folder of folders) {
		const existing = nextNodeMap.get(folder.id);
		nextNodeMap.set(folder.id, {
			childIds: existing?.childIds ?? getCachedChildIds?.(folder.id) ?? [],
			folder,
			parentId,
		});
	}

	if (parentId === null) {
		return { nodeMap: nextNodeMap, rootIds: childIds };
	}

	const parentNode = nextNodeMap.get(parentId);
	if (parentNode) {
		nextNodeMap.set(parentId, {
			...parentNode,
			childIds,
		});
	}

	return { nodeMap: nextNodeMap, rootIds: [] };
}

function TreeNode({
	currentFolderId,
	depth,
	expandedIds,
	loadedIds,
	loadingIds,
	nodeId,
	nodeMap,
	onDragHoverEnd,
	onDragHoverStart,
	onDrop,
	onNavigate,
	onToggle,
	renderChildren,
}: TreeNodeProps) {
	const node = nodeMap.get(nodeId);
	const [dragOver, setDragOver] = useState(false);
	const rowRef = useRef<HTMLDivElement | null>(null);

	if (!node) return null;

	const isActive = currentFolderId === node.folder.id;
	const isExpanded = expandedIds.has(node.folder.id);
	const isLoading = loadingIds.has(node.folder.id);
	const isLoaded = loadedIds.has(node.folder.id);
	const showToggle = isLoading || !isLoaded || node.childIds.length > 0;

	const handleDragOver = (e: React.DragEvent) => {
		if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDragOver(true);
		onDragHoverStart(node.folder.id);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		const nextTarget = e.relatedTarget;
		if (nextTarget instanceof Node && rowRef.current?.contains(nextTarget)) {
			return;
		}
		setDragOver(false);
		onDragHoverEnd(node.folder.id);
	};

	const handleDrop = (e: React.DragEvent) => {
		setDragOver(false);
		onDragHoverEnd(node.folder.id);
		e.preventDefault();
		const raw = e.dataTransfer.getData(DRAG_MIME);
		if (!raw) return;
		const data = JSON.parse(raw) as { fileIds: number[]; folderIds: number[] };
		if (data.folderIds.includes(node.folder.id)) return;
		onDrop(data.fileIds, data.folderIds, node.folder.id);
	};

	return (
		<div>
			{/* biome-ignore lint/a11y/useSemanticElements: outer row needs drag-drop target and contains a nested toggle button */}
			<div
				ref={rowRef}
				role="button"
				tabIndex={0}
				className={folderTreeRowClass(
					isActive,
					dragOver && "ring-2 ring-primary bg-accent/30",
				)}
				style={{
					paddingLeft: `${depth * FOLDER_TREE_INDENT_PX + FOLDER_TREE_ROW_OFFSET_PX}px`,
				}}
				onClick={() => onNavigate(node.folder.id, node.folder.name)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onNavigate(node.folder.id, node.folder.name);
					}
				}}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
			>
				{showToggle ? (
					<button
						type="button"
						onDragEnter={(e) => e.preventDefault()}
						className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent-foreground/10 hover:text-foreground disabled:cursor-default disabled:hover:bg-transparent"
						onClick={(e) => {
							e.stopPropagation();
							onToggle(node.folder.id);
						}}
						disabled={isLoading}
					>
						{isLoading ? (
							<div className="h-3 w-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
						) : isExpanded ? (
							<Icon
								name="CaretDown"
								className="h-3 w-3 text-muted-foreground"
							/>
						) : (
							<Icon
								name="CaretRight"
								className="h-3 w-3 text-muted-foreground"
							/>
						)}
					</button>
				) : (
					<span className="h-4 w-4 shrink-0" aria-hidden="true" />
				)}
				<div className="flex min-w-0 flex-1 items-center gap-2 px-1">
					{isExpanded ? (
						<Icon
							name="FolderOpen"
							className="h-4 w-4 shrink-0 text-muted-foreground"
						/>
					) : (
						<Icon
							name="Folder"
							className="h-4 w-4 shrink-0 text-muted-foreground"
						/>
					)}
					<span className="truncate">{node.folder.name}</span>
				</div>
			</div>
			{isExpanded &&
				node.childIds.length > 0 &&
				renderChildren(node.childIds, depth + 1)}
		</div>
	);
}

export function FolderTree() {
	const { t } = useTranslation("files");
	const userId = useAuthStore((s) => s.user?.id ?? null);
	const location = useLocation();
	const navigate = useNavigate();
	const breadcrumb = useFileStore((s) => s.breadcrumb);
	const currentFolderId = useFileStore((s) => s.currentFolderId);
	const moveToFolder = useFileStore((s) => s.moveToFolder);
	const storeFolders = useFileStore((s) => s.folders);
	const storeCurrentFolderId = useFileStore((s) => s.currentFolderId);
	const storeLoading = useFileStore((s) => s.loading);
	const isRootRoute = location.pathname === "/";
	const cachedSnapshot =
		folderTreeSnapshot?.userId === userId ? folderTreeSnapshot : null;

	const [nodeMap, setNodeMap] = useState<Map<number, FolderTreeNode>>(
		() => new Map(cachedSnapshot?.nodeEntries ?? []),
	);
	const [rootIds, setRootIds] = useState<number[]>(
		() => cachedSnapshot?.rootIds ?? [],
	);
	const [expandedIds, setExpandedIds] = useState<Set<number>>(
		() => new Set(cachedSnapshot?.expandedIds ?? []),
	);
	const [loadingIds, setLoadingIds] = useState<Set<number>>(() => new Set());
	const [loadedIds, setLoadedIds] = useState<Set<number>>(
		() => new Set(cachedSnapshot?.loadedIds ?? []),
	);
	const [rootLoaded, setRootLoaded] = useState(
		() => cachedSnapshot !== null || rootIds.length > 0,
	);
	const [rootDragOver, setRootDragOver] = useState(false);

	const childrenCacheRef = useRef<Map<number | null, FolderInfo[]>>(new Map());
	const inflightLoadsRef = useRef<Map<number | null, Promise<void>>>(new Map());
	const expandingPathRef = useRef<string>("");
	const hoverExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const hoverExpandTargetIdRef = useRef<number | null>(null);

	const clearHoverExpandTimer = useCallback(() => {
		if (hoverExpandTimerRef.current) {
			clearTimeout(hoverExpandTimerRef.current);
			hoverExpandTimerRef.current = null;
		}
		hoverExpandTargetIdRef.current = null;
	}, []);

	useEffect(() => {
		if (folderTreeSnapshot?.userId === userId) return;
		clearHoverExpandTimer();
		folderTreeSnapshot = null;
		childrenCacheRef.current = new Map();
		inflightLoadsRef.current = new Map();
		expandingPathRef.current = "";
		setNodeMap(new Map());
		setRootIds([]);
		setExpandedIds(new Set());
		setLoadingIds(new Set());
		setLoadedIds(new Set());
		setRootLoaded(false);
	}, [clearHoverExpandTimer, userId]);

	useEffect(() => {
		folderTreeSnapshot = {
			expandedIds: Array.from(expandedIds),
			loadedIds: Array.from(loadedIds),
			nodeEntries: cloneNodeEntries(nodeMap),
			rootIds,
			userId,
		};
	}, [expandedIds, loadedIds, nodeMap, rootIds, userId]);

	const syncFolderChildren = useCallback(
		(parentId: number | null, folders: FolderInfo[]) => {
			childrenCacheRef.current.set(parentId, folders);
			setNodeMap(
				(prev) =>
					upsertChildren(prev, parentId, folders, (id) => {
						const cachedChildren = childrenCacheRef.current.get(id);
						return cachedChildren?.map((folder) => folder.id);
					}).nodeMap,
			);
			if (parentId === null) {
				setRootIds(folders.map((folder) => folder.id));
				setRootLoaded(true);
			} else {
				setLoadedIds((prev) => new Set(prev).add(parentId));
			}
		},
		[],
	);

	const ensureChildrenLoaded = useCallback(
		async (parentId: number | null) => {
			if (parentId === null) {
				if (rootLoaded) return;
			} else if (loadedIds.has(parentId)) {
				return;
			}

			const inflight = inflightLoadsRef.current.get(parentId);
			if (inflight) {
				await inflight;
				return;
			}

			const cached = childrenCacheRef.current.get(parentId);
			if (cached) {
				syncFolderChildren(parentId, cached);
				return;
			}

			const loadPromise = (async () => {
				if (parentId !== null) {
					setLoadingIds((prev) => new Set(prev).add(parentId));
				}
				try {
					const contents =
						parentId === null
							? await fileService.listRoot({
									file_limit: 0,
									folder_limit: 1000,
								})
							: await fileService.listFolder(parentId, {
									file_limit: 0,
									folder_limit: 1000,
								});
					syncFolderChildren(parentId, contents.folders);
				} finally {
					if (parentId !== null) {
						setLoadingIds((prev) => {
							const next = new Set(prev);
							next.delete(parentId);
							return next;
						});
					}
					inflightLoadsRef.current.delete(parentId);
				}
			})();

			inflightLoadsRef.current.set(parentId, loadPromise);
			await loadPromise;
		},
		[loadedIds, rootLoaded, syncFolderChildren],
	);

	useEffect(() => {
		if (rootLoaded) return;
		let cancelled = false;
		void ensureChildrenLoaded(null).catch(() => {
			if (!cancelled) {
				setRootLoaded(false);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [ensureChildrenLoaded, rootLoaded]);

	useEffect(() => {
		if (storeLoading) return;
		if (rootLoaded && storeCurrentFolderId === null && isRootRoute) {
			syncFolderChildren(null, storeFolders);
		}
	}, [
		isRootRoute,
		rootLoaded,
		storeCurrentFolderId,
		storeFolders,
		storeLoading,
		syncFolderChildren,
	]);

	useEffect(() => {
		if (storeLoading) return;
		if (!rootLoaded || storeCurrentFolderId === null) return;
		syncFolderChildren(storeCurrentFolderId, storeFolders);
	}, [
		rootLoaded,
		storeCurrentFolderId,
		storeFolders,
		storeLoading,
		syncFolderChildren,
	]);

	useEffect(() => {
		if (!rootLoaded || currentFolderId === null) return;

		const pathIds = breadcrumb
			.map((item) => item.id)
			.filter((id): id is number => id !== null);
		if (pathIds.length === 0) return;

		const pathKey = pathIds.join("/");
		if (expandingPathRef.current === pathKey) return;

		let cancelled = false;

		async function expandPath() {
			for (const folderId of pathIds) {
				if (cancelled) return;
				await ensureChildrenLoaded(folderId);
				if (cancelled) return;
				setExpandedIds((prev) => new Set(prev).add(folderId));
			}
			expandingPathRef.current = pathKey;
		}

		void expandPath();
		return () => {
			cancelled = true;
		};
	}, [breadcrumb, currentFolderId, ensureChildrenLoaded, rootLoaded]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset marker whenever folder target changes
	useEffect(() => {
		expandingPathRef.current = "";
		clearHoverExpandTimer();
	}, [clearHoverExpandTimer, currentFolderId]);

	useEffect(() => () => clearHoverExpandTimer(), [clearHoverExpandTimer]);

	const ensureFolderExpanded = useCallback(
		async (folderId: number) => {
			if (expandedIds.has(folderId)) return;
			await ensureChildrenLoaded(folderId);
			setExpandedIds((prev) => new Set(prev).add(folderId));
		},
		[ensureChildrenLoaded, expandedIds],
	);

	const handleToggle = useCallback(
		async (folderId: number) => {
			clearHoverExpandTimer();
			if (expandedIds.has(folderId)) {
				setExpandedIds((prev) => {
					const next = new Set(prev);
					next.delete(folderId);
					return next;
				});
				return;
			}

			await ensureFolderExpanded(folderId);
		},
		[clearHoverExpandTimer, ensureFolderExpanded, expandedIds],
	);

	const handleNavigate = useCallback(
		async (id: number, name: string) => {
			clearHoverExpandTimer();
			await ensureFolderExpanded(id);
			navigate(`/folder/${id}?name=${encodeURIComponent(name)}`);
		},
		[clearHoverExpandTimer, ensureFolderExpanded, navigate],
	);

	const handleDrop = useCallback(
		(fileIds: number[], folderIds: number[], targetFolderId: number) => {
			clearHoverExpandTimer();
			moveToFolder(fileIds, folderIds, targetFolderId)
				.then((result) => {
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
				})
				.catch(handleApiError);
		},
		[clearHoverExpandTimer, moveToFolder, t],
	);

	const scheduleHoverExpand = useCallback(
		(folderId: number) => {
			const node = nodeMap.get(folderId);
			if (!node) return;
			if (expandedIds.has(folderId)) return;
			if (loadingIds.has(folderId)) return;
			if (loadedIds.has(folderId) && node.childIds.length === 0) return;
			if (hoverExpandTargetIdRef.current === folderId) return;

			clearHoverExpandTimer();
			hoverExpandTargetIdRef.current = folderId;
			hoverExpandTimerRef.current = setTimeout(() => {
				hoverExpandTimerRef.current = null;
				const targetId = hoverExpandTargetIdRef.current;
				hoverExpandTargetIdRef.current = null;
				if (targetId == null) return;
				void ensureFolderExpanded(targetId);
			}, FOLDER_TREE_DRAG_EXPAND_DELAY_MS);
		},
		[
			clearHoverExpandTimer,
			ensureFolderExpanded,
			expandedIds,
			loadedIds,
			loadingIds,
			nodeMap,
		],
	);

	const handleRootDragOver = (e: React.DragEvent) => {
		if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		clearHoverExpandTimer();
		setRootDragOver(true);
	};

	const handleRootDrop = (e: React.DragEvent) => {
		clearHoverExpandTimer();
		setRootDragOver(false);
		e.preventDefault();
		const raw = e.dataTransfer.getData(DRAG_MIME);
		if (!raw) return;
		const data = JSON.parse(raw) as { fileIds: number[]; folderIds: number[] };
		moveToFolder(data.fileIds, data.folderIds, null)
			.then((result) => {
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
			})
			.catch(handleApiError);
	};

	const handleDragHoverStart = useCallback(
		(folderId: number) => {
			scheduleHoverExpand(folderId);
		},
		[scheduleHoverExpand],
	);

	const handleDragHoverEnd = useCallback(
		(folderId: number) => {
			if (hoverExpandTargetIdRef.current !== folderId) return;
			clearHoverExpandTimer();
		},
		[clearHoverExpandTimer],
	);

	function renderChildren(ids: number[], depth: number): React.ReactNode {
		return ids.map((id) => (
			<TreeNode
				key={id}
				currentFolderId={currentFolderId}
				depth={depth}
				expandedIds={expandedIds}
				loadedIds={loadedIds}
				loadingIds={loadingIds}
				nodeId={id}
				nodeMap={nodeMap}
				onDragHoverEnd={handleDragHoverEnd}
				onDragHoverStart={handleDragHoverStart}
				onDrop={handleDrop}
				onNavigate={handleNavigate}
				onToggle={handleToggle}
				renderChildren={renderChildren}
			/>
		));
	}

	const visibleRootIds = useMemo(
		() => rootIds.filter((id) => nodeMap.has(id)),
		[nodeMap, rootIds],
	);

	return (
		<div className={`${SIDEBAR_SECTION_PADDING_CLASS} py-2 space-y-0.5`}>
			{!rootLoaded ? (
				<SkeletonTree count={4} />
			) : (
				<>
					<button
						type="button"
						className={folderTreeRowClass(
							currentFolderId === null &&
								(location.pathname === "/" ||
									location.pathname.startsWith("/folder")),
							rootDragOver && "ring-2 ring-primary bg-accent/30",
						)}
						onClick={() => navigate("/")}
						onDragOver={handleRootDragOver}
						onDragLeave={() => setRootDragOver(false)}
						onDrop={handleRootDrop}
					>
						<Icon name="Folder" className="h-4 w-4 text-muted-foreground" />
						{t("root")}
					</button>
					{renderChildren(visibleRootIds, 1)}
				</>
			)}
		</div>
	);
}
