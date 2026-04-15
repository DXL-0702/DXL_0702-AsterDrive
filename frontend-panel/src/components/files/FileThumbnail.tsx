import { useBlobUrl } from "@/hooks/useBlobUrl";
import { useEnteredViewport } from "@/hooks/useEnteredViewport";
import { fileService } from "@/services/fileService";
import type { FileInfo, FileListItem } from "@/types/api";
import { Icon } from "../ui/icon";
import { FileTypeIcon } from "./FileTypeIcon";

interface FileThumbnailProps {
	file: FileInfo | FileListItem;
	size?: "sm" | "md" | "lg";
	thumbnailPath?: string;
}

export function FileThumbnail({
	file,
	size = "sm",
	thumbnailPath,
}: FileThumbnailProps) {
	const isImage =
		file.mime_type.startsWith("image/") && file.mime_type !== "image/svg+xml";
	const { ref, hasEnteredViewport } = useEnteredViewport<HTMLDivElement>({
		enabled: isImage,
	});
	const blobPath =
		isImage && hasEnteredViewport
			? (thumbnailPath ?? fileService.thumbnailPath(file.id))
			: null;
	const { blobUrl, error, loading } = useBlobUrl(blobPath, {
		lane: "thumbnail",
	});

	if (size === "sm") {
		return (
			<div
				ref={ref}
				className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/40"
			>
				{isImage && loading && !error && !blobUrl ? (
					<Icon
						name="Spinner"
						className="h-3.5 w-3.5 animate-spin text-muted-foreground"
						data-testid="thumbnail-loading"
					/>
				) : !isImage || error || !blobUrl ? (
					<FileTypeIcon
						mimeType={file.mime_type}
						fileName={file.name}
						className="h-4 w-4"
					/>
				) : (
					<img
						src={blobUrl}
						alt=""
						loading="lazy"
						decoding="async"
						draggable={false}
						className="h-full w-full object-cover"
					/>
				)}
			</div>
		);
	}

	if (size === "md") {
		if (isImage && loading && !error && !blobUrl) {
			return (
				<div
					ref={ref}
					className="flex h-full w-full items-center justify-center text-muted-foreground"
				>
					<Icon
						name="Spinner"
						className="h-4 w-4 animate-spin"
						data-testid="thumbnail-loading"
					/>
				</div>
			);
		}

		if (!isImage || error || !blobUrl) {
			return (
				<div
					ref={ref}
					className="flex h-full w-full items-center justify-center"
				>
					<FileTypeIcon
						mimeType={file.mime_type}
						fileName={file.name}
						className="h-5 w-5"
					/>
				</div>
			);
		}

		return (
			<div ref={ref} className="flex h-full w-full items-center justify-center">
				<img
					src={blobUrl}
					alt=""
					loading="lazy"
					decoding="async"
					draggable={false}
					className="h-full w-full object-cover"
				/>
			</div>
		);
	}

	if (isImage && loading && !error && !blobUrl) {
		return (
			<div
				ref={ref}
				className="flex h-full w-full items-center justify-center text-muted-foreground"
			>
				<Icon
					name="Spinner"
					className="h-5 w-5 animate-spin"
					data-testid="thumbnail-loading"
				/>
			</div>
		);
	}

	if (!isImage || error || !blobUrl) {
		return (
			<div ref={ref} className="flex h-full w-full items-center justify-center">
				<FileTypeIcon
					mimeType={file.mime_type}
					fileName={file.name}
					className="h-12 w-12"
				/>
			</div>
		);
	}

	return (
		<div ref={ref} className="flex h-full w-full items-center justify-center">
			<img
				src={blobUrl}
				alt=""
				loading="lazy"
				decoding="async"
				draggable={false}
				className="h-full w-auto shrink-0 max-w-none"
			/>
		</div>
	);
}
