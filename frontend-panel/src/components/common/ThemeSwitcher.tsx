import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { useThemeStore } from "@/stores/themeStore";

export function ThemeSwitcher() {
	const { t } = useTranslation();
	const { setMode, resolvedTheme } = useThemeStore();
	const iconName = resolvedTheme === "dark" ? "Moon" : "Sun";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button variant="ghost" size="icon" className="h-9 w-9" />}
			>
				<Icon name={iconName} className="h-4.5 w-4.5" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => setMode("light")}>
					<Icon name="Sun" className="h-4 w-4 mr-2" />
					{t("theme_light")}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setMode("dark")}>
					<Icon name="Moon" className="h-4 w-4 mr-2" />
					{t("theme_dark")}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setMode("system")}>
					<Icon name="Monitor" className="h-4 w-4 mr-2" />
					{t("theme_system")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
