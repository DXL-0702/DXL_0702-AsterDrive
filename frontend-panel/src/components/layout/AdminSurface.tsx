import type { ReactNode } from "react";
import { PAGE_SECTION_PADDING_CLASS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface AdminSurfaceProps {
	children: ReactNode;
	className?: string;
}

export function AdminSurface({ children, className }: AdminSurfaceProps) {
	return (
		<div
			className={cn(
				"flex min-h-0 flex-1 flex-col rounded-xl border bg-background",
				PAGE_SECTION_PADDING_CLASS,
				className,
			)}
		>
			{children}
		</div>
	);
}
