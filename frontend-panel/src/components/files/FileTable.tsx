import { useVirtualizer } from "@tanstack/react-virtual";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFileBrowserContext } from "@/components/files/FileBrowserContext";
import { FileBrowserItemContextMenu } from "@/components/files/FileBrowserItemContextMenu";
import {
	FileNameCell,
	FileSizeCell,
	FolderNameCell,
	FolderSizeCell,
	UpdatedAtCell,
} from "@/components/files/FileTableCells";
import { Icon } from "@/components/ui/icon";
import { ItemCheckbox } from "@/components/ui/item-checkbox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { DRAG_SOURCE_MIME } from "@/lib/constants";
import {
	getInvalidInternalDropReason,
	hasInternalDragData,
	readInternalDragData,
	setInternalDragPreview,
	writeInternalDragData,
} from "@/lib/dragDrop";
import { cn } from "@/lib/utils";
import type { SortBy } from "@/stores/fileStore";
import { useFileStore } from "@/stores/fileStore";
import type { FileListItem, FolderListItem } from "@/types/api";

interface FileTableProps {
	scrollElement?: HTMLDivElement | null;
}

type TableRowItem =
	| { type: "folder"; item: FolderListItem }
	| { type: "file"; item: FileListItem };

const TABLE_COLUMN_COUNT = 4;
const TABLE_ROW_ESTIMATE = 52;

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
		<Icon name="SortAscending" className="h-3 w-3 ml-1" />
	) : (
		<Icon name="SortDescending" className="h-3 w-3 ml-1" />
	);
}

export function FileTable({ scrollElement }: FileTableProps) {
	const { t } = useTranslation("files");
	const {
		breadcrumbPathIds,
		browserOpenMode,
		fadingFileIds,
		fadingFolderIds,
		files,
		folders,
		onFileClick,
		onFolderOpen,
		onMoveToFolder,
	} = useFileBrowserContext();
	const selectedFileIds = useFileStore((s) => s.selectedFileIds);
	const selectedFolderIds = useFileStore((s) => s.selectedFolderIds);
	const toggleFileSelection = useFileStore((s) => s.toggleFileSelection);
	const toggleFolderSelection = useFileStore((s) => s.toggleFolderSelection);
	const selectOnlyFile = useFileStore((s) => s.selectOnlyFile);
	const selectOnlyFolder = useFileStore((s) => s.selectOnlyFolder);
	const selectAll = useFileStore((s) => s.selectAll);
	const clearSelection = useFileStore((s) => s.clearSelection);
	const sortBy = useFileStore((s) => s.sortBy);
	const sortOrder = useFileStore((s) => s.sortOrder);
	const setSortBy = useFileStore((s) => s.setSortBy);
	const setSortOrder = useFileStore((s) => s.setSortOrder);

	const allSelected =
		folders.length + files.length > 0 &&
		selectedFileIds.size === files.length &&
		selectedFolderIds.size === folders.length;

	const handleSort = (col: SortBy) => {
		if (sortBy === col) {
			setSortOrder(sortOrder === "asc" ? "desc" : "asc");
		} else {
			setSortBy(col);
		}
	};

	const handleSelectAll = () => {
		if (allSelected) clearSelection();
		else selectAll();
	};

	const [dragOverId, setDragOverId] = useState<number | null>(null);

	const makeDragData = (itemId: number, isFolder: boolean) => {
		const isSelected = isFolder
			? selectedFolderIds.has(itemId)
			: selectedFileIds.has(itemId);
		if (isSelected && selectedFileIds.size + selectedFolderIds.size > 1) {
			return {
				fileIds: [...selectedFileIds],
				folderIds: [...selectedFolderIds],
			};
		}
		return isFolder
			? { fileIds: [], folderIds: [itemId] }
			: { fileIds: [itemId], folderIds: [] };
	};

	const handleDragStart = (
		e: React.DragEvent,
		itemId: number,
		isFolder: boolean,
	) => {
		const data = makeDragData(itemId, isFolder);
		writeInternalDragData(e.dataTransfer, data);
		setInternalDragPreview(e, {
			variant: "list-row",
			itemCount: data.fileIds.length + data.folderIds.length,
		});
	};

	const getTargetPathIds = (folderId: number) => [
		...breadcrumbPathIds,
		folderId,
	];

	const handleFolderDragOver = (e: React.DragEvent, folderId: number) => {
		if (
			!hasInternalDragData(e.dataTransfer) ||
			e.dataTransfer.types.includes(DRAG_SOURCE_MIME)
		) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		e.dataTransfer.dropEffect = "move";
		setDragOverId(folderId);
	};

	const handleFolderDrop = (e: React.DragEvent, folderId: number) => {
		setDragOverId(null);
		if (e.dataTransfer.types.includes(DRAG_SOURCE_MIME)) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		const data = readInternalDragData(e.dataTransfer);
		if (!data) return;
		const targetPathIds = getTargetPathIds(folderId);
		if (getInvalidInternalDropReason(data, folderId, targetPathIds) !== null) {
			return;
		}
		onMoveToFolder?.(data.fileIds, data.folderIds, folderId);
	};

	const renderFolderRow = (folder: FolderListItem) => (
		<FileBrowserItemContextMenu
			renderTrigger
			key={`folder-${folder.id}`}
			item={folder}
			isFolder
		>
			<TableRow
				data-folder-drop-target="true"
				className={cn(
					"cursor-pointer transition-[background-color,box-shadow,opacity] duration-150 ease-out",
					dragOverId === folder.id && "ring-2 ring-primary bg-accent/30",
					fadingFolderIds?.has(folder.id) && "opacity-0",
				)}
				draggable
				onDragStart={(e) => handleDragStart(e, folder.id, true)}
				onDragOver={(e) => handleFolderDragOver(e, folder.id)}
				onDragLeave={() => setDragOverId(null)}
				onDrop={(e) => handleFolderDrop(e, folder.id)}
				onClick={() => {
					if (browserOpenMode === "double_click") {
						selectOnlyFolder(folder.id);
						return;
					}
					onFolderOpen(folder.id, folder.name);
				}}
				onDoubleClick={
					browserOpenMode === "double_click"
						? () => onFolderOpen(folder.id, folder.name)
						: undefined
				}
			>
				<TableCell
					className="w-12 pr-0 first:pl-3 md:first:pl-3"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="flex justify-center">
						<ItemCheckbox
							checked={selectedFolderIds.has(folder.id)}
							onChange={() => toggleFolderSelection(folder.id)}
						/>
					</div>
				</TableCell>
				<FolderNameCell folder={folder} />
				<FolderSizeCell />
				<UpdatedAtCell updatedAt={folder.updated_at} />
			</TableRow>
		</FileBrowserItemContextMenu>
	);

	const renderFileRow = (file: FileListItem) => (
		<FileBrowserItemContextMenu
			renderTrigger
			key={`file-${file.id}`}
			item={file}
			isFolder={false}
		>
			<TableRow
				className={cn(
					"cursor-pointer transition-[background-color,box-shadow,opacity] duration-150 ease-out",
					fadingFileIds?.has(file.id) && "opacity-0",
				)}
				draggable
				onDragStart={(e) => handleDragStart(e, file.id, false)}
				onClick={() => {
					if (browserOpenMode === "double_click") {
						selectOnlyFile(file.id);
						return;
					}
					onFileClick(file);
				}}
				onDoubleClick={
					browserOpenMode === "double_click"
						? () => onFileClick(file)
						: undefined
				}
			>
				<TableCell
					className="w-12 pr-0 first:pl-3 md:first:pl-3"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="flex justify-center">
						<ItemCheckbox
							checked={selectedFileIds.has(file.id)}
							onChange={() => toggleFileSelection(file.id)}
						/>
					</div>
				</TableCell>
				<FileNameCell file={file} />
				<FileSizeCell size={file.size} />
				<UpdatedAtCell updatedAt={file.updated_at} />
			</TableRow>
		</FileBrowserItemContextMenu>
	);

	const tableRows = useMemo<TableRowItem[]>(
		() => [
			...folders.map((item) => ({ type: "folder", item }) as const),
			...files.map((item) => ({ type: "file", item }) as const),
		],
		[files, folders],
	);

	const virtualizer = useVirtualizer({
		count: scrollElement ? tableRows.length : 0,
		getScrollElement: () => scrollElement ?? null,
		estimateSize: () => TABLE_ROW_ESTIMATE,
		overscan: 10,
	});

	useEffect(() => {
		if (!scrollElement) return;
		virtualizer.measure();
	}, [scrollElement, virtualizer]);

	const renderSpacerRow = (key: string, height: number) => (
		<TableRow key={key} aria-hidden className="border-0 hover:bg-transparent">
			<TableCell
				colSpan={TABLE_COLUMN_COUNT}
				className="p-0 first:pl-0 last:pr-0 md:first:pl-0 md:last:pr-0"
				style={{ height }}
			/>
		</TableRow>
	);

	const renderRows = () => {
		if (!scrollElement) {
			return (
				<>
					{folders.map(renderFolderRow)}
					{files.map(renderFileRow)}
				</>
			);
		}

		const virtualRows = virtualizer.getVirtualItems();
		const firstVirtualRow = virtualRows[0];
		const lastVirtualRow = virtualRows[virtualRows.length - 1];
		const paddingTop = firstVirtualRow?.start ?? 0;
		const paddingBottom = Math.max(
			0,
			virtualizer.getTotalSize() - (lastVirtualRow?.end ?? 0),
		);

		return (
			<>
				{paddingTop > 0 && renderSpacerRow("spacer-top", paddingTop)}
				{virtualRows.map((virtualRow) => {
					const row = tableRows[virtualRow.index];
					if (!row) return null;
					return row.type === "folder"
						? renderFolderRow(row.item)
						: renderFileRow(row.item);
				})}
				{paddingBottom > 0 && renderSpacerRow("spacer-bottom", paddingBottom)}
			</>
		);
	};

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="w-12 pr-0 first:pl-3 md:first:pl-3">
						<div className="flex justify-center">
							<ItemCheckbox checked={allSelected} onChange={handleSelectAll} />
						</div>
					</TableHead>
					<TableHead
						className="cursor-pointer select-none"
						onClick={() => handleSort("name")}
					>
						<div className="flex items-center">
							{t("core:name")}
							<SortIcon column="name" current={sortBy} order={sortOrder} />
						</div>
					</TableHead>
					<TableHead
						className="w-[100px] cursor-pointer select-none"
						onClick={() => handleSort("size")}
					>
						<div className="flex items-center">
							{t("core:size")}
							<SortIcon column="size" current={sortBy} order={sortOrder} />
						</div>
					</TableHead>
					<TableHead
						className="cursor-pointer select-none"
						onClick={() => handleSort("created_at")}
					>
						<div className="flex items-center">
							{t("core:date")}
							<SortIcon
								column="created_at"
								current={sortBy}
								order={sortOrder}
							/>
						</div>
					</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>{renderRows()}</TableBody>
		</Table>
	);
}
