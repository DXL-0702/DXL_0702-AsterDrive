import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { handleApiError } from "@/hooks/useApiError";
import { useBlobUrl } from "@/hooks/useBlobUrl";
import { fileService } from "@/services/fileService";
import { api } from "@/services/http";
import type { FileInfo } from "@/types/api";

interface FilePreviewProps {
	file: FileInfo;
	onClose: () => void;
	onFileUpdated?: () => void;
}

export function FilePreview({
	file,
	onClose,
	onFileUpdated,
}: FilePreviewProps) {
	const isImage =
		file.mime_type.startsWith("image/") && file.mime_type !== "image/svg+xml";
	const isText =
		file.mime_type.startsWith("text/") ||
		file.mime_type === "application/json" ||
		file.mime_type === "application/xml";
	const isPdf = file.mime_type === "application/pdf";
	const isVideo = file.mime_type.startsWith("video/");
	const isAudio = file.mime_type.startsWith("audio/");

	const downloadPath = fileService.downloadPath(file.id);
	const needsBlob = isImage || isVideo || isAudio || isPdf;
	const { blobUrl, error: blobError } = useBlobUrl(
		needsBlob ? downloadPath : null,
	);

	return (
		<div
			className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
			onClick={onClose}
		>
			<div
				className="relative max-w-[90vw] max-h-[90vh] flex flex-col"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between p-3 bg-background/90 rounded-t-lg">
					<span className="text-sm font-medium truncate">{file.name}</span>
					<Button variant="ghost" size="icon" onClick={onClose}>
						<Icon name="X" className="h-4 w-4" />
					</Button>
				</div>
				<div className="flex-1 overflow-auto bg-background/50 rounded-b-lg p-2">
					{needsBlob && !blobUrl && !blobError && (
						<div className="text-muted-foreground p-4">Loading...</div>
					)}
					{needsBlob && blobError && (
						<div className="text-destructive p-4">Failed to load</div>
					)}
					{isImage && blobUrl && (
						<img
							src={blobUrl}
							alt={file.name}
							className="max-w-full max-h-[80vh] object-contain mx-auto"
						/>
					)}
					{isVideo && blobUrl && (
						<video
							src={blobUrl}
							controls
							className="max-w-full max-h-[80vh] mx-auto"
						/>
					)}
					{isAudio && blobUrl && (
						<audio src={blobUrl} controls className="w-full mt-4" />
					)}
					{isPdf && blobUrl && (
						<iframe
							src={blobUrl}
							title={file.name}
							className="w-[80vw] h-[80vh]"
						/>
					)}
					{isText && (
						<TextPreview
							file={file}
							url={downloadPath}
							onFileUpdated={onFileUpdated}
						/>
					)}
					{!isImage && !isVideo && !isAudio && !isPdf && !isText && (
						<div className="text-center text-muted-foreground py-12">
							Preview not available for this file type
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function TextPreview({
	file,
	url,
	onFileUpdated,
}: {
	file: FileInfo;
	url: string;
	onFileUpdated?: () => void;
}) {
	const [content, setContent] = useState<string | null>(null);
	const [error, setError] = useState(false);
	const [editing, setEditing] = useState(false);
	const [editContent, setEditContent] = useState("");
	const [etag, setEtag] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const loadContent = useCallback(() => {
		api.client
			.get(url, { responseType: "text" })
			.then((r) => {
				const et = r.headers.etag;
				if (et) setEtag(et);
				setContent(r.data);
				setEditContent(r.data);
			})
			.catch(() => setError(true));
	}, [url]);

	useEffect(() => {
		loadContent();
	}, [loadContent]);

	const handleEdit = async () => {
		try {
			await fileService.setFileLock(file.id, true);
			setEditing(true);
		} catch (e) {
			handleApiError(e);
		}
	};

	const handleCancel = async () => {
		setEditing(false);
		setEditContent(content ?? "");
		try {
			await fileService.setFileLock(file.id, false);
		} catch {
			// 解锁失败不阻塞
		}
	};

	const handleSave = async () => {
		setSaving(true);
		try {
			await fileService.updateContent(file.id, editContent, etag ?? undefined);
			setContent(editContent);
			setEditing(false);
			toast.success("File saved");
			// 重新加载获取新 ETag
			loadContent();
			onFileUpdated?.();
			try {
				await fileService.setFileLock(file.id, false);
			} catch {
				// 解锁失败不阻塞
			}
		} catch (e: unknown) {
			const status = (e as { status?: number })?.status;
			if (status === 412) {
				toast.error("File was modified by someone else. Please reload.");
			} else {
				handleApiError(e);
			}
		} finally {
			setSaving(false);
		}
	};

	if (error) return <div className="text-destructive p-4">Failed to load</div>;
	if (content === null)
		return <div className="text-muted-foreground p-4">Loading...</div>;

	return (
		<div className="flex flex-col">
			<div className="flex items-center gap-2 px-4 py-2 border-b">
				{!editing ? (
					<Button variant="outline" size="sm" onClick={handleEdit}>
						<Icon name="PencilSimple" className="h-3.5 w-3.5 mr-1" />
						Edit
					</Button>
				) : (
					<>
						<Button
							variant="default"
							size="sm"
							onClick={handleSave}
							disabled={saving}
						>
							<Icon name="FloppyDisk" className="h-3.5 w-3.5 mr-1" />
							{saving ? "Saving..." : "Save"}
						</Button>
						<Button variant="outline" size="sm" onClick={handleCancel}>
							<Icon name="Undo" className="h-3.5 w-3.5 mr-1" />
							Cancel
						</Button>
					</>
				)}
			</div>
			{editing ? (
				<textarea
					className="w-[80vw] h-[70vh] p-4 font-mono text-sm bg-background resize-none focus:outline-none"
					value={editContent}
					onChange={(e) => setEditContent(e.target.value)}
					spellCheck={false}
				/>
			) : (
				<pre className="text-sm font-mono whitespace-pre-wrap p-4 max-h-[80vh] overflow-auto">
					{content}
				</pre>
			)}
		</div>
	);
}
