import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/stores/fileStore";

interface ViewToggleProps {
	value: ViewMode;
	onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
	const { t } = useTranslation("files");
	return (
		<div className="flex border rounded-md">
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							variant="ghost"
							size="icon"
							className={cn(
								"h-8 w-8 rounded-r-none",
								value === "list" && "bg-accent",
							)}
							onClick={() => onChange("list")}
						/>
					}
				>
					<Icon name="ListBullets" className="h-4 w-4" />
				</TooltipTrigger>
				<TooltipContent>{t("list_view")}</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							variant="ghost"
							size="icon"
							className={cn(
								"h-8 w-8 rounded-l-none",
								value === "grid" && "bg-accent",
							)}
							onClick={() => onChange("grid")}
						/>
					}
				>
					<Icon name="Grid" className="h-4 w-4" />
				</TooltipTrigger>
				<TooltipContent>{t("grid_view")}</TooltipContent>
			</Tooltip>
		</div>
	);
}
