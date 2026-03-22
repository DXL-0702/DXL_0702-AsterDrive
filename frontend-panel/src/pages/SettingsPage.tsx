import { Grid3x3, List, Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ColorPresetPicker } from "@/components/common/ColorPresetPicker";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useFileStore } from "@/stores/fileStore";
import { useThemeStore } from "@/stores/themeStore";

export default function SettingsPage() {
	const { t, i18n } = useTranslation();
	const { mode, setMode } = useThemeStore();
	const viewMode = useFileStore((s) => s.viewMode);
	const setViewMode = useFileStore((s) => s.setViewMode);

	const themeOptions = [
		{ value: "light", label: t("theme_light"), icon: Sun },
		{ value: "dark", label: t("theme_dark"), icon: Moon },
		{ value: "system", label: t("theme_system"), icon: Monitor },
	] as const;

	return (
		<AppLayout title={t("settings")}>
			<div className="p-6 max-w-2xl space-y-6">
				{/* Appearance */}
				<Card>
					<CardHeader>
						<CardTitle>{t("theme")}</CardTitle>
						<CardDescription>{t("appearance_desc")}</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label>{t("mode")}</Label>
							<div className="flex gap-2">
								{themeOptions.map((opt) => (
									<Button
										key={opt.value}
										variant="outline"
										size="sm"
										className={cn(
											mode === opt.value && "border-primary bg-accent",
										)}
										onClick={() => setMode(opt.value)}
									>
										<opt.icon className="h-4 w-4 mr-1.5" />
										{opt.label}
									</Button>
								))}
							</div>
						</div>
						<Separator />
						<div className="space-y-2">
							<Label>{t("color")}</Label>
							<ColorPresetPicker />
						</div>
					</CardContent>
				</Card>

				{/* Language */}
				<Card>
					<CardHeader>
						<CardTitle>{t("language")}</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								className={cn(
									i18n.language?.startsWith("en") && "border-primary bg-accent",
								)}
								onClick={() => i18n.changeLanguage("en")}
							>
								{t("language_en")}
							</Button>
							<Button
								variant="outline"
								size="sm"
								className={cn(
									i18n.language?.startsWith("zh") && "border-primary bg-accent",
								)}
								onClick={() => i18n.changeLanguage("zh")}
							>
								{t("language_zh")}
							</Button>
						</div>
					</CardContent>
				</Card>

				{/* File Browser */}
				<Card>
					<CardHeader>
						<CardTitle>{t("file_browser")}</CardTitle>
						<CardDescription>{t("file_browser_desc")}</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								className={cn(
									viewMode === "list" && "border-primary bg-accent",
								)}
								onClick={() => setViewMode("list")}
							>
								<List className="h-4 w-4 mr-1.5" />
								{t("files:list_view")}
							</Button>
							<Button
								variant="outline"
								size="sm"
								className={cn(
									viewMode === "grid" && "border-primary bg-accent",
								)}
								onClick={() => setViewMode("grid")}
							>
								<Grid3x3 className="h-4 w-4 mr-1.5" />
								{t("files:grid_view")}
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</AppLayout>
	);
}
