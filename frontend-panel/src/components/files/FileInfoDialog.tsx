import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileItemStatusIndicators } from "@/components/files/FileItemStatusIndicators";
import { FileTypeIcon } from "@/components/files/FileTypeIcon";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Icon, type IconName } from "@/components/ui/icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRetainedDialogValue } from "@/hooks/useRetainedDialogValue";
import { formatBytes, formatDateAbsolute } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fileService } from "@/services/fileService";
import type {
	FileInfo,
	FileListItem,
	FolderInfo,
	FolderListItem,
} from "@/types/api";

interface FileInfoDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	file?: FileInfo | FileListItem;
	folder?: FolderInfo | FolderListItem;
	onPreview?: (file: FileInfo | FileListItem) => void;
	onOpenFolder?: (folder: FolderInfo | FolderListItem) => void;
	onShare?: (target: {
		fileId?: number;
		folderId?: number;
		name: string;
		initialMode?: "page" | "direct";
	}) => void;
	onDownload?: (fileId: number, fileName: string) => void;
	onRename?: (type: "file" | "folder", id: number, name: string) => void;
	onVersions?: (fileId: number) => void;
	onToggleLock?: (
		type: "file" | "folder",
		id: number,
		locked: boolean,
	) => Promise<boolean> | boolean | undefined;
}

interface DetailRow {
	label: string;
	value: React.ReactNode;
	monospace?: boolean;
}

interface QuickAction {
	icon: IconName;
	label: string;
	onClick: () => void;
}

const DESKTOP_PANEL_EXIT_MS = 220;
type FileInfoDialogTarget = {
	file?: FileInfo | FileListItem;
	folder?: FolderInfo | FolderListItem;
};

function hasFileDetails(file: FileInfo | FileListItem): file is FileInfo {
	return "blob_id" in file && "created_at" in file;
}

function hasFolderDetails(
	folder: FolderInfo | FolderListItem,
): folder is FolderInfo {
	return "created_at" in folder;
}

function useMediaQuery(query: string) {
	const getMatches = () =>
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia(query).matches;

	const [matches, setMatches] = useState(getMatches);

	useEffect(() => {
		if (
			typeof window === "undefined" ||
			typeof window.matchMedia !== "function"
		) {
			return;
		}

		const mediaQuery = window.matchMedia(query);
		setMatches(mediaQuery.matches);
		const handleChange = (event: MediaQueryListEvent) => {
			setMatches(event.matches);
		};

		if (typeof mediaQuery.addEventListener === "function") {
			mediaQuery.addEventListener("change", handleChange);
			return () => mediaQuery.removeEventListener("change", handleChange);
		}

		mediaQuery.addListener(handleChange);
		return () => mediaQuery.removeListener(handleChange);
	}, [query]);

	return matches;
}

function Section({
	title,
	children,
	className,
}: {
	title?: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<section
			className={cn(
				"space-y-3 rounded-2xl border bg-background/80 p-4 shadow-xs",
				className,
			)}
		>
			{title ? (
				<h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
					{title}
				</h3>
			) : null}
			{children}
		</section>
	);
}

function DetailList({ rows }: { rows: DetailRow[] }) {
	return (
		<dl className="space-y-3">
			{rows.map((row) => (
				<div
					key={row.label}
					className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
				>
					<dt className="text-sm text-muted-foreground">{row.label}</dt>
					<dd
						className={cn(
							"max-w-[14rem] text-right text-sm text-foreground",
							row.monospace && "font-mono text-[13px]",
						)}
					>
						{row.value}
					</dd>
				</div>
			))}
		</dl>
	);
}

function ActionGrid({ actions }: { actions: QuickAction[] }) {
	if (actions.length === 0) {
		return null;
	}

	return (
		<div className="grid grid-cols-2 gap-2">
			{actions.map((action) => (
				<Button
					key={action.label}
					type="button"
					variant="outline"
					size="sm"
					className="justify-start"
					onClick={action.onClick}
				>
					<Icon name={action.icon} className="h-4 w-4" />
					<span className="truncate">{action.label}</span>
				</Button>
			))}
		</div>
	);
}

function formatValueOrFallback(
	value: string | null | undefined,
	loading: boolean,
	loadingText: string,
) {
	if (value != null) {
		return value;
	}
	return loading ? loadingText : "—";
}

export function FileInfoDialog({
	open,
	onOpenChange,
	file,
	folder,
	onPreview,
	onOpenFolder,
	onShare,
	onDownload,
	onRename,
	onVersions,
	onToggleLock,
}: FileInfoDialogProps) {
	const { t } = useTranslation(["files", "core"]);
	const retainedTargetInput = useMemo<FileInfoDialogTarget | null>(
		() => (file ? { file } : folder ? { folder } : null),
		[file, folder],
	);
	const { retainedValue: retainedTarget, handleOpenChangeComplete } =
		useRetainedDialogValue<FileInfoDialogTarget>(retainedTargetInput, open);
	const [resolvedFile, setResolvedFile] = useState<FileInfo | null>(null);
	const [fileDetailsLoading, setFileDetailsLoading] = useState(false);
	const [resolvedFolder, setResolvedFolder] = useState<FolderInfo | null>(null);
	const [folderDetailsLoading, setFolderDetailsLoading] = useState(false);
	const [childCount, setChildCount] = useState<{
		folders: number;
		files: number;
	} | null>(null);
	const [optimisticLocked, setOptimisticLocked] = useState<boolean | null>(
		null,
	);
	const isDesktop = useMediaQuery("(min-width: 1024px)");
	const [desktopMounted, setDesktopMounted] = useState(open);
	const [desktopVisible, setDesktopVisible] = useState(open);
	const renderedFile = file ?? retainedTarget?.file;
	const renderedFolder = folder ?? retainedTarget?.folder;

	useEffect(() => {
		if (!open || !file) {
			setResolvedFile(null);
			setFileDetailsLoading(false);
			return;
		}
		if (hasFileDetails(file)) {
			setResolvedFile(file);
			setFileDetailsLoading(false);
			return;
		}

		let cancelled = false;
		setResolvedFile(null);
		setFileDetailsLoading(true);
		fileService
			.getFile(file.id)
			.then((data) => {
				if (!cancelled) {
					setResolvedFile(data);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setResolvedFile(null);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setFileDetailsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [file, open]);

	useEffect(() => {
		if (!open || !folder) {
			setResolvedFolder(null);
			setFolderDetailsLoading(false);
			return;
		}
		if (hasFolderDetails(folder)) {
			setResolvedFolder(folder);
			setFolderDetailsLoading(false);
			return;
		}

		let cancelled = false;
		setResolvedFolder(null);
		setFolderDetailsLoading(true);
		fileService
			.getFolderInfo(folder.id)
			.then((data) => {
				if (!cancelled) {
					setResolvedFolder(data);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setResolvedFolder(null);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setFolderDetailsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [folder, open]);

	useEffect(() => {
		if (!open || !folder) {
			setChildCount(null);
			return;
		}

		let cancelled = false;
		setChildCount(null);
		fileService
			.listFolder(folder.id, { folder_limit: 0, file_limit: 0 })
			.then((res) => {
				if (!cancelled) {
					setChildCount({
						folders: res.folders_total,
						files: res.files_total,
					});
				}
			})
			.catch(() => {
				if (!cancelled) {
					setChildCount(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [open, folder]);

	useEffect(() => {
		if (!isDesktop) {
			setDesktopMounted(open);
			setDesktopVisible(open);
			return;
		}

		let enterTimeout: number | null = null;
		let exitTimeout: number | null = null;

		if (open) {
			setDesktopMounted(true);
			enterTimeout = window.setTimeout(() => {
				setDesktopVisible(true);
			}, 0);
		} else {
			setDesktopVisible(false);
			exitTimeout = window.setTimeout(() => {
				setDesktopMounted(false);
			}, DESKTOP_PANEL_EXIT_MS);
		}

		return () => {
			if (enterTimeout != null) {
				window.clearTimeout(enterTimeout);
			}
			if (exitTimeout != null) {
				window.clearTimeout(exitTimeout);
			}
		};
	}, [isDesktop, open]);

	const activeFile = renderedFile
		? hasFileDetails(renderedFile)
			? renderedFile
			: resolvedFile
		: null;
	const activeFolder = renderedFolder
		? hasFolderDetails(renderedFolder)
			? renderedFolder
			: resolvedFolder
		: null;
	const loadingText = t("info_loading");
	const isShared =
		renderedFile && "is_shared" in renderedFile
			? renderedFile.is_shared
			: renderedFolder && "is_shared" in renderedFolder
				? renderedFolder.is_shared
				: null;

	const title = renderedFile
		? (activeFile ?? renderedFile).name
		: ((activeFolder ?? renderedFolder)?.name ?? "");
	const targetKey = renderedFile
		? `file:${renderedFile.id}`
		: renderedFolder
			? `folder:${renderedFolder.id}`
			: null;
	const resolvedLocked = renderedFile
		? (renderedFile.is_locked ?? activeFile?.is_locked ?? false)
		: renderedFolder
			? (renderedFolder.is_locked ?? activeFolder?.is_locked ?? false)
			: false;
	const currentLocked = optimisticLocked ?? resolvedLocked;

	const summaryLabel = renderedFile ? t("core:file") : t("core:folder");
	const summarySubtitle = renderedFile
		? formatBytes((activeFile ?? renderedFile).size)
		: childCount != null
			? t("info_children_count", {
					folders: childCount.folders,
					files: childCount.files,
				})
			: folderDetailsLoading
				? loadingText
				: t("core:folder");

	const overviewRows: DetailRow[] = renderedFile
		? [
				{ label: t("info_type"), value: t("core:file") },
				{
					label: t("info_size"),
					value: formatBytes((activeFile ?? renderedFile).size),
				},
				{
					label: t("info_mime"),
					value: (activeFile ?? renderedFile).mime_type,
				},
				{
					label: t("info_created"),
					value: formatValueOrFallback(
						activeFile?.created_at
							? formatDateAbsolute(activeFile.created_at)
							: null,
						fileDetailsLoading,
						loadingText,
					),
				},
				{
					label: t("info_modified"),
					value: formatDateAbsolute((activeFile ?? renderedFile).updated_at),
				},
			]
		: renderedFolder
			? [
					{ label: t("info_type"), value: t("core:folder") },
					{
						label: t("info_children"),
						value:
							childCount != null
								? t("info_children_count", {
										folders: childCount.folders,
										files: childCount.files,
									})
								: loadingText,
					},
					{
						label: t("info_created"),
						value: formatValueOrFallback(
							activeFolder?.created_at
								? formatDateAbsolute(activeFolder.created_at)
								: null,
							folderDetailsLoading,
							loadingText,
						),
					},
					{
						label: t("info_modified"),
						value: formatDateAbsolute(
							(activeFolder ?? renderedFolder).updated_at,
						),
					},
				]
			: [];

	const statusRows: DetailRow[] = [
		{
			label: t("info_locked"),
			value: currentLocked ? t("info_locked_yes") : t("info_locked_no"),
		},
		{
			label: t("info_shared"),
			value:
				isShared == null
					? "—"
					: isShared
						? t("info_shared_yes")
						: t("info_shared_no"),
		},
	];

	useEffect(() => {
		if (optimisticLocked !== null && optimisticLocked === resolvedLocked) {
			setOptimisticLocked(null);
		}
	}, [optimisticLocked, resolvedLocked]);

	useEffect(() => {
		if (targetKey == null) {
			setOptimisticLocked(null);
			return;
		}
		setOptimisticLocked(null);
	}, [targetKey]);

	const handleQuickLockToggle = async () => {
		if (!onToggleLock || (!renderedFile && !renderedFolder)) {
			return;
		}

		const targetId = renderedFile?.id ?? renderedFolder?.id;
		if (targetId == null) {
			return;
		}

		const nextLocked = !currentLocked;
		setOptimisticLocked(nextLocked);

		const result = await onToggleLock(
			renderedFile ? "file" : "folder",
			targetId,
			currentLocked,
		);

		if (result === false) {
			setOptimisticLocked(null);
		}
	};

	const quickActions: QuickAction[] = renderedFile
		? [
				onPreview
					? {
							icon: "Eye",
							label: t("preview"),
							onClick: () => onPreview(activeFile ?? renderedFile),
						}
					: null,
				onDownload
					? {
							icon: "Download",
							label: t("download"),
							onClick: () => onDownload((activeFile ?? renderedFile).id, title),
						}
					: null,
				onShare
					? {
							icon: "Link",
							label: t("share"),
							onClick: () =>
								onShare({
									fileId: (activeFile ?? renderedFile).id,
									name: title,
									initialMode: "page",
								}),
						}
					: null,
				onRename
					? {
							icon: "PencilSimple",
							label: t("rename"),
							onClick: () =>
								onRename("file", (activeFile ?? renderedFile).id, title),
						}
					: null,
				onVersions
					? {
							icon: "Clock",
							label: t("versions"),
							onClick: () => onVersions((activeFile ?? renderedFile).id),
						}
					: null,
				onToggleLock
					? {
							icon: currentLocked ? "LockOpen" : "Lock",
							label: currentLocked ? t("unlock") : t("lock"),
							onClick: () => {
								void handleQuickLockToggle();
							},
						}
					: null,
			].filter((action): action is QuickAction => action != null)
		: renderedFolder
			? [
					onOpenFolder
						? {
								icon: "FolderOpen",
								label: t("open"),
								onClick: () => onOpenFolder(activeFolder ?? renderedFolder),
							}
						: null,
					onShare
						? {
								icon: "Link",
								label: t("share"),
								onClick: () =>
									onShare({
										folderId: (activeFolder ?? renderedFolder).id,
										name: title,
										initialMode: "page",
									}),
							}
						: null,
					onRename
						? {
								icon: "PencilSimple",
								label: t("rename"),
								onClick: () =>
									onRename(
										"folder",
										(activeFolder ?? renderedFolder).id,
										title,
									),
							}
						: null,
					onToggleLock
						? {
								icon: currentLocked ? "LockOpen" : "Lock",
								label: currentLocked ? t("unlock") : t("lock"),
								onClick: () => {
									void handleQuickLockToggle();
								},
							}
						: null,
				].filter((action): action is QuickAction => action != null)
			: [];

	if (
		(isDesktop && !open && !desktopMounted) ||
		(!renderedFile && !renderedFolder)
	) {
		return null;
	}

	const content = (
		<div className="space-y-4 p-4">
			<Section className="gap-0 space-y-4 bg-gradient-to-br from-background via-background to-muted/30">
				<div className="flex items-start gap-3">
					<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
						{renderedFile ? (
							<FileTypeIcon
								mimeType={(activeFile ?? renderedFile).mime_type}
								fileName={(activeFile ?? renderedFile).name}
								className="h-8 w-8"
							/>
						) : (
							<Icon name="Folder" className="h-8 w-8 text-amber-500" />
						)}
					</div>
					<div className="min-w-0 flex-1 space-y-2">
						<div className="space-y-1">
							<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
								{summaryLabel}
							</p>
							{isDesktop ? (
								<h2 className="line-clamp-2 text-lg font-semibold text-foreground">
									{title}
								</h2>
							) : (
								<p className="line-clamp-2 text-lg font-semibold text-foreground">
									{title}
								</p>
							)}
							<p className="text-sm text-muted-foreground">{summarySubtitle}</p>
						</div>
						<FileItemStatusIndicators
							isLocked={currentLocked}
							isShared={isShared ?? false}
						/>
					</div>
					{isDesktop ? (
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={() => onOpenChange(false)}
							aria-label={t("close")}
						>
							<Icon name="X" className="h-4 w-4" />
						</Button>
					) : null}
				</div>
			</Section>

			{quickActions.length > 0 ? (
				<Section title={t("info_actions")}>
					<ActionGrid actions={quickActions} />
				</Section>
			) : null}

			<Section title={t("info_overview")}>
				<DetailList rows={overviewRows} />
			</Section>

			<Section title={t("info_status")}>
				<DetailList rows={statusRows} />
			</Section>
		</div>
	);

	if (isDesktop) {
		return (
			<div
				className={cn(
					"hidden h-full min-h-0 flex-none overflow-hidden transition-[width] duration-280 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none lg:block",
					desktopVisible ? "w-[22rem]" : "pointer-events-none w-0",
				)}
			>
				<aside
					className={cn(
						"h-full min-h-0 w-[22rem] border-l bg-muted/20 transition-[opacity,transform] duration-280 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
						desktopVisible
							? "translate-x-0 opacity-100"
							: "translate-x-3 opacity-0",
					)}
					aria-label={t("info")}
				>
					<ScrollArea className="min-h-0 flex-1">{content}</ScrollArea>
				</aside>
			</div>
		);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			onOpenChangeComplete={handleOpenChangeComplete}
		>
			<DialogContent
				keepMounted
				className="w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] gap-0 overflow-hidden p-0 sm:w-full sm:max-w-lg"
			>
				<DialogHeader className="sr-only">
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				<ScrollArea className="max-h-[min(80vh,42rem)]">{content}</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
