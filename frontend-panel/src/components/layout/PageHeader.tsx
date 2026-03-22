import type { ReactNode } from "react";

interface PageHeaderProps {
	title?: string;
	actions?: ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps) {
	if (!title && !actions) return null;
	return (
		<div className="flex items-center justify-between px-4 py-3 border-b">
			{title && <span className="font-medium">{title}</span>}
			{actions && <div className="flex items-center gap-2">{actions}</div>}
		</div>
	);
}
