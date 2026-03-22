import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemeStore } from "@/stores/themeStore";

export function ThemeSwitcher() {
	const { t } = useTranslation();
	const { setMode, resolvedTheme } = useThemeStore();
	const Icon = resolvedTheme === "dark" ? Moon : Sun;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
				<Icon className="h-4 w-4" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => setMode("light")}>
					<Sun className="h-4 w-4 mr-2" />
					{t("theme_light")}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setMode("dark")}>
					<Moon className="h-4 w-4 mr-2" />
					{t("theme_dark")}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setMode("system")}>
					<Monitor className="h-4 w-4 mr-2" />
					{t("theme_system")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
