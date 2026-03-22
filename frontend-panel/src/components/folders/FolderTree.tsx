import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { fileService } from "@/services/fileService";
import { useFileStore } from "@/stores/fileStore";
import type { FolderInfo } from "@/types/api";

interface TreeNodeData {
	folder: FolderInfo;
	children: TreeNodeData[] | null; // null = not loaded
	expanded: boolean;
	loading: boolean;
}

function TreeNode({
	node,
	depth,
	onToggle,
	onNavigate,
	currentFolderId,
}: {
	node: TreeNodeData;
	depth: number;
	onToggle: (id: number) => void;
	onNavigate: (id: number, name: string) => void;
	currentFolderId: number | null;
}) {
	const isActive = currentFolderId === node.folder.id;

	return (
		<div>
			<div
				className={cn(
					"flex items-center gap-0.5 py-1.5 rounded-md text-sm hover:bg-accent transition-colors",
					isActive && "bg-accent font-medium",
				)}
				style={{ paddingLeft: `${depth * 16 + 4}px` }}
			>
				<button
					type="button"
					className="p-0.5 hover:bg-accent-foreground/10 rounded shrink-0"
					onClick={() => onToggle(node.folder.id)}
				>
					{node.loading ? (
						<div className="h-3 w-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
					) : node.expanded ? (
						<ChevronDown className="h-3 w-3 text-muted-foreground" />
					) : (
						<ChevronRight className="h-3 w-3 text-muted-foreground" />
					)}
				</button>
				<button
					type="button"
					className="flex-1 flex items-center gap-1.5 text-left min-w-0 px-1"
					onClick={() => onNavigate(node.folder.id, node.folder.name)}
				>
					{node.expanded ? (
						<FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
					) : (
						<Folder className="h-4 w-4 text-muted-foreground shrink-0" />
					)}
					<span className="truncate">{node.folder.name}</span>
				</button>
			</div>
			{node.expanded && node.children && (
				<div>
					{node.children.map((child) => (
						<TreeNode
							key={child.folder.id}
							node={child}
							depth={depth + 1}
							onToggle={onToggle}
							onNavigate={onNavigate}
							currentFolderId={currentFolderId}
						/>
					))}
				</div>
			)}
		</div>
	);
}

// Helper: recursively update a node in the tree
function updateNode(
	nodes: TreeNodeData[],
	targetId: number,
	updater: (node: TreeNodeData) => TreeNodeData,
): TreeNodeData[] {
	return nodes.map((n) => {
		if (n.folder.id === targetId) return updater(n);
		if (n.children) {
			return {
				...n,
				children: updateNode(n.children, targetId, updater),
			};
		}
		return n;
	});
}

export function FolderTree() {
	const { t } = useTranslation("files");
	const currentFolderId = useFileStore((s) => s.currentFolderId);
	const navigateTo = useFileStore((s) => s.navigateTo);
	const storeFolders = useFileStore((s) => s.folders);
	const storeCurrentFolderId = useFileStore((s) => s.currentFolderId);
	const [nodes, setNodes] = useState<TreeNodeData[]>([]);
	const [rootLoaded, setRootLoaded] = useState(false);

	// Load root folders on mount
	useEffect(() => {
		async function loadRoot() {
			try {
				const contents = await fileService.listRoot();
				setNodes(
					contents.folders.map((f) => ({
						folder: f,
						children: null,
						expanded: false,
						loading: false,
					})),
				);
				setRootLoaded(true);
			} catch {
				// Silently fail - file store will show errors
			}
		}
		loadRoot();
	}, []);

	// Refresh root when navigating to root and store folders change
	useEffect(() => {
		if (rootLoaded && storeCurrentFolderId === null) {
			setNodes((prev) =>
				storeFolders.map((f) => {
					const existing = prev.find((n) => n.folder.id === f.id);
					return existing
						? { ...existing, folder: f }
						: {
								folder: f,
								children: null,
								expanded: false,
								loading: false,
							};
				}),
			);
		}
	}, [storeFolders, storeCurrentFolderId, rootLoaded]);

	const handleToggle = useCallback(async (folderId: number) => {
		let shouldLoad = false;

		setNodes((prev) =>
			updateNode(prev, folderId, (n) => {
				if (n.expanded) {
					// Collapse
					return { ...n, expanded: false };
				}
				// Expand - need to load children
				shouldLoad = true;
				return { ...n, loading: true, expanded: true };
			}),
		);

		if (!shouldLoad) return;

		try {
			const contents = await fileService.listFolder(folderId);
			setNodes((prev) =>
				updateNode(prev, folderId, (n) => ({
					...n,
					loading: false,
					children: contents.folders.map((f) => ({
						folder: f,
						children: null,
						expanded: false,
						loading: false,
					})),
				})),
			);
		} catch {
			setNodes((prev) =>
				updateNode(prev, folderId, (n) => ({
					...n,
					loading: false,
					expanded: false,
				})),
			);
		}
	}, []);

	const handleNavigate = useCallback(
		(id: number, name: string) => {
			navigateTo(id, name);
		},
		[navigateTo],
	);

	return (
		<div className="p-2 space-y-0.5">
			{/* Root */}
			<button
				type="button"
				className={cn(
					"w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors text-left",
					currentFolderId === null && "bg-accent font-medium",
				)}
				onClick={() => navigateTo(null)}
			>
				<Folder className="h-4 w-4 text-muted-foreground" />
				{t("root")}
			</button>

			{/* Tree nodes */}
			{nodes.map((node) => (
				<TreeNode
					key={node.folder.id}
					node={node}
					depth={1}
					onToggle={handleToggle}
					onNavigate={handleNavigate}
					currentFolderId={currentFolderId}
				/>
			))}
		</div>
	);
}
