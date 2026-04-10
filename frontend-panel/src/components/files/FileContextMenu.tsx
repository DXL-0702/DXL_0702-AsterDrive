import type { ReactNode } from "react";
import { isValidElement } from "react";
import { useTranslation } from "react-i18next";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Icon } from "@/components/ui/icon";

interface FileContextMenuProps {
	children: ReactNode;
	onDownload?: () => void;
	onArchiveDownload?: () => void;
	onPageShare: () => void;
	onDirectShare?: () => void;
	onCopy: () => void;
	onMove?: () => void;
	onToggleLock: () => void;
	onDelete: () => void;
	onRename?: () => void;
	onVersions?: () => void;
	onInfo: () => void;
	isLocked: boolean;
	isFolder: boolean;
	renderTrigger?: boolean;
}

export function FileContextMenu({
	children,
	onDownload,
	onArchiveDownload,
	onPageShare,
	onDirectShare,
	onCopy,
	onMove,
	onRename,
	onToggleLock,
	onDelete,
	onVersions,
	onInfo,
	isLocked,
	isFolder,
	renderTrigger = false,
}: FileContextMenuProps) {
	const { t } = useTranslation(["files", "share", "tasks"]);

	const trigger =
		renderTrigger && isValidElement(children) ? (
			<ContextMenuTrigger render={children} />
		) : (
			<ContextMenuTrigger className="w-full">{children}</ContextMenuTrigger>
		);

	return (
		<ContextMenu>
			{trigger}
			<ContextMenuContent>
				{!isFolder && onDownload && (
					<ContextMenuItem onClick={onDownload}>
						<Icon name="Download" className="h-4 w-4 mr-2" />
						{t("download")}
					</ContextMenuItem>
				)}
				{isFolder && onArchiveDownload && (
					<ContextMenuItem onClick={onArchiveDownload}>
						<Icon name="Download" className="h-4 w-4 mr-2" />
						{t("tasks:archive_download_action")}
					</ContextMenuItem>
				)}
				<ContextMenuItem onClick={onPageShare}>
					<Icon name="Link" className="h-4 w-4 mr-2" />
					{t("share:share_mode_page")}
				</ContextMenuItem>
				{!isFolder && onDirectShare && (
					<ContextMenuItem onClick={onDirectShare}>
						<Icon name="LinkSimple" className="h-4 w-4 mr-2" />
						{t("share:share_mode_direct")}
					</ContextMenuItem>
				)}
				<ContextMenuItem onClick={onCopy}>
					<Icon name="Copy" className="h-4 w-4 mr-2" />
					{t("copy")}
				</ContextMenuItem>
				{onMove && (
					<ContextMenuItem onClick={onMove}>
						<Icon name="ArrowsOutCardinal" className="h-4 w-4 mr-2" />
						{t("move")}
					</ContextMenuItem>
				)}
				{onRename && (
					<ContextMenuItem onClick={onRename}>
						<Icon name="PencilSimple" className="h-4 w-4 mr-2" />
						{t("rename")}
					</ContextMenuItem>
				)}
				{!isFolder && onVersions && (
					<ContextMenuItem onClick={onVersions}>
						<Icon name="Clock" className="h-4 w-4 mr-2" />
						{t("versions")}
					</ContextMenuItem>
				)}
				<ContextMenuSeparator />
				<ContextMenuItem onClick={onInfo}>
					<Icon name="Info" className="h-4 w-4 mr-2" />
					{t("info")}
				</ContextMenuItem>
				<ContextMenuItem onClick={onToggleLock}>
					{isLocked ? (
						<>
							<Icon name="LockOpen" className="h-4 w-4 mr-2" />
							{t("unlock")}
						</>
					) : (
						<>
							<Icon name="Lock" className="h-4 w-4 mr-2" />
							{t("lock")}
						</>
					)}
				</ContextMenuItem>
				<ContextMenuItem
					onClick={onDelete}
					disabled={isLocked}
					className="text-destructive"
				>
					<Icon name="Trash" className="h-4 w-4 mr-2" />
					{t("core:delete")}
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
