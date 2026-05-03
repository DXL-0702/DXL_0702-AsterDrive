import { Skeleton } from "@/components/ui/skeleton";

interface SkeletonFileGridProps {
	count?: number;
}

export function SkeletonFileGrid({ count = 12 }: SkeletonFileGridProps) {
	return (
		<div className="space-y-4 p-4">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{Array.from({ length: count }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders never reorder
						key={`skeleton-card-${i}`}
						className="flex flex-col items-center rounded-xl border border-border/65 bg-card/70 p-3 shadow-xs dark:bg-card/60 dark:shadow-none"
					>
						<Skeleton className="mb-2 h-20 w-full rounded-lg" />
						<Skeleton className="mb-1 h-4 w-3/4" />
						<Skeleton className="h-3 w-1/2" />
					</div>
				))}
			</div>
		</div>
	);
}
