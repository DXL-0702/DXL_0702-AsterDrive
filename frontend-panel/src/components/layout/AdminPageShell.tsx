import type { ReactNode } from "react";
import { PAGE_SECTION_PADDING_CLASS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface AdminPageShellProps {
	children: ReactNode;
	className?: string;
}

export function AdminPageShell({ children, className }: AdminPageShellProps) {
	return (
		<div
			className={cn(
				"flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto py-4 md:gap-6 md:py-6",
				PAGE_SECTION_PADDING_CLASS,
				className,
			)}
		>
			{children}
		</div>
	);
}
