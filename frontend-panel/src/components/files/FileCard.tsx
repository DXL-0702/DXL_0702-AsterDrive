import { FileThumbnail } from "@/components/files/FileThumbnail";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { FileInfo, FolderInfo } from "@/types/api";

interface FileCardProps {
	item: FileInfo | FolderInfo;
	isFolder: boolean;
	selected: boolean;
	onSelect: () => void;
	onClick: () => void;
}

export function FileCard({
	item,
	isFolder,
	selected,
	onSelect,
	onClick,
}: FileCardProps) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: card with nested interactive checkbox cannot be a button
		<div
			className={cn(
				"group relative flex flex-col items-center p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50",
				selected && "bg-accent border-primary",
			)}
			onClick={onClick}
			onKeyDown={(e) => e.key === "Enter" && onClick()}
			role="button"
			tabIndex={0}
		>
			{/* biome-ignore lint/a11y/useSemanticElements: custom styled checkbox */}
			<div
				className={cn(
					"absolute top-2 left-2 h-4 w-4 rounded border flex items-center justify-center transition-opacity",
					selected
						? "opacity-100 bg-primary border-primary"
						: "opacity-0 group-hover:opacity-100 border-muted-foreground",
				)}
				onClick={(e) => {
					e.stopPropagation();
					onSelect();
				}}
				onKeyDown={() => {}}
				role="checkbox"
				aria-checked={selected}
				tabIndex={-1}
			>
				{selected && (
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

			{/* Icon / Thumbnail */}
			<div className="h-20 w-full flex items-center justify-center mb-2 rounded-lg bg-muted/40">
				{isFolder ? (
					<Icon name="Folder" className="h-12 w-12 text-amber-500" />
				) : (
					<FileThumbnail file={item as FileInfo} size="lg" />
				)}
			</div>

			{/* Name */}
			<span
				className="text-sm text-center w-full line-clamp-2 leading-tight"
				title={item.name}
			>
				{item.name}
			</span>
		</div>
	);
}
