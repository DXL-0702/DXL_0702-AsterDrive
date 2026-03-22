import { ArrowDown, ArrowUp, Folder } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FileContextMenu } from "@/components/files/FileContextMenu";
import { FileThumbnail } from "@/components/files/FileThumbnail";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SortBy } from "@/stores/fileStore";
import { useFileStore } from "@/stores/fileStore";
import type { FileInfo, FolderInfo } from "@/types/api";

interface FileTableProps {
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

function SortIcon({
	column,
	current,
	order,
}: {
	column: SortBy;
	current: SortBy;
	order: "asc" | "desc";
}) {
	if (column !== current) return null;
	return order === "asc" ? (
		<ArrowUp className="h-3 w-3 ml-1" />
	) : (
		<ArrowDown className="h-3 w-3 ml-1" />
	);
}

export function FileTable({
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
}: FileTableProps) {
	const { t } = useTranslation("files");
	const selectedFileIds = useFileStore((s) => s.selectedFileIds);
	const selectedFolderIds = useFileStore((s) => s.selectedFolderIds);
	const toggleFileSelection = useFileStore((s) => s.toggleFileSelection);
	const toggleFolderSelection = useFileStore((s) => s.toggleFolderSelection);
	const selectAll = useFileStore((s) => s.selectAll);
	const clearSelection = useFileStore((s) => s.clearSelection);
	const sortBy = useFileStore((s) => s.sortBy);
	const sortOrder = useFileStore((s) => s.sortOrder);
	const setSortBy = useFileStore((s) => s.setSortBy);
	const toggleSortOrder = useFileStore((s) => s.toggleSortOrder);

	const allSelected =
		folders.length + files.length > 0 &&
		selectedFileIds.size === files.length &&
		selectedFolderIds.size === folders.length;

	const handleSort = (col: SortBy) => {
		if (sortBy === col) {
			toggleSortOrder();
		} else {
			setSortBy(col);
		}
	};

	const handleSelectAll = () => {
		if (allSelected) clearSelection();
		else selectAll();
	};

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="w-10">
						{/* biome-ignore lint/a11y/useSemanticElements: custom styled checkbox */}
						<div
							className={cn(
								"h-4 w-4 rounded border flex items-center justify-center cursor-pointer",
								allSelected
									? "bg-primary border-primary"
									: "border-muted-foreground",
							)}
							onClick={handleSelectAll}
							onKeyDown={() => {}}
							role="checkbox"
							aria-checked={allSelected}
							tabIndex={0}
						>
							{allSelected && (
								// biome-ignore lint/a11y/noSvgWithoutTitle: decorative checkmark
								<svg
									viewBox="0 0 12 12"
									className="h-3 w-3 text-primary-foreground"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<polyline points="2,6 5,9 10,3" />
								</svg>
							)}
						</div>
					</TableHead>
					<TableHead
						className="cursor-pointer select-none"
						onClick={() => handleSort("name")}
					>
						<div className="flex items-center">
							{t("common:name")}
							<SortIcon column="name" current={sortBy} order={sortOrder} />
						</div>
					</TableHead>
					<TableHead
						className="cursor-pointer select-none"
						onClick={() => handleSort("date")}
					>
						<div className="flex items-center">
							{t("common:date")}
							<SortIcon column="date" current={sortBy} order={sortOrder} />
						</div>
					</TableHead>
					<TableHead className="w-[100px]">{t("common:type")}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{folders.map((folder) => (
					<FileContextMenu
						key={`folder-${folder.id}`}
						isFolder
						isLocked={folder.is_locked ?? false}
						onShare={() =>
							onShare({
								folderId: folder.id,
								name: folder.name,
							})
						}
						onCopy={() => onCopy("folder", folder.id)}
						onToggleLock={() =>
							onToggleLock("folder", folder.id, folder.is_locked ?? false)
						}
						onDelete={() => onDelete("folder", folder.id)}
					>
						<TableRow
							className="cursor-pointer"
							onClick={() => onFolderOpen(folder.id, folder.name)}
						>
							<TableCell onClick={(e) => e.stopPropagation()}>
								{/* biome-ignore lint/a11y/useSemanticElements: custom styled checkbox */}
								<div
									className={cn(
										"h-4 w-4 rounded border flex items-center justify-center cursor-pointer",
										selectedFolderIds.has(folder.id)
											? "bg-primary border-primary"
											: "border-muted-foreground/50",
									)}
									onClick={() => toggleFolderSelection(folder.id)}
									onKeyDown={() => {}}
									role="checkbox"
									aria-checked={selectedFolderIds.has(folder.id)}
									tabIndex={-1}
								>
									{selectedFolderIds.has(folder.id) && (
										// biome-ignore lint/a11y/noSvgWithoutTitle: decorative checkmark
										<svg
											viewBox="0 0 12 12"
											className="h-3 w-3 text-primary-foreground"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
										>
											<polyline points="2,6 5,9 10,3" />
										</svg>
									)}
								</div>
							</TableCell>
							<TableCell>
								<div className="flex items-center gap-2">
									<Folder className="h-4 w-4 text-primary/70 shrink-0" />
									<span className="truncate">{folder.name}</span>
								</div>
							</TableCell>
							<TableCell className="text-muted-foreground">
								{formatDate(folder.updated_at)}
							</TableCell>
							<TableCell className="text-muted-foreground">Folder</TableCell>
						</TableRow>
					</FileContextMenu>
				))}
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
						<TableRow
							className="cursor-pointer"
							onClick={() => onFileClick(file)}
						>
							<TableCell onClick={(e) => e.stopPropagation()}>
								{/* biome-ignore lint/a11y/useSemanticElements: custom styled checkbox */}
								<div
									className={cn(
										"h-4 w-4 rounded border flex items-center justify-center cursor-pointer",
										selectedFileIds.has(file.id)
											? "bg-primary border-primary"
											: "border-muted-foreground/50",
									)}
									onClick={() => toggleFileSelection(file.id)}
									onKeyDown={() => {}}
									role="checkbox"
									aria-checked={selectedFileIds.has(file.id)}
									tabIndex={-1}
								>
									{selectedFileIds.has(file.id) && (
										// biome-ignore lint/a11y/noSvgWithoutTitle: decorative checkmark
										<svg
											viewBox="0 0 12 12"
											className="h-3 w-3 text-primary-foreground"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
										>
											<polyline points="2,6 5,9 10,3" />
										</svg>
									)}
								</div>
							</TableCell>
							<TableCell>
								<div className="flex items-center gap-2">
									<FileThumbnail file={file} size="sm" />
									<span className="truncate">{file.name}</span>
								</div>
							</TableCell>
							<TableCell className="text-muted-foreground">
								{formatDate(file.updated_at)}
							</TableCell>
							<TableCell className="text-muted-foreground text-xs">
								{file.mime_type}
							</TableCell>
						</TableRow>
					</FileContextMenu>
				))}
			</TableBody>
		</Table>
	);
}
