import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";

export function LanguageSwitcher() {
	const { i18n, t } = useTranslation();
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button variant="ghost" size="icon" className="h-9 w-9" />}
			>
				<Icon name="Globe" className="h-4.5 w-4.5" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => i18n.changeLanguage("en")}>
					{t("language_en")}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => i18n.changeLanguage("zh")}>
					{t("language_zh")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
