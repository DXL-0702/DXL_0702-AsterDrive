import {
	Copy,
	Download,
	History,
	Link,
	Lock,
	Pencil,
	Trash2,
	Unlock,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface FileContextMenuProps {
	children: ReactNode;
	onDownload?: () => void;
	onShare: () => void;
	onCopy: () => void;
	onToggleLock: () => void;
	onDelete: () => void;
	onRename?: () => void;
	onVersions?: () => void;
	isLocked: boolean;
	isFolder: boolean;
}

export function FileContextMenu({
	children,
	onDownload,
	onShare,
	onCopy,
	onRename,
	onToggleLock,
	onDelete,
	onVersions,
	isLocked,
	isFolder,
}: FileContextMenuProps) {
	const { t } = useTranslation("files");

	return (
		<ContextMenu>
			<ContextMenuTrigger className="w-full">{children}</ContextMenuTrigger>
			<ContextMenuContent>
				{!isFolder && onDownload && (
					<ContextMenuItem onClick={onDownload}>
						<Download className="h-4 w-4 mr-2" />
						{t("download")}
					</ContextMenuItem>
				)}
				<ContextMenuItem onClick={onShare}>
					<Link className="h-4 w-4 mr-2" />
					{t("share")}
				</ContextMenuItem>
				<ContextMenuItem onClick={onCopy}>
					<Copy className="h-4 w-4 mr-2" />
					{t("copy")}
				</ContextMenuItem>
				{onRename && (
					<ContextMenuItem onClick={onRename}>
						<Pencil className="h-4 w-4 mr-2" />
						{t("rename")}
					</ContextMenuItem>
				)}
				{!isFolder && onVersions && (
					<ContextMenuItem onClick={onVersions}>
						<History className="h-4 w-4 mr-2" />
						{t("versions")}
					</ContextMenuItem>
				)}
				<ContextMenuSeparator />
				<ContextMenuItem onClick={onToggleLock}>
					{isLocked ? (
						<>
							<Unlock className="h-4 w-4 mr-2" />
							{t("unlock")}
						</>
					) : (
						<>
							<Lock className="h-4 w-4 mr-2" />
							{t("lock")}
						</>
					)}
				</ContextMenuItem>
				<ContextMenuItem
					onClick={onDelete}
					disabled={isLocked}
					className="text-destructive"
				>
					<Trash2 className="h-4 w-4 mr-2" />
					{t("common:delete")}
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
