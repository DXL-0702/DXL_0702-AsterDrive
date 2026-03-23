import { useTranslation } from "react-i18next";
import { FileCard } from "@/components/files/FileCard";
import { FileContextMenu } from "@/components/files/FileContextMenu";
import { useFileStore } from "@/stores/fileStore";
import type { FileInfo, FolderInfo } from "@/types/api";

interface FileGridProps {
	folders: FolderInfo[];
	files: FileInfo[];
	onFolderOpen: (id: number, name: string) => void;
	onFileClick: (file: FileInfo) => void;
	onShare: (target: {
		fileId?: number;
		folderId?: number;
		name: string;
	}) => void;
	onDownload: (fileId: number, fileName: string) => void;
	onCopy: (type: "file" | "folder", id: number) => void;
	onToggleLock: (type: "file" | "folder", id: number, locked: boolean) => void;
	onDelete: (type: "file" | "folder", id: number) => void;
	onVersions?: (fileId: number) => void;
}

const GRID_CLASSES =
	"grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3";

export function FileGrid({
	folders,
	files,
	onFolderOpen,
	onFileClick,
	onShare,
	onDownload,
	onCopy,
	onToggleLock,
	onDelete,
	onVersions,
}: FileGridProps) {
	const { t } = useTranslation("files");
	const selectedFileIds = useFileStore((s) => s.selectedFileIds);
	const selectedFolderIds = useFileStore((s) => s.selectedFolderIds);
	const toggleFileSelection = useFileStore((s) => s.toggleFileSelection);
	const toggleFolderSelection = useFileStore((s) => s.toggleFolderSelection);

	const hasBoth = folders.length > 0 && files.length > 0;

	return (
		<div className="p-4 space-y-4">
			{folders.length > 0 && (
				<div className="space-y-2">
					{hasBoth && (
						<h3 className="text-sm font-medium text-muted-foreground px-1">
							{t("folders_section")}
						</h3>
					)}
					<div className={GRID_CLASSES}>
						{folders.map((folder) => (
							<FileContextMenu
								key={`folder-${folder.id}`}
								isFolder
								isLocked={folder.is_locked ?? false}
								onShare={() =>
									onShare({ folderId: folder.id, name: folder.name })
								}
								onCopy={() => onCopy("folder", folder.id)}
								onToggleLock={() =>
									onToggleLock("folder", folder.id, folder.is_locked ?? false)
								}
								onDelete={() => onDelete("folder", folder.id)}
							>
								<FileCard
									item={folder}
									isFolder
									selected={selectedFolderIds.has(folder.id)}
									onSelect={() => toggleFolderSelection(folder.id)}
									onClick={() => onFolderOpen(folder.id, folder.name)}
								/>
							</FileContextMenu>
						))}
					</div>
				</div>
			)}

			{files.length > 0 && (
				<div className="space-y-2">
					{hasBoth && (
						<h3 className="text-sm font-medium text-muted-foreground px-1">
							{t("files_section")}
						</h3>
					)}
					<div className={GRID_CLASSES}>
						{files.map((file) => (
							<FileContextMenu
								key={`file-${file.id}`}
								isFolder={false}
								isLocked={file.is_locked ?? false}
								onDownload={() => onDownload(file.id, file.name)}
								onShare={() => onShare({ fileId: file.id, name: file.name })}
								onCopy={() => onCopy("file", file.id)}
								onToggleLock={() =>
									onToggleLock("file", file.id, file.is_locked ?? false)
								}
								onDelete={() => onDelete("file", file.id)}
								onVersions={onVersions ? () => onVersions(file.id) : undefined}
							>
								<FileCard
									item={file}
									isFolder={false}
									selected={selectedFileIds.has(file.id)}
									onSelect={() => toggleFileSelection(file.id)}
									onClick={() => onFileClick(file)}
								/>
							</FileContextMenu>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
