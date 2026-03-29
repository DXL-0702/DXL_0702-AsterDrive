import type { ReactNode } from "react";
import { PAGE_SECTION_PADDING_CLASS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface AdminPageHeaderProps {
	title: string;
	description?: string;
	actions?: ReactNode;
	toolbar?: ReactNode;
	className?: string;
}

export function AdminPageHeader({
	title,
	description,
	actions,
	toolbar,
	className,
}: AdminPageHeaderProps) {
	return (
		<div
			className={cn(
				"space-y-4 border-b pb-4",
				PAGE_SECTION_PADDING_CLASS,
				className,
			)}
		>
			<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div className="space-y-1">
					<h2 className="text-xl font-semibold tracking-tight">{title}</h2>
					{description ? (
						<p className="max-w-3xl text-sm text-muted-foreground">
							{description}
						</p>
					) : null}
				</div>
				{actions ? (
					<div className="flex flex-wrap items-center gap-2">{actions}</div>
				) : null}
			</div>
			{toolbar ? (
				<div className="flex flex-wrap items-center gap-2">{toolbar}</div>
			) : null}
		</div>
	);
}
