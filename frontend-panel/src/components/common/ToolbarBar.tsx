import type { ReactNode } from "react";

interface ToolbarBarProps {
	left: ReactNode;
	right?: ReactNode;
}

export function ToolbarBar({ left, right }: ToolbarBarProps) {
	return (
		<div className="border-b border-border/70 bg-background px-3 py-2 sm:px-4 sm:py-2.5">
			<div className="flex items-center justify-between gap-2 sm:gap-3">
				<div className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border/70 bg-muted/20 px-2.5 sm:h-10 sm:gap-2 sm:rounded-lg sm:px-3">
					{left}
				</div>
				{right && (
					<div className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-border/70 bg-muted/20 px-1.5 sm:h-10 sm:gap-2 sm:rounded-lg sm:px-2">
						{right}
					</div>
				)}
			</div>
		</div>
	);
}
