import { FileIcon } from "lucide-react";
import { useBlobUrl } from "@/hooks/useBlobUrl";
import { cn } from "@/lib/utils";
import { fileService } from "@/services/fileService";
import type { FileInfo } from "@/types/api";

interface FileThumbnailProps {
	file: FileInfo;
	size?: "sm" | "lg";
}

export function FileThumbnail({ file, size = "sm" }: FileThumbnailProps) {
	const isImage =
		file.mime_type.startsWith("image/") && file.mime_type !== "image/svg+xml";
	const { blobUrl, error } = useBlobUrl(
		isImage ? fileService.thumbnailPath(file.id) : null,
	);

	if (!isImage || error || !blobUrl) {
		return (
			<FileIcon
				className={cn(
					"text-muted-foreground",
					size === "sm" ? "h-4 w-4" : "h-10 w-10",
				)}
			/>
		);
	}

	return (
		<img
			src={blobUrl}
			alt=""
			className={cn(
				"rounded object-cover",
				size === "sm" ? "h-8 w-8" : "h-20 w-20",
			)}
		/>
	);
}
