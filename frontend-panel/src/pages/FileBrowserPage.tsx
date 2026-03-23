import { FolderOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BatchActionBar } from "@/components/common/BatchActionBar";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ViewToggle } from "@/components/common/ViewToggle";
import { CreateFolderDialog } from "@/components/files/CreateFolderDialog";
import { FileGrid } from "@/components/files/FileGrid";
import { FilePreview } from "@/components/files/FilePreview";
import { FileTable } from "@/components/files/FileTable";
import { ShareDialog } from "@/components/files/ShareDialog";
import { UploadArea } from "@/components/files/UploadArea";
import { VersionHistoryDialog } from "@/components/files/VersionHistoryDialog";
import { AppLayout } from "@/components/layout/AppLayout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { handleApiError } from "@/hooks/useApiError";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { fileService } from "@/services/fileService";
import { useFileStore } from "@/stores/fileStore";
import type { FileInfo } from "@/types/api";
import { api } from "@/services/http";

export default function FileBrowserPage() {
	const { t } = useTranslation("files");
	const navigateTo = useFileStore((s) => s.navigateTo);
	const refresh = useFileStore((s) => s.refresh);
	const folders = useFileStore((s) => s.folders);
	const files = useFileStore((s) => s.files);
	const loading = useFileStore((s) => s.loading);
	const viewMode = useFileStore((s) => s.viewMode);
	const setViewMode = useFileStore((s) => s.setViewMode);

	useKeyboardShortcuts();

	const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
	const [shareTarget, setShareTarget] = useState<{
		fileId?: number;
		folderId?: number;
		name: string;
	} | null>(null);
	const [versionFileId, setVersionFileId] = useState<number | null>(null);

	useEffect(() => {
		navigateTo(null).catch(handleApiError);
	}, [navigateTo]);

	const handleDownload = useCallback(
		async (fileId: number, fileName: string) => {
			try {
				const res = await api.client.get(fileService.downloadPath(fileId), {
					responseType: "blob",
				});
				const objectUrl = URL.createObjectURL(res.data);
				const a = document.createElement("a");
				a.href = objectUrl;
				a.download = fileName;
				a.click();
				URL.revokeObjectURL(objectUrl);
			} catch (err) {
				handleApiError(err);
			}
		},
		[],
	);

	const handleCopy = useCallback(
		async (type: "file" | "folder", id: number) => {
			try {
				if (type === "file") await fileService.copyFile(id);
				else await fileService.copyFolder(id);
				toast.success(t("copy"));
				refresh();
			} catch (err) {
				handleApiError(err);
			}
		},
		[refresh, t],
	);

	const handleToggleLock = useCallback(
		async (type: "file" | "folder", id: number, locked: boolean) => {
			try {
				if (type === "file") await fileService.setFileLock(id, !locked);
				else await fileService.setFolderLock(id, !locked);
				toast.success(!locked ? t("lock") : t("unlock"));
				refresh();
			} catch (err) {
				handleApiError(err);
			}
		},
		[refresh, t],
	);

	const handleDelete = useCallback(
		async (type: "file" | "folder", id: number) => {
			try {
				if (type === "file") await useFileStore.getState().deleteFile(id);
				else await useFileStore.getState().deleteFolder(id);
				toast.success(t("common:delete"));
			} catch (err) {
				handleApiError(err);
			}
		},
		[t],
	);

	const sharedProps = {
		folders,
		files,
		onFolderOpen: (id: number, name: string) => navigateTo(id, name),
		onFileClick: (file: FileInfo) => setPreviewFile(file),
		onShare: setShareTarget,
		onDownload: handleDownload,
		onCopy: handleCopy,
		onToggleLock: handleToggleLock,
		onDelete: handleDelete,
		onVersions: (fileId: number) => setVersionFileId(fileId),
	};

	const isEmpty = !loading && folders.length === 0 && files.length === 0;

	return (
		<AppLayout
			actions={
				<>
					<ViewToggle value={viewMode} onChange={setViewMode} />
					<CreateFolderDialog />
				</>
			}
		>
			<UploadArea>
				<ScrollArea className="flex-1">
					{loading ? (
						<LoadingSpinner />
					) : isEmpty ? (
						<EmptyState
							icon={<FolderOpen className="h-12 w-12" />}
							title={t("folder_empty")}
							description={t("folder_empty_desc")}
						/>
					) : viewMode === "grid" ? (
						<FileGrid {...sharedProps} />
					) : (
						<FileTable {...sharedProps} />
					)}
				</ScrollArea>
			</UploadArea>

			<BatchActionBar />

			{shareTarget && (
				<ShareDialog
					open={true}
					onOpenChange={(open) => {
						if (!open) setShareTarget(null);
					}}
					fileId={shareTarget.fileId}
					folderId={shareTarget.folderId}
					name={shareTarget.name}
				/>
			)}
			{previewFile && (
				<FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />
			)}
			{versionFileId && (
				<VersionHistoryDialog
					fileId={versionFileId}
					fileName=""
					onRestored={() => {
						setVersionFileId(null);
						refresh();
					}}
				/>
			)}
		</AppLayout>
	);
}
