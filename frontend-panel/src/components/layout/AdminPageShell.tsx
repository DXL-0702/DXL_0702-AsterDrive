import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminPageShellProps {
	children: ReactNode;
	className?: string;
}

export function AdminPageShell({ children, className }: AdminPageShellProps) {
	return (
		<div
			className={cn(
				"flex min-h-0 flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6",
				className,
			)}
		>
			{children}
		</div>
	);
}
