import type { IconName } from "@/components/ui/icon";

export interface DetailRow {
	label: string;
	value: React.ReactNode;
	monospace?: boolean;
}

export interface QuickAction {
	icon: IconName;
	label: string;
	onClick: () => void;
}
