import { FileIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { fileService } from "@/services/fileService";
import type { FileInfo } from "@/types/api";

interface FileThumbnailProps {
	file: FileInfo;
	size?: "sm" | "lg";
}

export function FileThumbnail({ file, size = "sm" }: FileThumbnailProps) {
	const [failed, setFailed] = useState(false);
	const isImage =
		file.mime_type.startsWith("image/") && file.mime_type !== "image/svg+xml";

	if (!isImage || failed) {
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
			src={fileService.thumbnailUrl(file.id)}
			alt=""
			className={cn(
				"rounded object-cover",
				size === "sm" ? "h-8 w-8" : "h-20 w-20",
			)}
			loading="lazy"
			onError={() => setFailed(true)}
		/>
	);
}
